import { Box, type Body, type Contact, type World } from 'planck';
import { createWorld, createGround, Snapshotter, SIM } from './world';
import { Forklift, forkliftKapasitesi, FORKLIFT_NEUTRAL } from './forklift';
import type { Grabbable } from './crane';
import { LmiZone, type LmiReading } from './loadChart';
import {
  FORKLIFT_TASKS, FORKLIFT_MALZEME_X, RAF_KATLARI, RAF_ON, RAF_X, RAF_YARI,
} from '../game/forkliftTasks';
import type { Task } from '../game/tasks';
import type { SceneInput } from './scene';
import type { Gosterge, OyunSahnesi, PanelSatiri, Uyari } from './sahne';

/** Rafın çarpışma gövdesi: her kat bir döşeme, arkada bir dikme. */
export function createRaf(world: World): Body {
  const body = world.createBody();
  const half = RAF_YARI;
  for (const y of RAF_KATLARI) {
    body.createFixture(new Box(half, 0.09, { x: RAF_X, y: y - 0.09 }, 0), { friction: 0.85 });
    // Arka dayanak: yükün rafı geçip arkaya düşmesini engelliyor. **Tam boy
    // dikme DEĞİL** — dikme koridoru kapatıyor ve makine rafın doğusundaki
    // malzeme alanına hiç geçemiyordu. Gerçek rafta da dikmeler derinlik
    // yönünde, koridorda değil.
    body.createFixture(new Box(0.08, 0.3, { x: RAF_X + half, y: y + 0.3 }, 0),
      { friction: 0.6 });
  }
  return body;
}

/**
 * Forklift sahnesi.
 *
 * Vinç sahnesiyle aynı arayüzü uyguluyor, dolayısıyla görev akışı, puanlama,
 * kamera ve HUD kabuğu hiç değişmeden çalışıyor. Farklı olan tek şey makine
 * ve onun ölçüsü: burada yarıçap değil YÜK MERKEZİ MESAFESİ, halat değil
 * kaldırma yüksekliği bağlıyor.
 */
export class ForkliftSahnesi implements OyunSahnesi {
  readonly world = createWorld();
  readonly snaps = new Snapshotter();
  readonly forklift: Forklift;
  load!: Body;
  private loadSpec: Task | null = null;
  grabbables: Grabbable[] = [];
  carpma = 0;
  private olcumTon = 0;

  constructor() {
    createGround(this.world);
    createRaf(this.world);
    this.forklift = new Forklift(this.world, this.snaps);
    this.spawnLoad(FORKLIFT_TASKS[0] ?? null);

    this.world.on('post-solve', (contact: Contact, impulse: { normalImpulses: number[] }) => {
      const a = contact.getFixtureA().getBody();
      const b = contact.getFixtureB().getBody();
      if (a !== this.load && b !== this.load) return;
      // Çataldaki yük her adım setTransform ile yerine konuyor; onun temas
      // impulsu gerçek bir çarpma değil, kinematik sürüşün artığı. Sadece
      // SERBEST yükün çarpması sayılıyor.
      if (this.forklift.hasLoad) return;
      const j = Math.max(...(impulse.normalImpulses ?? [0]));
      if (j > 9000) this.carpma++;
    });
  }

  spawnLoad(spec: Task | null): void {
    if (this.load) this.world.destroyBody(this.load);
    this.loadSpec = spec;
    if (!spec) { this.grabbables = []; return; }
    const body = this.world.createDynamicBody({
      x: FORKLIFT_MALZEME_X, y: spec.halfHeight + 0.04,
    });
    body.createFixture(new Box(spec.halfWidth, spec.halfHeight), {
      density: 1, friction: 0.9, restitution: 0.01,
    });
    body.setMassData({
      mass: spec.tonnes * 1000, center: { x: 0, y: 0 },
      I: (spec.tonnes * 1000 * (spec.halfWidth ** 2 + spec.halfHeight ** 2)) / 3,
    });
    body.setAngularDamping(0.6);
    this.snaps.track(body);
    this.load = body;
    this.grabbables = [{ body, halfWidth: spec.halfWidth, halfHeight: spec.halfHeight }];
  }

  /** Forklift bölümü — depo. Hedefler raf katları. */
  readonly gorevler = FORKLIFT_TASKS;
  /** Ölçülen tur: görev başına 26–35 s. Forklift bölümü kısa, eşik de öyle. */
  readonly hizEsikleri = { tam: 22, sifir: 70 };
  hedefNoktasi(t: Task): { x: number; y: number } | null {
    const y = RAF_KATLARI[t.hedef];
    // Hedef rafın ORTASI değil, ÖN YÜZÜNE dayalı konum: makine dışarıda
    // durup yükü içeri uzatıyor, dolayısıyla yükün doğru yeri burası.
    return y === undefined ? null : { x: RAF_ON + t.halfWidth, y };
  }
  get sasiHizi(): number { return this.forklift.chassis.getLinearVelocity().x; }
  /** Küçük makine, dar koridor: vinçten belirgin biçimde daha yakın. */
  readonly kameraOlcegi = { yakin: 46, uzak: 24 };
  /**
   * Forklift için devrilme eşiği yüksek — ÇÜNKÜ burnunu çatalına dayamak
   * kaza değil, kurtarılabilir bir hata. Ölçümde aşırı yükte makine 2.1°
   * eğilip çatalının üstünde duruyor; oradan geri gidip yükü bırakabiliyor.
   * Gerçek devrilme yük yukarıdayken oluyor ve çok daha büyük bir açı.
   */
  get devrildiMi(): boolean { return Math.abs(this.tiltDeg) > 22; }

  get loadTask(): Task | null { return this.loadSpec; }
  /** Forkliftte kurulum yok: makine indiği an çalışır. */
  get calismaModunda(): boolean { return true; }
  get hasLoad(): boolean { return this.forklift.hasLoad; }
  get tiltDeg(): number { return (-this.forklift.chassis.getAngle() * 180) / Math.PI; }
  get yukNoktasi(): { x: number; y: number } { return this.forklift.forkWorld; }
  /** Forkliftte sarkaç yok — yük çatala kilitli. */
  salinimDeg(): number { return 0; }

  /**
   * Arka aksın taşıdığı yükün, boş makinedeki payına oranı.
   *
   * Forkliftin devrilme göstergesi bu: yük tablosu "kaldırabilir misin"i
   * söylüyor, bu ise "şu anda ne kadar payın kaldı"yı. 0'a inmesi arka
   * tekerin havalanması demek ve ölçüm — süspansiyon mafsalının tepki
   * kuvvetinden okunuyor, tahmin değil.
   */
  get arkaAksPayi(): number {
    return Math.max(0, Math.min(1.5, this.forklift.arkaAksN / this.forklift.arkaAksStatikN));
  }

  odakNoktalari(): Array<{ x: number; y: number }> {
    const c = this.forklift.chassis.getPosition();
    const f = this.forklift.forkWorld;
    return [{ x: c.x, y: c.y + 1.2 }, { x: f.x, y: f.y + 1.0 }];
  }

  get olcum(): LmiReading {
    const merkez = this.forklift.loadCentreM;
    const kap = forkliftKapasitesi(merkez, this.forklift.liftM);
    const toplam = this.olcumTon;
    const percent = kap <= 0 ? Infinity : (toplam / kap) * 100;
    const zone = percent > 100 ? LmiZone.Red : percent >= 80 ? LmiZone.Amber : LmiZone.Green;
    return {
      percent, zone,
      capacityTonnes: kap, chartTonnes: kap, ropeTonnes: kap, limitedBy: 'tablo',
      loadTonnes: toplam, radiusM: merkez,
      speedScale: zone === LmiZone.Red ? 0.3 : zone === LmiZone.Amber ? 0.6 : 1,
      blockRadiusIncrease: zone === LmiZone.Red,
    };
  }

  step(input: SceneInput, dt: number): void {
    if (input.reset) this.forklift.reset();
    if (input.toggleHook) this.forklift.requestToggleAttach();

    this.snaps.capture();
    this.forklift.drive(input.drive, dt);
    // Vinç kolları forkliftte kaldırma ve eğim oluyor: W/S çatal, ⇧W/⇧S direk.
    this.forklift.update(
      { lift: input.crane.luff, tilt: input.crane.telescope },
      dt, this.olcum.blockRadiusIncrease,
    );

    this.world.step(dt, SIM.velocityIterations, SIM.positionIterations);
    this.world.clearForces();

    // Ölçüm: çatalda ne varsa onun ağırlığı. Vinçteki halat kuvvetinin
    // karşılığı — ama burada yük rijit bağlı, dolayısıyla doğrudan kütle.
    const ham = this.forklift.hasLoad ? (this.loadSpec?.tonnes ?? 0) : 0;
    this.olcumTon += (ham - this.olcumTon) * Math.min(1, dt / 0.2);

    this.forklift.flushJointQueue(this.grabbables);
  }

  gosterge(): Gosterge {
    const r = this.olcum;
    const pct = Number.isFinite(r.percent) ? Math.min(999, r.percent) : 999;
    const devrilme = Math.abs(this.tiltDeg);
    return {
      baslik: 'DEVRİLME PAYI',
      yuzde: pct,
      durum: r.zone === LmiZone.Red ? 'DEVRİLİR — ÇOK AĞIR'
        : r.zone === LmiZone.Amber ? 'DİKKAT · ARKA TEKER HAFİFLİYOR'
        : devrilme > 2 ? 'ÖNE YATIYOR' : 'GÜVENLİ',
      zone: r.zone === LmiZone.Red ? 'red' : r.zone === LmiZone.Amber ? 'amber' : 'green',
      dolu: Math.min(1, pct / 150),
      altSatirlar: [
        `yük merkezi ${r.radiusM.toFixed(2)} m · ön akstan`,
        this.forklift.liftM > 3.3
          ? `3.3 m üstü: kapasite düşüyor (×${(forkliftKapasitesi(r.radiusM, this.forklift.liftM)
              / Math.max(forkliftKapasitesi(r.radiusM, 0), 0.01)).toFixed(2)})`
          : 'yük alçakken taşı — yükseldikçe kapasite düşer',
      ],
    };
  }

  panelSatirlari(): PanelSatiri[] {
    const r = this.olcum;
    const egim = this.tiltDeg;
    const f = this.forklift;
    return [
      { etiket: 'çatalda', deger: `${r.loadTonnes.toFixed(2)} t` },
      { etiket: 'sınır', deger: `${r.capacityTonnes.toFixed(2)} t` },
      { etiket: 'yük merkezi', deger: `${r.radiusM.toFixed(2)} m` },
      { etiket: 'çatal kotu', deger: `${f.liftM.toFixed(2)} m`,
        ...(f.liftM > 3.3 ? { vurgu: 'uyari' as const } : {}) },
      { etiket: 'direk eğimi', deger: `${f.tiltDeg >= 0 ? '+' : ''}${f.tiltDeg.toFixed(0)}°`,
        ...(f.tiltDeg < 0 && f.hasLoad ? { vurgu: 'kotu' as const } : {}) },
      { etiket: 'arka aks', deger: `%${(this.arkaAksPayi * 100).toFixed(0)}`,
        ...(this.arkaAksPayi < 0.25 ? { vurgu: 'kotu' as const }
          : this.arkaAksPayi < 0.45 ? { vurgu: 'uyari' as const } : {}) },
      { etiket: 'araç eğimi', deger: `${egim >= 0 ? '+' : ''}${egim.toFixed(1)}°`,
        ...(Math.abs(egim) > 1.5 ? { vurgu: 'kotu' as const } : {}) },
      { etiket: 'hız', deger: `${f.speedKmh.toFixed(0)} km/sa` },
    ];
  }

  uyari(): Uyari | null {
    const r = this.olcum;
    const kilitli = this.forklift.kilitliDenendi;
    const egim = this.tiltDeg;

    if (this.forklift.burunYerde) {
      return {
        zone: 'red', carpiyor: true,
        bas: '⚠ BURUN YERE DÜŞTÜ — ÇATALIN ÜSTÜNDESİN',
        govde: `Araç <b>${egim.toFixed(1)}°</b> öne devrildi ve çatalının`
          + ' üstüne oturdu. Ön tekerler artık yönlendirmiyor.',
        cozum: 'Geriye git ve yükü bırak: ⇧W ile direği geriye yatır, S ile indir.',
      };
    }
    if (this.arkaAksPayi < 0.2 && this.forklift.hasLoad) {
      return {
        zone: 'red', carpiyor: true,
        bas: '⚠ ARKA TEKER HAVALANIYOR — DEVRİLİYORSUN',
        govde: `Arka aksta yükün yalnızca <b>%${(this.arkaAksPayi * 100).toFixed(0)}</b>'i`
          + ' kaldı. Karşı ağırlık yükü dengelemeye yetmiyor.',
        cozum: 'S ile çatalı hemen indir, ⇧W ile direği geriye yatır, yavaşla.',
      };
    }
    if (r.zone === LmiZone.Red) {
      return {
        zone: 'red', carpiyor: kilitli,
        bas: '⚠ BU YÜK BU MESAFEDE KALDIRILAMAZ',
        govde: `Çataldaki <b>${r.loadTonnes.toFixed(2)} t</b>, yük merkezi`
          + ` <b>${r.radiusM.toFixed(2)} m</b> ve kot <b>${this.forklift.liftM.toFixed(2)} m</b>`
          + ` iken izin verilen <b>${r.capacityTonnes.toFixed(2)} t</b> sınırının üstünde.`,
        cozum: kilitli
          ? 'Kaldırma ve öne yatırma KİLİTLİ. S ile indir — alçakta kapasite yüksek.'
          : 'Çatalı indir: 3.3 metrenin altında kapasite tam.',
      };
    }
    if (r.zone === LmiZone.Amber) {
      return {
        zone: 'amber', carpiyor: false,
        bas: 'SINIRA YAKLAŞIYORSUN',
        govde: `${r.loadTonnes.toFixed(2)} t / ${r.capacityTonnes.toFixed(2)} t`
          + ` · yük merkezi ${r.radiusM.toFixed(2)} m.`
          + ' Yükseldikçe sınır düşer; taşırken çatalı alçakta tut.',
        cozum: '',
      };
    }
    return null;
  }

  ipucu(): { metin: string; mod: 'drive' | 'crane' | 'ready' } {
    if (this.forklift.hasLoad) {
      return { metin: 'yük çatalda · rafa hizala, boşluk ile bırak', mod: 'crane' };
    }
    const { reason } = this.forklift.alinabilirSebep(this.grabbables);
    const say: Record<typeof reason, string> = {
      hazir: 'ÇATAL YÜKÜN ALTINDA · boşluk ile al',
      hizli: 'çok hızlısın · yavaşla, sonra al',
      kot: 'çatal kotu tutmuyor · W/S ile palet tabanına getir',
      yanas: 'çatalı yükün içine sür',
      uzak: 'paletin yanına git, çatalı tabanına indir',
    };
    return { metin: say[reason], mod: reason === 'hazir' ? 'ready' : 'drive' };
  }

  reset(): void { this.forklift.reset(); }
}

export { FORKLIFT_NEUTRAL, FORKLIFT_TASKS, RAF_KATLARI, RAF_ON, RAF_X, RAF_YARI };
