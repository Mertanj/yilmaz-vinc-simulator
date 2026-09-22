/**
 * Başsız forklift sürücüsü — `npm run sahne`'in ikinci yarısı.
 *
 * Vinç rigiyle aynı gerekçe: her karar ölçümle alınıyor. Burada ölçülen şey
 * bölümün OYNANABİLİR olması — beş palet de gözüne konabiliyor mu, hangi
 * görevde ibre nereye dayanıyor, devrilmeye ne kadar yaklaşılıyor. Biri bile
 * konmazsa sıfırdan farklı kodla çıkıyor, dolayısıyla CI bunu yakalıyor.
 *
 * **Yük alma artık tamamen fiziksel.** Rig de oyuncu gibi çalışıyor: çatalı
 * paletin cebi hizasına indiriyor, içeri sürüyor, kaldırıyor. Bir "tut"
 * komutu yok, dolayısıyla bu dosya aynı zamanda mekaniğin çalıştığının kanıtı.
 */
import { ForkliftSahnesi } from '../src/sim/forkliftSahne';
import { FORKLIFT, forkliftKapasitesi } from '../src/sim/forklift';
import {
  PALET_AYAK, RAF_DERINLIK, SEVKIYAT_KORIDORU,
} from '../src/game/forkliftTasks';
import { adresKotu, adresX, katAdi } from '../src/game/forkliftBolum';

/** Rig tek bir bolumu olcuyor: varsayilan depo. */
const B = SEVKIYAT_KORIDORU;
import { Mission } from '../src/game/mission';
import { IDLE, type SceneInput } from '../src/sim/scene';
import { SIM } from '../src/sim/world';

const DT = 1 / SIM.hz;

class Rig {
  readonly sahne = new ForkliftSahnesi();
  readonly mission = new Mission(this.sahne);
  t = 0;
  enAzArka = 1.5;
  enCokEgim = 0;
  enCokLmi = 0;
  enCokEgimHer = 0;
  egimAni = 0;
  /** Hangi aşamadayız — devrilme anını yakalamak için. */
  asama = '';
  devrilmeRaporu = '';

  run(sec: number, input: (r: Rig) => Partial<SceneInput>): void {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      this.sahne.step({ ...IDLE, ...input(this) }, DT);
      this.mission.update(DT);
      this.t += DT;
      if (Math.abs(this.sahne.tiltDeg) > Math.abs(this.enCokEgimHer)) {
        this.enCokEgimHer = this.sahne.tiltDeg;
        this.egimAni = this.t;
      }
      if (!this.devrilmeRaporu && Math.abs(this.sahne.tiltDeg) > 8) {
        const ff = this.sahne.forklift;
        this.devrilmeRaporu = `t=${this.t.toFixed(1)}s asama=${this.asama}`
          + ` egim=${this.sahne.tiltDeg.toFixed(1)}° kot=${ff.liftM.toFixed(2)}`
          + ` direk=${ff.tiltDeg.toFixed(1)}° x=${ff.chassis.getPosition().x.toFixed(2)}`
          + ` v=${ff.chassis.getLinearVelocity().x.toFixed(2)}`
          + ` catalda=${ff.hasLoad ? 'E' : 'H'}`
          + ` tip=${ff.forkTip.x.toFixed(2)},${ff.forkTip.y.toFixed(2)}`
          + ` topuk=${ff.forkWorld.x.toFixed(2)},${ff.forkWorld.y.toFixed(2)}`;
      }
      if (this.sahne.hasLoad) {
        this.enAzArka = Math.min(this.enAzArka, this.sahne.arkaAksPayi);
        this.enCokEgim = Math.max(this.enCokEgim, this.sahne.tiltDeg);
        const l = this.sahne.olcum.percent;
        if (Number.isFinite(l)) this.enCokLmi = Math.max(this.enCokLmi, l);
      }
    }
  }

  runUntil(maxSec: number, done: (r: Rig) => boolean,
           input: (r: Rig) => Partial<SceneInput>): boolean {
    for (let i = 0; i < Math.round(maxSec / DT); i++) {
      if (done(this)) return true;
      this.run(DT, input);
    }
    return done(this);
  }

  /**
   * Çatal topuğunu hedef x'e götüren sürüş.
   *
   * **Fren mesafesini hesaba katıyor.** Sadece oransal gaz verince makine 18
   * km/sa'ten hedefe dalıp paleti önüne katıyordu (ölçüldü: palet 69 cm
   * kaydı, çatal cebe hiç girmedi). Gerçek operatör de palete yaklaşırken
   * yavaşlar; rig de yavaşlıyor.
   */
  suru(hedefX: number, kazanc = 1.8): Partial<SceneInput> {
    const dx = hedefX - this.sahne.forklift.forkWorld.x;
    if (Math.abs(dx) < 0.03) return { drive: { throttle: 0, handbrake: true } };
    const v = this.sahne.forklift.chassis.getLinearVelocity().x;
    // Motor freniyle yavasla, el frenini son ana birak: sert fren yuku
    // bicagin ucuna dogru kaydiriyor (olculdu: 8 metrede 83 cm).
    const durmaMesafesi = (v * v) / (2 * 1.1);
    if (Math.sign(v) === Math.sign(dx) && durmaMesafesi > Math.abs(dx)) {
      return { drive: { throttle: 0, handbrake: Math.abs(v) < 0.4 } };
    }
    return {
      drive: { throttle: Math.max(-1, Math.min(1, dx / kazanc)), handbrake: false },
    };
  }

  /** Çatalı hedef kota götüren komut. */
  kaldir(hedefKot: number): Partial<SceneInput> {
    const e = hedefKot - this.sahne.forklift.liftM;
    if (Math.abs(e) < 0.015) return {};
    return { crane: { uzat: 0, luff: e > 0 ? 1 : -1, telescope: 0, winch: 0 } };
  }

  dur(): Partial<SceneInput> { return { drive: { throttle: 0, handbrake: true } }; }
}

const out: string[] = [];
const say = (s: string): void => { out.push(s); };

function main(): number {
  const r = new Rig();

  say('=== FORKLIFT: Depo, sevkiyat koridoru ===');
  say('--- calisma zarfi: hangi yuk hangi gozde ne okuyor? ---');
  for (const g of B.gorevler) {
    const kot = adresKotu(B, g.hedef);
    if (kot === undefined) continue;
    // Yuk merkezi olculuyor; catal tam dibe girerse halfWidth kadar olur.
    const alcak = forkliftKapasitesi(g.halfWidth, 0);
    const rafta = forkliftKapasitesi(g.halfWidth, kot + PALET_AYAK);
    say(`  ${g.kod}  ${g.ad.padEnd(16)} ${g.tonnes.toFixed(2)}t`
      + `  merkez ${g.halfWidth.toFixed(2)}m  kat ${katAdi(B, g.hedef)} (${kot.toFixed(2)}m)`
      + `  alcakta %${((g.tonnes / alcak) * 100).toFixed(0)}`
      + `  rafta %${((g.tonnes / rafta) * 100).toFixed(0)}`
      + `  pay ${((RAF_DERINLIK - g.halfWidth * 2) / 2).toFixed(2)}m`);
  }

  for (let n = 0; n < B.gorevler.length; n++) {
    const task = r.mission.task;
    const hedef = r.mission.target;
    if (!task || !hedef) break;
    const iz = (e: string): void => {
      if (!process.env['IZ']) return;
      const f = r.sahne.forklift;
      const l = r.sahne.load.getPosition();
      say(`   iz ${e.padEnd(14)} topuk ${f.forkWorld.x.toFixed(2)},${f.forkWorld.y.toFixed(2)}`
        + ` kot ${f.liftM.toFixed(2)} direk ${f.tiltDeg.toFixed(1)}°`
        + ` yuk ${l.x.toFixed(2)},${l.y.toFixed(2)} catalda ${f.hasLoad ? 'E' : 'H'}`
        + ` merkez ${f.loadCentreM.toFixed(2)}`);
    };

    // --- 1) Giris alanina git, catali cebin hizasina indir ---
    const cep = PALET_AYAK / 2;
    r.runUntil(12, (x) => Math.abs(x.sahne.forklift.liftM - cep) < 0.02,
      (x) => ({ ...x.kaldir(cep), ...x.dur() }));
    // Paletin 55 cm batisinda DURARAK bekle. Sadece "gecti mi" diye bakmak
    // yetmiyor: 18 km/sa'te fren mesafesi iki metre ve makine paleti onune
    // katip itiyordu (olculdu: palet 12 cm kaydi, catal hic girmedi).
    r.asama = 'gorev-basi'; iz('gorev-basi');
    // **Once bekleme cizgisinin BATISINA gec, palet insin.** Eskiden bu adim
    // yoktu ve palet ancak rig frenlerken cizgiyi kazara gectigi icin
    // iniyordu: dar paletin turunda yeterince savrulmayinca palet hic inmedi
    // ve gorev "alinamadi" sayildi. Gercek operator de mal kabulun onunu
    // acar, sonra yanasir.
    if (!r.sahne.paletHazir) {
      const bekle = B.beklemeCizgisi - FORKLIFT.forkLengthM - 0.25;
      r.runUntil(130, (x) => x.sahne.paletHazir, (x) => x.suru(bekle, 3.0));
      r.runUntil(12, (x) => x.sahne.paletHazir, (x) => x.dur());
    }
    const yaklas = r.sahne.load.getPosition().x - task.halfWidth - 0.75;
    // **Zaman aşımı 70 değil 130 saniye.** Depo üç adaya yayılınca en uzun
    // dönüş 19 metre oldu ve rig palete 16.48'de, hedefin 75 santim
    // uzağında yakalanıyordu: yük alınamıyor sanılıyordu, oysa süre
    // bitmişti. Rig bilerek yavaş sürüyor (frenleme payı bırakıyor), o
    // yüzden sınır mesafeyle birlikte büyümeli.
    r.runUntil(130, (x) => Math.abs(x.sahne.forklift.forkWorld.x - yaklas) < 0.05
      && x.sahne.forklift.speedKmh < 0.25,
      (x) => x.suru(yaklas, 4.0));
    r.run(1.0, (x) => x.dur());
    r.asama = 'cebe-sokma'; iz('cebin-onunde');

    // --- 2) Bicagi cebe sok ---
    // Topuk paletin BATI YUZUNE kadar gidiyor, daha ileri degil: daha ileri
    // surmek paleti sirtlikla itmek demek.
    const paletX = r.sahne.load.getPosition().x;
    const yakinYuz = paletX - task.halfWidth;
    r.runUntil(20, (x) => x.sahne.forklift.forkWorld.x >= yakinYuz - 0.04,
      (x) => x.suru(yakinYuz - 0.02, 0.6));
    r.run(0.8, (x) => x.dur());
    if (process.env['IZ']) {
      say(`   kapi tip=${r.sahne.forklift.forkTip.x.toFixed(2)}`
        + ` topuk=${r.sahne.forklift.forkWorld.x.toFixed(2)}`
        + ` yaklas=${yaklas.toFixed(2)} paletHazir=${r.sahne.paletHazir ? 'E' : 'H'}`
        + ` paletY=${r.sahne.load.getPosition().y.toFixed(2)}`);
    }
    say(`${task.kod} AL   durum ${r.sahne.forklift.durum(r.sahne.grabbables)}`
      + `  topuk ${r.sahne.forklift.forkWorld.x.toFixed(2)}`
      + `  palet ${r.sahne.load.getPosition().x.toFixed(2)}`);

    // --- 3) Kaldir: palet catalin ustunde yukseliyor. Tut komutu YOK. ---
    // Once paleti yerden kes, sonra TASIMA KOTUNA indir: yuklu makine
    // koridorda ilerlerken paletin ustu en alt kirisin altinda kalmali.
    r.runUntil(14, (x) => x.sahne.forklift.liftM >= 0.33,
      (x) => ({ ...x.kaldir(0.35), ...x.dur() }));
    // Direği geriye yatır: yük sırtlığa yaslansın.
    r.run(2.2, (x) => ({ crane: { uzat: 0, luff: 0, telescope: 1, winch: 0 }, ...x.dur() }));
    r.runUntil(10, (x) => x.sahne.forklift.liftM <= 0.38,
      (x) => ({ ...x.kaldir(0.35), ...x.dur() }));
    iz('tasima-kotunda');
    r.asama = 'tasima'; iz('kaldirildi');
    if (!r.sahne.hasLoad) {
      say(`${task.kod} ALINAMADI  (catalda yuk yok)`);
      break;
    }
    say(`      catalda ${r.sahne.olcum.loadTonnes.toFixed(2)}t`
      + `  olculen yuk merkezi ${r.sahne.forklift.loadCentreM.toFixed(2)}m`
      + `  (palet yarisi ${task.halfWidth.toFixed(2)}m)`);

    // --- 4) Gozun onune goturup kaldır ---
    const kot = adresKotu(B, task.hedef) ?? 0;
    const merkez = r.sahne.forklift.loadCentreM;
    // Yükü gözün ortasına koyacak çatal konumu.
    const konumX = hedef.x - merkez;
    // Kaldirmadan once gozun BATISINDA dur: bicak gozun icindeyken yukari
    // kaldirmak kirise dayaniyor (fizik dogru, ama once cekilmek gerekiyor).
    r.runUntil(110, (x) => Math.abs(x.sahne.forklift.forkWorld.x - (konumX - 2.0)) < 0.08
      && x.sahne.forklift.speedKmh < 0.8,
      (x) => x.suru(konumX - 2.0, 4.0));
    r.run(1.5, (x) => x.dur());
    // Palet kirişin üstüne AYAKLARIYLA oturuyor (ayak 0.22 m), dolayısıyla
    // bırakma kotu kot + 0.16. Yaklaşırken bundan 25 cm daha yukarıda
    // duruluyor: makine yük altında öne yatıyor ve paletin ön-alt köşesi
    // kirişin kenarına takılıyordu (ölçüldü: temas 21.29,1.85'te ve makine
    // tam gazda hiç ilerlemedi).
    const birakmaKot = kot + PALET_AYAK - FORKLIFT.bicakKalinligiM;
    const hedefKot = birakmaKot + 0.25;
    r.runUntil(26, (x) => Math.abs(x.sahne.forklift.liftM - hedefKot) < 0.04,
      (x) => ({ ...x.kaldir(hedefKot), ...x.dur() }));
    r.asama = 'gozun-onunde'; iz('kot-tuttu');
    say(`      GOZDE  kot ${r.sahne.forklift.liftM.toFixed(2)}m`
      + `  LMI %${Math.min(999, r.sahne.olcum.percent).toFixed(0)}`
      + `  arka aks %${(r.sahne.arkaAksPayi * 100).toFixed(0)}`
      + `  egim ${r.sahne.tiltDeg.toFixed(2)}°`);

    // --- 5) Direği düzle, yükü gözün üstüne sür, indir, geri çek ---
    r.run(2.0, (x) => ({ crane: { uzat: 0, luff: 0, telescope: -1, winch: 0 }, ...x.dur() }));
    r.runUntil(40, (x) => Math.abs(x.sahne.forklift.forkWorld.x - konumX) < 0.06,
      (x) => x.suru(konumX, 1.6));
    r.run(1.0, (x) => x.dur());
    r.asama = 'birakma'; iz('gozun-ustunde');
    // Önce paleti kirişe oturt, sonra bıçağı cepten çıkar.
    r.runUntil(18, (x) => x.sahne.forklift.liftM <= birakmaKot + 0.02,
      (x) => ({ ...x.kaldir(birakmaKot), ...x.dur() }));
    r.run(0.8, (x) => x.dur());
    const p0 = r.sahne.load.getPosition();
    const kondu = { x: p0.x, y: p0.y };
    // Bicak cepten cikacak kadar insin ama KIRISIN ALTINA inmesin: palet
    // kirisin 22 cm ustunde durdugu icin 6 cm yeter. Daha asagi inince bicak
    // kirisin icine giriyor ve geri cekilirken makine rafa takiliyor
    // (olculdu: makine 21.85'te kitlendi, catal 1.92 m'de asili kaldi).
    // Bicak cebin ORTASINDA kalmali. Kirise cok yaklasinca makine yuksuz
    // kalip geri yaslandiginda bicak kirisin ustune oturuyor, geri cekilirken
    // krikoya donusup makinenin burnunu kaldiriyordu (olculdu: bicak 4.77'de,
    // kiris ustu 4.75, makine dogu yonunde 1.7 m/s suruklendi).
    // Bicak cebin UST yarisinda cikiyor: yuku birakinca makine yuksuz kalip
    // geriye yasliyor ve bicak birkac santim dusuyor; cebin ortasinda cikmaya
    // calisinca kirisin USTUNE oturup krikoya donusuyordu (olculdu: bicak
    // 4.81'de, kiris ustu 4.90 -> makine 145 dereceye devrildi).
    r.runUntil(14, (x) => x.sahne.forklift.liftM <= kot + 0.28,
      (x) => ({ ...x.kaldir(kot + 0.26), ...x.dur() }));
    r.asama = 'cekilme'; iz('birakildi');
    // **Son gorevden sonra cekilme YOK.** Rig'in yapacak isi kalmiyor ve
    // puanlanan tur zaten kapandi; buna ragmen cekilme fazi kosuyordu ve
    // bicak goz kotundayken makine rafin onunde salinip kirise biniyor,
    // 145 dereceye deviriliyordu (olculdu: t=258s, bicak 4.80, kiris
    // 4.74-4.90). Sonuc satirlarini etkilemiyordu ama CI ciktisinda
    // olmayan bir devrilme raporluyordu.
    // Bıçağı çek.
    // Bicak gozun BATISINA tamamen cikana kadar cek. Kot degistirmeden
    // once bunu dogrulamak sart: bicak gozun icindeyken asagi inince
    // kirisin altina giriyor, makinenin burnunu kaldiriyor ve araba 45
    // derece sahlaniyordu (olculdu: t=120.2s, cekilme asamasi).
    // **Bu GÖREVİN adasının batısı**, ilk adanın değil. Eskiden sabit üç
    // adadan sadece birincisini gösteriyor; C adasına koyduktan sonra rig
    // bıçağı 4.36 metrede tutarak 12 metre batıya sürüyor, B adasının
    // kirişine dayanıp makineyi 145 dereceye deviriyordu.
    if (n === B.gorevler.length - 1) {
      r.run(1.0, (x) => x.dur());
      const ok0 = r.mission.sonTamamlanan?.sira === n + 1;
      say(`${task.kod} KOY  yuk ${kondu.x.toFixed(2)},${kondu.y.toFixed(2)}`
        + `  hedef ${hedef.x.toFixed(2)},${(hedef.y + task.halfHeight).toFixed(2)}`
        + `  ${ok0 ? 'KONDU' : 'KONMADI'}`);
      if (!ok0) break;
      const t0 = r.mission.sonTamamlanan;
      if (t0) {
        say(`      +${t0.puan.toplam} puan · sapma ${t0.sapmaCm.toFixed(0)} cm`
          + ` · sure ${t0.sure.toFixed(0)}s · maxLMI %${t0.maxLmi.toFixed(0)}`);
      }
      break;
    }
    const gozBati = (adresX(B, task.hedef) ?? (B.adaX[0] ?? 0)) - 0.3;
    // **Cikip DURANA kadar.** Sadece "cikti mi" diye bakmak yetmiyordu:
    // makine hedefi asip geri donerken bicak (hala goz kotunda) kirisin
    // ustune biniyor ve krikoya donusuyordu (olculdu: x=33.33, v=+2.02 m/s,
    // bicak 4.81'de, kiris alti 4.74 -> makine 145 dereceye devrildi).
    r.runUntil(40, (x) => x.sahne.forklift.forkTip.x < gozBati
      && x.sahne.forklift.speedKmh < 0.4,
      (x) => x.suru(gozBati - FORKLIFT.forkLengthM - 0.3, 1.2));
    r.run(0.8, (x) => x.dur());
    r.runUntil(14, (x) => x.sahne.forklift.liftM <= 0.4,
      (x) => ({ ...x.kaldir(0.35), ...x.dur() }));
    r.run(1.2, (x) => x.dur());

    const ok = r.mission.sonTamamlanan?.sira === n + 1;
    say(`${task.kod} KOY  yuk ${kondu.x.toFixed(2)},${kondu.y.toFixed(2)}`
      + `  hedef ${hedef.x.toFixed(2)},${(hedef.y + task.halfHeight).toFixed(2)}`
      + `  ${ok ? 'KONDU' : 'KONMADI'}`
      + (ok ? '' : `  [catalda ${r.sahne.hasLoad ? 'E' : 'H'}`
        + ` tol ${JSON.stringify(r.sahne.yerlestirmeToleransi(task))}]`));
    const t = r.mission.sonTamamlanan;
    if (ok && t) {
      say(`      +${t.puan.toplam} puan · sapma ${t.sapmaCm.toFixed(0)} cm`
        + ` · sure ${t.sure.toFixed(0)}s · maxLMI %${t.maxLmi.toFixed(0)}`);
    }
    if (!ok) break;
  }

  const s = r.mission.score;
  const res = r.mission.result;
  say('--- sonuc ---');
  say(`  tamamlanan ${s.sapmalar.length}/${B.gorevler.length}`
    + `  sure ${s.sure.toFixed(0)}s  puan ${s.puan}`
    + `  maxLMI %${s.maxLmi.toFixed(0)}  kirmizi ${s.kirmiziSn.toFixed(1)}s`
    + `  carpma ${s.carpma}`);
  say(`  devrilme payi: en az arka aks %${(r.enAzArka * 100).toFixed(0)}`
    + `  en cok egim ${r.enCokEgim.toFixed(2)}°`
    + `  en cok LMI %${Math.min(999, r.enCokLmi).toFixed(0)}`);
  say(`  DEVRILME: ${r.devrilmeRaporu || 'yok'}`);
  say(`  her an en buyuk egim ${r.enCokEgimHer.toFixed(2)}° (t=${r.egimAni.toFixed(1)}s)`);
  if (res) {
    // Ara sureler: speedrun karsilastirmasinin ham verisi.
  {
    const b = r.mission.score.bitisler;
    say(`  ara sureler ${b.map((x, i) => `${(x - (b[i - 1] ?? 0)).toFixed(0)}s`).join(' · ')}`);
  }
  say(`  not ${res.not} (${res.puan.toFixed(0)})  usta ${res.usta ? 'E' : 'H'}`
      + `  devrildi ${res.devrildi ? 'E' : 'H'}`);
  }
  void B.girisX; void FORKLIFT;

  console.log(out.join('\n'));
  return s.sapmalar.length === B.gorevler.length ? 0 : 1;
}

const kod = main();
if (kod !== 0) {
  console.error('\nFORKLIFT BOLUMU BITIRILEMEDI');
  process.exit(kod);
}
