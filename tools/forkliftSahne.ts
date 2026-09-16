/**
 * Başsız forklift sürücüsü — `npm run sahne`'in ikinci yarısı.
 *
 * Vinç rigiyle aynı gerekçe: her karar ölçümle alınıyor. Burada ölçülen şey
 * bölümün OYNANABİLİR olması — beş palet de rafına konabiliyor mu, hangi
 * görevde ibre nereye dayanıyor, devrilme erişilebilir mi. Biri bile konmazsa
 * sıfırdan farklı kodla çıkıyor, dolayısıyla CI bunu yakalıyor.
 */
import { ForkliftSahnesi } from '../src/sim/forkliftSahne';
import { FORKLIFT } from '../src/sim/forklift';
import { forkliftKapasitesi } from '../src/sim/forklift';
import {
  FORKLIFT_TASKS, RAF_KATLARI, RAF_ON,
} from '../src/game/forkliftTasks';
import { Mission } from '../src/game/mission';
import { IDLE, type SceneInput } from '../src/sim/scene';
import { SIM } from '../src/sim/world';

const DT = 1 / SIM.hz;

class Rig {
  readonly sahne = new ForkliftSahnesi();
  readonly mission = new Mission(this.sahne);
  t = 0;
  /** Görülen en düşük arka aks payı — devrilmeye ne kadar yaklaşıldı. */
  enAzArka = 1.5;
  enCokEgim = 0;

  run(sec: number, input: (r: Rig) => Partial<SceneInput>): void {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      this.sahne.step({ ...IDLE, ...input(this) }, DT);
      this.mission.update(DT);
      this.t += DT;
      if (this.sahne.hasLoad) {
        this.enAzArka = Math.min(this.enAzArka, this.sahne.arkaAksPayi);
        this.enCokEgim = Math.max(this.enCokEgim, this.sahne.tiltDeg);
      }
    }
  }

  /** Koşul sağlanana kadar sür. */
  runUntil(maxSec: number, done: (r: Rig) => boolean, input: (r: Rig) => Partial<SceneInput>): boolean {
    for (let i = 0; i < Math.round(maxSec / DT); i++) {
      if (done(this)) return true;
      this.run(DT, input);
    }
    return done(this);
  }

  tap(key: 'toggleHook', settle: number): void {
    this.sahne.step({ ...IDLE, [key]: true }, DT);
    this.mission.update(DT);
    this.t += DT;
    this.run(settle, () => ({}));
  }

  /** Çatal topuğunu hedef x'e götüren oransal gaz. */
  suru(hedefX: number): Partial<SceneInput> {
    const dx = hedefX - this.sahne.forklift.forkWorld.x;
    const g = Math.max(-1, Math.min(1, dx / 1.8));
    // Hedefe yaklaşınca fren: kinematik yükle çarparak durmak istemiyoruz.
    if (Math.abs(dx) < 0.05) return { drive: { throttle: 0, handbrake: true } };
    return { drive: { throttle: g, handbrake: false } };
  }

  /** Çatalı hedef kota götüren komut. */
  kaldir(hedefKot: number): Partial<SceneInput> {
    const e = hedefKot - this.sahne.forklift.liftM;
    if (Math.abs(e) < 0.02) return {};
    return { crane: { luff: e > 0 ? 1 : -1, telescope: 0, winch: 0 } };
  }
}

const out: string[] = [];
const say = (s: string): void => { out.push(s); };

function main(): number {
  const r = new Rig();

  say('=== FORKLIFT: Depo, sevkiyat rampasi ===');
  say('--- calisma zarfi: hangi yuk hangi rafta ne okuyor? ---');
  for (const g of FORKLIFT_TASKS) {
    const kot = RAF_KATLARI[g.hedef] ?? 0;
    const alcak = forkliftKapasitesi(g.halfWidth, 0);
    const rafta = forkliftKapasitesi(g.halfWidth, kot + 0.35);
    say(`  ${g.kod}  ${g.ad.padEnd(16)} ${g.tonnes.toFixed(2)}t`
      + `  merkez ${g.halfWidth.toFixed(2)}m  raf R${g.hedef + 1} (${kot.toFixed(2)}m)`
      + `  alcakta %${((g.tonnes / alcak) * 100).toFixed(0)}`
      + `  rafta %${((g.tonnes / rafta) * 100).toFixed(0)}`);
  }

  for (let n = 0; n < FORKLIFT_TASKS.length; n++) {
    const task = r.mission.task;
    const hedef = r.mission.target;
    if (!task || !hedef) break;

    // --- 1) Palete yanaş: çatalı indir, rafın altından geçip batıdan yanaş ---
    const paletX = r.sahne.load.getPosition().x;
    const taban = r.sahne.load.getPosition().y - task.halfHeight;
    r.runUntil(12, (x) => x.sahne.forklift.liftM <= FORKLIFT.minLiftM + 0.03,
      (x) => x.kaldir(FORKLIFT.minLiftM));
    // Önce malzeme alanının batısına geç (rafın altından), sonra kotu tuttur.
    r.runUntil(40, (x) => x.sahne.forklift.forkWorld.x >= paletX - task.halfWidth - 0.04,
      (x) => x.suru(paletX - task.halfWidth - 0.04));
    r.run(1.0, () => ({ drive: { throttle: 0, handbrake: true } }));
    r.runUntil(12, (x) => Math.abs(x.sahne.forklift.liftM - Math.max(taban, FORKLIFT.minLiftM)) < 0.03,
      (x) => ({ ...x.kaldir(Math.max(taban, FORKLIFT.minLiftM)),
                drive: { throttle: 0, handbrake: true } }));
    r.runUntil(20, (x) => x.sahne.forklift.alinabilirSebep(x.sahne.grabbables).reason === 'hazir'
      && x.sahne.forklift.speedKmh < 0.8,
      (x) => x.suru(paletX - task.halfWidth - 0.04));
    r.run(1.0, () => ({ drive: { throttle: 0, handbrake: true } }));
    const kapi = r.sahne.forklift.alinabilirSebep(r.sahne.grabbables).reason;
    r.tap('toggleHook', 0.8);
    say(`${task.kod} AL   kapi ${kapi}  catalda ${r.sahne.hasLoad ? 'E' : 'H'}`
      + `  kot ${r.sahne.forklift.liftM.toFixed(2)}m`);
    if (!r.sahne.hasLoad) { say(`${task.kod} ALINAMADI`); break; }

    // --- 2) Direği geriye yatır (yükü sırtlığa yasla) ve rafa götür ---
    r.run(2.0, () => ({ crane: { luff: 0, telescope: 1, winch: 0 } }));
    const kot = RAF_KATLARI[task.hedef] ?? 0;
    // Rafın önünde dur; kaldırmayı YERİNDE yap, yükü havada taşıma.
    r.runUntil(40, (x) => Math.abs(x.sahne.forklift.forkWorld.x - (RAF_ON - 0.35)) < 0.07
      && x.sahne.forklift.speedKmh < 0.6,
      (x) => x.suru(RAF_ON - 0.35));
    r.run(1.2, () => ({ drive: { throttle: 0, handbrake: true } }));

    // --- 3) Raf kotunun 15 cm üstüne çık ---
    const hedefKot = kot + 0.15;
    r.runUntil(20, (x) => Math.abs(x.sahne.forklift.liftM - hedefKot) < 0.03,
      (x) => ({ ...x.kaldir(hedefKot), drive: { throttle: 0, handbrake: true } }));
    const iz = (e: string): void => {
      if (!process.env['IZ']) return;
      const f = r.sahne.forklift;
      const l = r.sahne.load.getPosition();
      say(`   iz ${e.padEnd(14)} sasi ${f.chassis.getPosition().x.toFixed(2)}`
        + ` topuk ${f.forkWorld.x.toFixed(2)},${f.forkWorld.y.toFixed(2)}`
        + ` kot ${f.liftM.toFixed(2)} direk ${f.tiltDeg.toFixed(1)}°`
        + ` yuk ${l.x.toFixed(2)},${l.y.toFixed(2)} catalda ${f.hasLoad ? 'E' : 'H'}`);
    };
    iz('raf-kotunda');
    const lmi = r.sahne.olcum;
    say(`      RAFTA  kot ${r.sahne.forklift.liftM.toFixed(2)}m`
      + `  LMI %${Math.min(999, lmi.percent).toFixed(0)}`
      + `  arka aks %${(r.sahne.arkaAksPayi * 100).toFixed(0)}`
      + `  egim ${r.sahne.tiltDeg.toFixed(2)}°`);

    // --- 4) Direği düzle, yükü rafın üstüne sür, indir ve bırak ---
    r.run(1.8, () => ({ crane: { luff: 0, telescope: -1, winch: 0 } }));
    iz('direk-duzeldi');
    r.runUntil(18, (x) => Math.abs(x.sahne.forklift.forkWorld.x - RAF_ON) < 0.06,
      (x) => x.suru(RAF_ON));
    r.run(1.0, () => ({ drive: { throttle: 0, handbrake: true } }));
    iz('rafin-onunde');
    // Yükü kirişin TAM ÜSTÜNE indir. Bir cm altına inmek yükü kirişin içine
    // sokuyor ve bırakınca solver onu dışarı fırlatıyordu (ölçüldü: palet
    // rafın 66 cm önüne düştü). Gerçekte de çatal paletin cebinde kaldığı
    // için palet kirişe oturduktan sonra çatal boşta iner.
    r.runUntil(12, (x) => x.sahne.forklift.liftM <= kot + 0.02,
      (x) => ({ ...x.kaldir(kot + 0.01), drive: { throttle: 0, handbrake: true } }));
    iz('indirildi');
    // Konumu BIRAKMA adımında yakala: 0.5 s durunca Mission görevi
    // tamamlıyor ve `load` bir sonraki palete geçiyor.
    r.sahne.step({ ...IDLE, toggleHook: true }, DT);
    r.mission.update(DT);
    r.t += DT;
    const p0 = r.sahne.load.getPosition();
    const kondu = { x: p0.x, y: p0.y };
    r.run(0.6, () => ({}));
    iz('birakildi');

    // --- 5) Çatalı çek ---
    r.runUntil(16, (x) => x.sahne.forklift.forkWorld.x < RAF_ON - 1.6,
      (x) => x.suru(RAF_ON - 1.8));
    r.runUntil(10, (x) => x.sahne.forklift.liftM <= FORKLIFT.minLiftM + 0.05,
      (x) => ({ ...x.kaldir(FORKLIFT.minLiftM), drive: { throttle: 0, handbrake: true } }));
    r.run(1.5, () => ({ drive: { throttle: 0, handbrake: true } }));

    const ok = r.mission.sonTamamlanan?.sira === n + 1;
    say(`${task.kod} KOY  yuk ${kondu.x.toFixed(2)},${kondu.y.toFixed(2)}`
      + `  hedef ${hedef.x.toFixed(2)},${(hedef.y + task.halfHeight).toFixed(2)}`
      + `  ${ok ? 'KONDU' : 'KONMADI'}`);
    if (ok) {
      const t = r.mission.sonTamamlanan;
      if (t) {
        say(`      +${t.puan.toplam} puan · sapma ${t.sapmaCm.toFixed(0)} cm`
          + ` · sure ${t.sure.toFixed(0)}s · maxLMI %${t.maxLmi.toFixed(0)}`);
      }
    } else {
      break;
    }
  }

  const s = r.mission.score;
  const res = r.mission.result;
  say('--- sonuc ---');
  say(`  tamamlanan ${s.sapmalar.length}/${FORKLIFT_TASKS.length}`
    + `  sure ${s.sure.toFixed(0)}s  puan ${s.puan}`
    + `  maxLMI %${s.maxLmi.toFixed(0)}  kirmizi ${s.kirmiziSn.toFixed(1)}s`
    + `  carpma ${s.carpma}`);
  say(`  devrilme payi: en az arka aks %${(r.enAzArka * 100).toFixed(0)}`
    + `  en cok egim ${r.enCokEgim.toFixed(2)}°`);
  if (res) say(`  not ${res.not} (${res.puan.toFixed(0)})  usta ${res.usta ? 'E' : 'H'}`);

  console.log(out.join('\n'));
  return s.sapmalar.length === FORKLIFT_TASKS.length ? 0 : 1;
}

const kod = main();
if (kod !== 0) {
  console.error('\nFORKLIFT BOLUMU BITIRILEMEDI');
  process.exit(kod);
}
