/**
 * Başsız (headless) sahne sürücüsü — `npm run sahne`.
 *
 * Bu projede her fizik kararı ölçümle alındı; göz kararı defalarca yanlış
 * teşhis koydurdu (tork sanılan mafsal esnemesi, bom boyu sanılan LMI kilidi,
 * hız sanılan uyku kipi). Tarayıcı açmadan aynı `Scene`'i sürüp sayıları
 * yazdırmak, o teşhisleri saniyeler içinde yapıp yanlışlarını eliyor.
 */
import { Scene, IDLE, SCENE, type SceneInput } from '../src/sim/scene';
import { SIM, factoryTerraces } from '../src/sim/world';
import { CRANE } from '../src/sim/crane';
import { capacityAt, OutriggerState } from '../src/sim/loadChart';
import type { CraneInput } from '../src/sim/crane';

const DT = 1 / SIM.hz;

/** Oyuncunun yerine geçen basit servo: hedefe doğru bang-bang komut üretir. */
function toward(current: number, target: number, deadband: number): number {
  const e = target - current;
  if (Math.abs(e) <= deadband) return 0;
  return e > 0 ? 1 : -1;
}

class Rig {
  readonly scene = new Scene();
  t = 0;

  /** Girdiyi n saniye boyunca uygula. */
  run(seconds: number, input: (r: Rig) => Partial<SceneInput>): void {
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i++) {
      this.scene.step({ ...IDLE, ...input(this) }, DT);
      this.t += DT;
    }
  }

  /** Bir kere basılan tuş: ilk adımda tetiklenir, gerisi boşta geçer. */
  tap(key: 'toggleOutriggers' | 'toggleHook', settle: number): void {
    this.scene.step({ ...IDLE, [key]: true }, DT);
    this.t += DT;
    this.run(settle, () => ({}));
  }

  /** Bom açısını, teleskop boyunu ve halatı aynı anda hedefe sür. */
  servo(target: { angleDeg?: number; extM?: number; ropeDropTo?: number }): CraneInput {
    const c = this.scene.crane;
    const luff = target.angleDeg === undefined ? 0
      : toward(c.angleDeg, target.angleDeg, 0.4);
    const telescope = target.extM === undefined ? 0
      : toward(c.extensionM, target.extM, 0.08);
    // Kancayı verilen yüksekliğe indir: halat uzatmak kancayı aşağı götürür.
    const winch = target.ropeDropTo === undefined ? 0
      : toward(c.hook.getPosition().y, target.ropeDropTo, 0.05);
    return { luff, telescope, winch };
  }

  line(tag: string): string {
    const s = this.scene;
    const c = s.crane;
    const hook = c.hook.getPosition();
    const load = s.load.getPosition();
    const lmi = c.lmi;
    return [
      tag.padEnd(7),
      `bom ${c.lengthM.toFixed(1)}m/${c.angleDeg.toFixed(0)}° R${c.radiusM.toFixed(1)}m`,
      `kanca ${hook.x.toFixed(2)},${hook.y.toFixed(2)} (${((c.hook.getAngle() * 180) / Math.PI).toFixed(2)}°)`,
      `yuk ${load.x.toFixed(2)},${load.y.toFixed(2)} (${((s.load.getAngle() * 180) / Math.PI).toFixed(2)}°)`,
      `bagli ${c.hasLoad ? 'E' : 'H'}`,
      `LMI %${Math.min(999, lmi.percent).toFixed(0)} yuk ${lmi.loadTonnes.toFixed(2)}t`,
      `egim ${s.tiltDeg.toFixed(2)}°`,
    ].join('  ');
  }
}

function main(): void {
  const r = new Rig();
  const out: string[] = [];
  const log = (tag: string): void => { out.push(r.line(tag)); };

  log('BASLA');

  // 1) Takoza dayanana kadar sür — oyuncu da öyle yapıyor.
  r.run(20, (rig) => ({ drive: { throttle: rig.scene.truck.speedKmh < 26 ? 1 : 0, handbrake: false } }));
  r.run(3, () => ({ drive: { throttle: 0, handbrake: true } }));
  log('PARK');

  // 2) Ayakları aç ve otursun.
  r.tap('toggleOutriggers', 6);
  log('AYAK');
  out.push(`        ayak %${(r.scene.outriggers.fraction * 100).toFixed(0)}  durum ${r.scene.outriggers.state}`);

  // --- çalışma zarfı: park edilen yerden neye ulaşılıyor? ---
  //
  // Bu tabloyu gözle kestirmek defalarca yanıldı; "bom yetmiyor" sanılan şey
  // iki kez yük tablosu kilidi çıktı. Park edilen gerçek pim konumundan
  // hesaplamak tartışmayı bitiriyor.
  const pivot = r.scene.truck.chassis.getWorldPoint(CRANE.pivot);
  const hookT = CRANE.hookTonnes;
  const targets: Array<{ ad: string; x: number; y: number }> = [
    { ad: 'YUK ALMA', x: r.scene.load.getPosition().x, y: SCENE.load.halfHeight * 2 + 1.6 },
    ...factoryTerraces().map((t, i) => ({
      ad: i === 0 ? '1. KAT' : i === 1 ? '2. KAT' : 'CATI',
      x: t.x, y: t.y + 3.0,
    })),
  ];
  out.push('        --- calisma zarfi (park edilen yerden) ---');
  for (const t of targets) {
    // Halat düşey: bom ucu hedefin TAM ÜSTÜNDE. O yüzden L·cosθ = dx, yani
    // yarıçap yalnızca yatay mesafeye bağlı — bom boyu ve açısı R'yi değiştirmez.
    const dx = t.x - pivot.x;
    const R = CRANE.pivotOffsetM + dx;
    const cap = capacityAt(R, OutriggerState.Full);
    const need = SCENE.load.tonnes + hookT;
    const ratio = need / Math.max(cap, 0.01);

    // Ulaşılabilir mi: L·cosθ = dx ve bom ucu hedeften en az minRope yukarıda
    // olacak şekilde bir (L, θ) var mı?
    let reach = false;
    for (let th = CRANE.minAngleDeg; th <= CRANE.maxAngleDeg; th += 0.5) {
      const c = Math.cos((th * Math.PI) / 180);
      if (c <= 0.01) continue;
      const L = dx / c;
      if (L < CRANE.boomBaseLengthM || L > CRANE.boomBaseLengthM + CRANE.maxExtensionM) continue;
      const tipY = pivot.y + L * Math.sin((th * Math.PI) / 180);
      if (tipY >= t.y + CRANE.minRopeM) { reach = true; break; }
    }
    out.push(
      `        ${t.ad.padEnd(9)} R ${R.toFixed(1)}m  kap ${cap.toFixed(2)}t`
      + `  LMI %${(ratio * 100).toFixed(0)}`
      + `  ${reach ? 'ulasir' : 'ULASMAZ'}`
      + `  ${ratio > 1 ? '[KIRMIZI]' : ratio > 0.9 ? '[SARI]' : '[YESIL]'}`,
    );
  }

  // 3-4) Bom ucunu yükün üstüne getir (açıyla — teleskop dipte), sarkaç sönsün,
  //      sonra kancayı indir.
  //
  // Bomu kaldırmak yarıçapı KISALTIR. Kamyon yüke yakın park ettiği için
  // toplanmış bom 30°'de yükü 0.5 m aşıyor; çare teleskop değil, açı.
  const loadX = r.scene.load.getPosition().x;
  const overLoad = (rig: Rig): CraneInput => {
    const e = loadX - rig.scene.crane.tipWorld.x;
    // Bom ucu yükün sağındaysa bomu kaldır (yarıçap kısalır), solundaysa indir.
    if (Math.abs(e) < 0.05) return { luff: 0, telescope: 0, winch: 0 };
    return { luff: e < 0 ? 1 : -1, telescope: 0, winch: 0 };
  };
  // Kancayı yükün üstünde SERBEST tutuyoruz, üstüne oturtmuyoruz: bir kez
  // değdiğinde sürtünme onu 0.9 m yanda kilitliyor ve halat eğik kalıyordu
  // (kapı haklı olarak 'yan-cekme' diyordu). Bağlanma bandı zaten yükün 1.7 m
  // üstüne kadar izin veriyor — sapancı da kancayı havada yakalar.
  const asili = SCENE.load.halfHeight * 2 + 1.15;
  const dur = (rig: Rig): number => {
    const v = rig.scene.crane.hook.getLinearVelocity();
    return Math.hypot(v.x, v.y);
  };

  r.run(24, (rig) => ({ crane: overLoad(rig) }));
  r.run(20, (rig) => ({ crane: {   // kancayı yükün üstüne indir, değdirmeden
    luff: 0, telescope: 0, winch: toward(rig.scene.crane.hook.getPosition().y, asili, 0.05),
  } }));
  r.run(16, (rig) => ({ crane: overLoad(rig) }));   // bom ucunu ince ayarla
  r.run(18, () => ({}));                            // sarkaç sönsün
  log('INDI');
  out.push(`        kanca_y ${r.scene.crane.hook.getPosition().y.toFixed(2)} (yuk ustu ${(SCENE.load.halfHeight * 2).toFixed(2)})`
    + `  hiz ${dur(r).toFixed(3)} m/s`
    + `  yan cekme ${(r.scene.crane.tipWorld.x - r.scene.crane.hook.getPosition().x).toFixed(2)} m`
    + `  merkez farki ${Math.abs(loadX - r.scene.crane.hook.getPosition().x).toFixed(2)} m`
    + `  kapi: ${r.scene.crane.attachCheck(r.scene.grabbables).reason}`);

  // 5) Bağla.
  r.tap('toggleHook', 1.0);
  log('BAGLA');

  // 6) Kaldır — 2. kat terasının üstüne çıkacak kadar.
  const terr = factoryTerraces();
  const hedef = terr[1] ?? { x: 68.7, y: 10.0 };
  r.run(14, (rig) => ({ crane: {
    luff: 0, telescope: 0,
    winch: toward(rig.scene.load.getPosition().y, hedef.y + 2.6, 0.1),
  } }));
  log('KALKTI');

  // 7) Terasa taşı: bomu indirerek + teleskopu açarak yarıçapı büyüt.
  r.run(45, (rig) => {
    const e = hedef.x - rig.scene.crane.tipWorld.x;
    const c = rig.scene.crane;
    if (Math.abs(e) < 0.08) return { crane: { luff: 0, telescope: 0, winch: 0 } };
    // Önce açıyı indirerek uzan, açı bitince teleskopu aç.
    if (e > 0 && c.angleDeg > 34) return { crane: { luff: -1, telescope: 0, winch: 0 } };
    return { crane: { luff: 0, telescope: e > 0 ? 1 : -1, winch: 0 } };
  });
  r.run(10, () => ({}));
  log('TERAS');
  out.push(`        teras hedefi x ${hedef.x.toFixed(1)}  yuk x ${r.scene.load.getPosition().x.toFixed(2)}`
    + `  yuk y ${r.scene.load.getPosition().y.toFixed(2)}  (teras kotu ${hedef.y.toFixed(1)})`);

  // 8) Yükü terasa indir ve bırak.
  r.run(16, (rig) => ({ crane: {
    luff: 0, telescope: 0,
    winch: toward(rig.scene.load.getPosition().y, hedef.y + SCENE.load.halfHeight + 0.1, 0.05),
  } }));
  r.run(4, () => ({}));
  r.tap('toggleHook', 3.0);
  log('BIRAK');

  const l = r.scene.load.getPosition();
  const kondu = Math.abs(l.y - (hedef.y + SCENE.load.halfHeight)) < 0.45
    && Math.abs(l.x - hedef.x) < 2.6;
  out.push(`        SONUC: yuk ${l.x.toFixed(2)},${l.y.toFixed(2)}`
    + `  aci ${((r.scene.load.getAngle() * 180) / Math.PI).toFixed(1)}°`
    + `  ->  2. KAT'A ${kondu ? 'KONDU' : 'KONMADI'}`);

  console.log(out.join('\n'));

  // Gerçek bir regresyon testi: görev tamamlanamazsa sıfırdan farklı çık.
  if (!kondu) throw new Error('görev tamamlanamadı: yük 2. kata konmadı');
}

// Hata olursa node zaten yığın izini basıp sıfırdan farklı kodla çıkar.
main();
