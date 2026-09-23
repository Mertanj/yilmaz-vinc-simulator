/**
 * Dirsekli bom bölümünün başsız sürücüsü — `npm run sahne:dirsekli`.
 *
 * Vinç ve forklift riglerinin aynısı: tarayıcı açmadan bölümün TAMAMINI oynar
 * ve sayıları yazdırır. Birinci bölümde asıl sorduğu soru şu: park edilen
 * yerden her hedefe ulaşılıyor mu, yük bahçe duvarını aşıyor mu, ve LMI eğrisi
 * tasarlandığı gibi mi çıkıyor? İkinci bölümde (kasa yükleme) soru zarfın İKİ
 * ucu: palet en uzakta alınıyor, ilk sıra kolonun dibine konuyor.
 *
 * İki bölüm de her seferinde koşuyor; `BOLUM=sokak|kasa` biriyle sınırlar.
 */
import { DirsekliSahne } from '../src/sim/dirsekliSahne';
import { IDLE, type SceneInput } from '../src/sim/scene';
import { Ret } from '../src/sim/ret';
import { SIM } from '../src/sim/world';
import { AVLU, DAR_SOKAK, avluHedefleri } from '../src/sim/avlu';
import { KASA_YUKLEME, YUKLEME } from '../src/sim/kasaYukleme';
import { KASA_TABANI, type DirsekliBolum } from '../src/sim/dirsekliBolum';
import { TRUCK } from '../src/sim/truck';
import { Vec2 } from 'planck';
import { dirsekliCozum, dirsekliKapasitesi, DIRSEKLI_SPEC as S } from '../src/sim/dirsekliGeometri';
import { DIRSEKLI } from '../src/sim/dirsekli';
import { Mission } from '../src/game/mission';
import { DIRSEKLI_GOREVLER } from '../src/game/dirsekliGorevler';

const DT = 1 / SIM.hz;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

class Rig {
  readonly scene: DirsekliSahne;
  readonly mission: Mission;
  t = 0;
  etiket = 'baslangic';
  zirve = { lmi: 0, t: 0, etiket: '', R: 0, ton: 0 };
  /** ÖN pabucun payı: bu makine kuyruk üstünden çalışıyor, boşalan ön pabuç. */
  pabuc = { enAz: 1, lmi: 0, etiket: '', enCok: 0 };
  enCokEgim = { deg: 0, t: 0 };
  /** Yuk duvarin uzerinden gecerken alt yuzunun duvara payi (m). */
  duvarPayi = -99;
  yukYariBoy = 0;
  /** Kurulum bitti mi — pabuç ve eğim ölçümleri ancak ondan sonra anlamlı. */
  gorevBasladi = false;

  constructor(readonly bolum: DirsekliBolum = DAR_SOKAK) {
    this.scene = new DirsekliSahne(bolum);
    this.mission = new Mission(this.scene);
  }

  run(seconds: number, input: (r: Rig) => Partial<SceneInput>): void {
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i++) {
      this.scene.step({ ...IDLE, ...input(this) }, DT);
      this.mission.update(DT);
      this.t += DT;
      // **Sadece görev sürerken örnekleniyor.** Ayaklar açılırken pabuçlar
      // birkaç saniye sırayla yere basıyor ve pay o sırada 0'dan 100'e
      // geziniyor; o değerler makinenin devrilme payı hakkında hiçbir şey
      // söylemiyor, sadece kurulum geçişi. İlk ölçümde "en az %0.0" yazıp
      // göstergeyi anlamsız kılan buydu.
      const pay = this.gorevBasladi && this.scene.calismaModunda
        ? this.scene.outriggers.pabucPayi('on') : null;
      if (pay !== null) {
        if (pay < this.pabuc.enAz) {
          this.pabuc = { ...this.pabuc, enAz: pay, lmi: this.scene.olcum.percent,
            etiket: this.etiket };
        }
        if (pay > this.pabuc.enCok) this.pabuc.enCok = pay;
      }
      const l = this.scene.olcum;
      if (Number.isFinite(l.percent) && l.percent > this.zirve.lmi) {
        this.zirve = { lmi: l.percent, t: this.t, etiket: this.etiket,
          R: l.radiusM, ton: l.loadTonnes };
      }
      const e = Math.abs(this.scene.tiltDeg);
      if (this.gorevBasladi && e > this.enCokEgim.deg) {
        this.enCokEgim = { deg: e, t: this.t };
      }
      // Duvar gecisi HER karede olculuyor. Once yalnizca tasima dongusunun
      // icinde olculuyordu ve hic yakalanmadi: dongu ucun x'ine bakip
      // cikiyor, yuk ise arkadan geliyor ve duvari dongu bittikten SONRA,
      // sarkac dururken asiyor.
      if (this.bolum === DAR_SOKAK && this.scene.hasLoad) {
        const l = this.scene.load.getPosition();
        if (l.x >= AVLU.duvarSol && l.x <= AVLU.duvarSag) {
          this.duvarPayi = Math.max(this.duvarPayi, l.y - this.yukYariBoy - AVLU.duvarY);
        }
      }
    }
  }

  runUntil(maxSec: number, done: (r: Rig) => boolean,
    input: (r: Rig) => Partial<SceneInput>): boolean {
    const steps = Math.round(maxSec / DT);
    for (let i = 0; i < steps; i++) {
      if (done(this)) return true;
      this.run(DT, input);
    }
    return done(this);
  }

  tap(key: 'toggleOutriggers' | 'toggleHook', settle: number): void {
    this.scene.step({ ...IDLE, [key]: true }, DT);
    this.mission.update(DT);
    this.t += DT;
    this.run(settle, () => ({}));
  }

  /**
   * Bom ucunu dünyadaki (tx, ty) noktasına götüren komutlar.
   *
   * **Tek eksenli kovalama bu makinede çalışmıyor** (geometri modülündeki
   * `dirsekliCozum` notu): iki eklem ucu zıt yönlerde yükseltiyor. Çözüm
   * analitik, kovalama ise oransal — bang-bang sürüş rijit halat üstünden
   * yüke darbe olarak geçiyordu, vinçte de aynısı ölçülmüştü.
   *
   * Hedef erişilemezse HEDEFİ ALÇALTARAK en yakın çözümü arıyor; uydurulmuş
   * bir açıyla sürmek sessizce yanlış yere giderdi.
   */
  ucaSur(tx: number, ty: number): { luff: number; telescope: number; uzat: number } {
    const b = this.scene.bom;
    const yerel = b.dunyadanYerele({ x: tx, y: ty });
    let c = dirsekliCozum(yerel);
    for (let dy = 0.25; !c && dy <= 8; dy += 0.25) {
      c = dirsekliCozum({ x: yerel.x, y: yerel.y - dy });
    }
    if (!c) return { luff: 0, telescope: 0, uzat: 0 };
    const band = (e: number, k: number): number => clamp(e / k, -1, 1);
    return {
      luff: band(c.anaDeg - b.anaAciDeg, 3.0),
      // Kırma komutu TERS: +1 "aç" demek ve açı KÜÇÜLÜRKEN açılıyor.
      telescope: band(b.kirmaAciDeg - c.kirmaDeg, 4.0),
      uzat: band(c.uzamaM - b.uzamaBoyuM, 0.4),
    };
  }

  /**
   * Aynı servo, ama kanca ucun altından kaçtıkça yavaşlıyor.
   *
   * Sönümsüz hâli ölçüldü: yük 52 dereceye savruluyor, salınım halat
   * gerilimini statiğin üstüne çıkarıyor, LMI %129'a vurup yarıçap kilidini
   * açıyor — ve kilit tam da hedefe GİTMEK için gereken hareketleri kesiyor.
   * Rig 40 saniye kilide karşı sürüp görevi tamamlayamadı. Vinç riginde aynı
   * tuzağa düşülmüş ve çözümü de aynı olmuştu.
   */
  ucaSurSonumlu(tx: number, ty: number): { luff: number; telescope: number; uzat: number } {
    const b = this.scene.bom;
    const uc = b.tipWorld;
    const h = b.hook.getPosition();
    const kayma = Math.hypot(h.x - uc.x, uc.y - h.y - b.halatBoyuM);
    const kazanc = Math.max(0.10, Math.min(1, 1 - kayma / 0.8));
    const s = this.ucaSur(tx, ty);
    return {
      luff: s.luff * kazanc, telescope: s.telescope * kazanc, uzat: s.uzat * kazanc,
    };
  }

  /**
   * Geri geri cebe yanaş: kaba yaklaş, sonra kısa darbelerle otur.
   */
  parkEt(parkX: number): void {
    // **Durdu mu? SÜREKLİ durmus olmali.** Tek kare "hiz ~0" okumak yetmiyor:
    // suspansiyon salinimi hizi bir karede sifirdan geciriyor ve olcum kamyonu
    // takoza degmeden once "parkti" sayabiliyor.
    // **Fiziksel takoz yok (bkz. AVLU.parkX), o yuzden rig de oyuncu gibi cebe
    // BAKARAK duruyor — ve yakinsamasi gerekiyor.**
    //
    // Ilk hali "cebin 2.2 m oncesinde gazi kes" diyordu ve frenleme mesafesi
    // son konumu belirliyordu: `parkX` 30 santim degisince arac 58 santim
    // baska yerde durdu, butun yaricaplar kaydi ve gorev yuzdeleri bozuldu
    // (S5 %97 yerine %103, yani tablo disi). Simdi kaba yaklasip sonra kisa
    // darbelerle oturuyor; gercek operator de son yarim metreyi boyle alir.
    this.runUntil(40, (rig) => rig.scene.truck.chassis.getPosition().x <= parkX + 3.5,
      () => ({ drive: { throttle: -1, handbrake: false } }));
    this.runUntil(20, (rig) => Math.abs(rig.scene.truck.chassis.getLinearVelocity().x) < 0.05,
      () => ({ drive: { throttle: 0, handbrake: true } }));
    for (let i = 0; i < 24; i++) {
      if (this.scene.truck.chassis.getPosition().x <= parkX + 0.15) break;
      this.run(0.22, () => ({ drive: { throttle: -1, handbrake: false } }));
      this.runUntil(6, (rig) => Math.abs(rig.scene.truck.chassis.getLinearVelocity().x) < 0.04,
        () => ({ drive: { throttle: 0, handbrake: true } }));
    }
  }

  /**
   * Hedefin ERİŞİLEBİLEN hâli: erişilemiyorsa aynı x'te alçaltılmış kot.
   *
   * `ucaSur` zaten böyle arıyor ama bulduğu kotu söylemiyordu; döngünün çıkış
   * şartı hayal edilen hedefe bakınca uç oraya hiç varamıyor ve rig süreyi
   * bitirip pes ediyordu. Kasa bölümünde palet zarfın en uzağında: orada
   * 4.5 metrelik kot her zaman yok.
   */
  ulasilir(tx: number, ty: number): { x: number; y: number } {
    const b = this.scene.bom;
    for (let dy = 0; dy <= 8; dy += 0.25) {
      if (dirsekliCozum(b.dunyadanYerele({ x: tx, y: ty - dy }))) return { x: tx, y: ty - dy };
    }
    return { x: tx, y: ty };
  }

  /** Halatı hedef boya süren oransal komut. +1 sarıyor (kısaltıyor). */
  halata(hedefM: number): number {
    return clamp((this.scene.bom.halatBoyuM - hedefM) / 0.6, -1, 1);
  }

  /**
   * Teleskobu acarken halat payi birakan vinc komutu.
   *
   * Teleskop artik halat yiyor (dirsekli.ts'teki iki-blok notu): uzama d metre
   * artinca serbest halat d metre kisaliyor ve iki-blok bolgesinde uzatma
   * KILITLI. Gercek operator teleskobu acarken ayni anda vinci salar; rig de
   * salmali, yoksa yuksek hedefe hic erisemiyor.
   *
   * Sadece uzatma ISTENDIGINDE devreye giriyor. Uzatma bitince hedef halat
   * neyse ona donuyor, yani tasima halati yine kisa kaliyor ve yuk terasin
   * hizasinda sallanmiyor.
   */
  halataUzatmali(hedefM: number, uzat: number): number {
    if (uzat <= 0) return this.halata(hedefM);
    // **Pay KUCUK ve sabit, kalan uzamanin tamami degil.**
    //
    // Once kalan uzamanin tamami pesinen salindi (3.8 m) ve rig S3'un
    // ALMASINDA kirildi: kanca 57 dereceye savruldu, yukun 1.64 m yanina
    // dustu, yan-cekme. Dogrusu servo: teleskop 0.55 m/s yiyor, vinc 1.0 m/s
    // salabiliyor, yani ufak bir pay tutmak yetiyor ve halat hic iki-blok
    // bolgesine girmiyor. Operatorun yaptigi da bu — pesinen degil, ACTIKCA.
    // Pay SADECE esigin uzerinde kalmaya yetecek kadar. 0.30 denendi ve S5'i
    // kirdi: halat 0.86'ya cikiyor, 1.24 m boyundaki beton kovasi terasin
    // korkuluguna takilip 57 dereceye devriliyor ve orada kaliyor. Teleskop
    // 0.55 m/s yiyor, vinc 1.0 m/s saliyor — servo 10 santimle de esigin
    // uzerinde kaliyor.
    const gereken = DIRSEKLI.minHalatM + DIRSEKLI.ikiBlokPayiM + 0.10;
    return this.halata(Math.max(hedefM, gereken));
  }

  /** Uç hedefine ne kadar yakın (m)? */
  ucHatasi(tx: number, ty: number): number {
    const u = this.scene.bom.tipWorld;
    return Math.hypot(u.x - tx, u.y - ty);
  }

  /** Kanca ucun altında düşeyden ne kadar sapmış (m)? */
  get sarkacKaymasi(): number {
    const u = this.scene.bom.tipWorld;
    const h = this.scene.bom.hook.getPosition();
    return Math.abs(h.x - u.x);
  }

  /**
   * Sarkaç dursun.
   *
   * **Gerçek operatörün beklediği yerde rig de bekliyor.** Beklemeyince iki
   * ayrı yerde patladı: yükü savururken bırakmak LMI'yi %173'e vuruyordu, ve
   * bir sonraki görevde kanca ucun 1.68 m gerisinde sallanırken makine
   * bağlanmayı haklı olarak "yan çekme" diye reddediyordu. Sönüm düşük
   * (0.4) — salınım oyunun asıl becerisi olduğu için bastırılmıyor — o yüzden
   * durulma saniyeler sürüyor.
   */
  dur(maxSec = 25, esik = 0.10): void {
    this.runUntil(maxSec, (rig) => rig.sarkacKaymasi < esik
      && Math.abs(rig.scene.bom.hook.getLinearVelocity().x) < 0.08,
      () => ({ crane: { uzat: 0, luff: 0, telescope: 0, winch: 0 } }));
  }
}

const out: string[] = [];
const say = (s: string): void => { out.push(s); };

/**
 * İKİ SESSİZ BAŞARISIZLIĞIN ARTIK SESSİZ OLMADIĞINI ÖLÇER.
 *
 * İkisi de oynanabilirlik hatasıydı, fizik hatası değil: oyuncu bir düğmeye
 * basıyordu, makine kötü bir şey yapıyordu ve hiçbir şey söylenmiyordu.
 *
 *  1. Havadaki yükü bırakmak — yük düşüyor, belki bir çarpma yazıyor, belki
 *     hedefin yanına saçılıyor. Oyuncu puanının neden düştüğünü bilmiyor.
 *  2. Yük kancadayken ayakları toplamak — `calismaModunda` düşüyor, bom yol
 *     konumuna katlanıyor ve asılı yükü yanında sürüklüyor.
 *
 * Denetim rigin içinde duruyor çünkü ikisi de ancak GERÇEK bir turun ortasında,
 * yük havadayken kurulabilen bir durum; birim testi bunu kuramaz.
 */
function kilitleriDenetle(r: Rig): void {
  // Yükü yerden kes: iki kilit de yalnız yük havadayken devreye giriyor.
  r.runUntil(12, (rig) => !rig.scene.bom.yukOturdu,
    () => ({ crane: { uzat: 0, luff: 0, telescope: 0, winch: 1 } }));
  r.run(0.5, () => ({}));
  const havada = r.scene.hasLoad && !r.scene.bom.yukOturdu;

  r.tap('toggleHook', 0.2);
  const birakUyari = r.scene.uyari();
  const birakOk = r.scene.hasLoad && birakUyari !== null;

  const ayakOnce = r.scene.outriggers.stageIndex;
  r.tap('toggleOutriggers', 0.2);
  const ayakUyari = r.scene.uyari();
  const ayakOk = r.scene.outriggers.stageIndex === ayakOnce && ayakUyari !== null;

  say(`KILIT  yuk havada ${havada ? 'E' : 'H'}`
    + `  ·  birak reddedildi ${birakOk ? 'E' : 'H'} "${birakUyari?.bas ?? '-'}"`
    + `  ·  ayak reddedildi ${ayakOk ? 'E' : 'H'} "${ayakUyari?.bas ?? '-'}"`);
  if (!havada || !birakOk || !ayakOk) {
    throw new Error(`kilit denetimi kaldi: havada=${havada}`
      + ` birak=${birakOk} ayak=${ayakOk}`);
  }
  // Reddin 3.5 saniyelik seridi sonraki olcumleri kirletmesin.
  r.run(Ret.SURE, () => ({}));
}

function darSokakTuru(): boolean {
  const r = new Rig(DAR_SOKAK);
  say('=== BOLUM 1 · dar sokak ===');

  // --- 1) geri geri takoza yanaş, ayakları aç ---
  r.etiket = 'park';
  r.parkEt(AVLU.parkX);
  const sasiX = r.scene.truck.chassis.getPosition().x;
  say(`PARK  sasi x ${sasiX.toFixed(2)} (cep ${AVLU.parkX}±${AVLU.parkPayiM})`
    + `  tabla ${r.scene.bom.tablaWorld.x.toFixed(2)} (tasarim ${AVLU.tablaX})`
    + `  egim ${r.scene.tiltDeg.toFixed(2)}°`);
  r.tap('toggleOutriggers', 3);
  r.tap('toggleOutriggers', 6);
  say(`AYAK  %${(r.scene.outriggers.fraction * 100).toFixed(0)}`
    + ` (${r.scene.outriggers.state})  egim ${r.scene.tiltDeg.toFixed(2)}°`
    + `  on pabuc payi %${((r.scene.outriggers.pabucPayi('on') ?? 0) * 100).toFixed(0)}`);

  // --- 2) park edilen yerden calisma zarfi ---
  const tabla = r.scene.bom.tablaWorld.x;
  say('--- calisma zarfi (park edilen yerden) ---');
  say(`  malzeme  x ${AVLU.malzemeX}  R ${(tabla - AVLU.malzemeX).toFixed(2)} m`
    + `  kap ${dirsekliKapasitesi(tabla - AVLU.malzemeX).toFixed(2)} t`);
  say(`  duvar    x ${AVLU.duvarSol}–${AVLU.duvarSag}  y ${AVLU.duvarY} m`
    + `  R ${(tabla - AVLU.duvarSag).toFixed(2)}–${(tabla - AVLU.duvarSol).toFixed(2)} m`);
  avluHedefleri().forEach((h, i) => {
    const R = tabla - h.x;
    const kap = dirsekliKapasitesi(R);
    const detay = DIRSEKLI_GOREVLER.filter((g) => g.hedef === i)
      .map((g) => `${g.kod} %${(((g.tonnes + S.hookBlockTonnes) / kap) * 100).toFixed(0)}`)
      .join(' ');
    say(`  hedef${i}   x ${h.x.toFixed(2)} y ${h.y.toFixed(1)}  R ${R.toFixed(2)} m  kap ${kap.toFixed(2)} t`
      + `   ${detay || '(gorev yok)'}`);
  });

  // --- 3) gorevleri sirayla oyna ---
  r.gorevBasladi = true;
  for (let n = 0; n < DIRSEKLI_GOREVLER.length; n++) {
    const task = r.mission.task;
    const hedef = r.mission.target;
    if (!task || !hedef) break;
    r.etiket = `${task.kod}-alma`;
    const yukX = r.scene.load.getPosition().x;
    // Uc yukun ustunde: yuk boyu + kanca payi kadar yukarida dursun ki halat
    // salinca kanca tam bogazina gelsin.
    const almaUcY = task.halfHeight * 2 + 3.2;

    const iz = (etiket: string): void => {
      if (!process.env['IZ']) return;
      const b = r.scene.bom;
      const l = r.scene.load.getPosition();
      say(`   iz ${etiket.padEnd(12)} ana ${b.anaAciDeg.toFixed(0)}° kirma ${b.kirmaAciDeg.toFixed(0)}°`
        + ` uc ${b.tipWorld.x.toFixed(2)},${b.tipWorld.y.toFixed(2)} halat ${b.halatBoyuM.toFixed(2)}`
        + ` kanca ${b.hook.getPosition().x.toFixed(2)},${b.hook.getPosition().y.toFixed(2)}`
        + ` yuk ${l.x.toFixed(2)},${l.y.toFixed(2)}`
        + ` aci ${((r.scene.load.getAngle() * 180) / Math.PI).toFixed(0)}°`
        + ` hiz ${r.scene.load.getLinearVelocity().y.toFixed(2)}`
        + ` bagli ${b.hasLoad ? 'E' : 'H'}`
        + ` R ${b.radiusM.toFixed(2)} LMI %${Math.min(999, r.scene.olcum.percent).toFixed(0)}`);
    };

    // --- ALMA ---
    // Once kancayi topla: onceki gorevden asagida kalmis olabilir ve bom
    // donerken duvara surunur.
    iz('alma-basi');
    r.runUntil(12, (rig) => rig.scene.bom.halatBoyuM < 0.7,
      () => ({ crane: { uzat: 0, luff: 0, telescope: 0, winch: 1 } }));
    // Ucu yukun ustune getir, halat kisa kalsin.
    r.runUntil(60, (rig) => rig.ucHatasi(yukX, almaUcY) < 0.15,
      // **Almaya YAKLASIRKEN pay YOK, halat kisa.** Denendi ve kirildi: uzatma
      // payi burada halati 1.15'e cikariyor, kanca bahce duvarinin harpustasina
      // oturuyor ve orada kaliyor — `dur()` 25 saniye bekleyip pes ediyor,
      // sonra yan-cekme. Bu yolda zaten uzatma degil KISALTMA gerekiyor
      // (yerlestirme pozundan R 4.54, malzeme R 2.57), yani payin isi yok.
      (rig) => ({ crane: { ...rig.ucaSur(yukX, almaUcY), winch: rig.halata(0.6) } }));
    r.dur();
    iz('uc-yukun-ustunde');
    // **Halati, bogaz yukun ust yuzune DEGENE kadar sal.**
    //
    // Once yalnizca `canAttach` bekleniyordu ve dongu daha ilk karede cikiyordu:
    // bagli olma esigi yukun 1.5 m ustune kadar izin veriyordu, halat hic
    // salinmadan bagliyordu. Mafsal oraya kurulunca yukun agirlik merkezi pimin
    // 1.45 m altinda kaliyor, yuk sarkac gibi surukleniyor ve duvari asamiyordu.
    // Makinenin esigi de duzeltildi (attachAboveTopM 1.5 -> 0.6); rig artik
    // ayrica bogazin kotunu da bekliyor.
    const yukUstu = (): number => r.scene.load.getPosition().y + task.halfHeight;
    r.runUntil(30, (rig) => rig.scene.bom.grabPoint.y <= yukUstu() + 0.10
        && rig.scene.bom.canAttach(rig.scene.grabbables),
      (rig) => ({ crane: { uzat: 0, luff: 0, telescope: 0,
        winch: rig.halata(rig.scene.bom.tipWorld.y - yukUstu() - DIRSEKLI.hookThroatM) } }));
    r.run(1.5, () => ({}));
    iz('kanca-indi');
    const denetim = r.scene.bom.attachCheck(r.scene.grabbables);
    r.tap('toggleHook', 1.0);
    // **Pimin yuke gore yeri OLCULUYOR, varsayilmiyor.**
    //
    // Mafsal kancanin bogazina, yukun o andaki yuksekliginde kuruluyor; aradaki
    // fark sapancinin kancayi tam nereye indirdigine bagli, sabit degil.
    // "Pim yukun ust yuzundedir" varsayimi denendi ve yuk her seferinde 24 cm
    // yukarida asili kaldi — sonra birakilinca dusuyordu.
    const pimOfset = r.scene.hasLoad
      ? r.scene.bom.grabPoint.y - r.scene.load.getPosition().y
      : task.halfHeight;
    say(`${task.kod} AL   durum ${denetim.reason}  bagli ${r.scene.hasLoad ? 'E' : 'H'}`
      + `  merkez farki ${Math.abs(r.scene.bom.grabPoint.x - r.scene.load.getPosition().x).toFixed(2)} m`);

    if (n === 0) kilitleriDenetle(r);

    // --- TASIMA ---
    r.etiket = `${task.kod}-tasima`;
    // Yuku kaldir ve duvari asacak kota cik. Gecis kotu: duvar + yuk + halat
    // + pay. Ucu once AYNI yaricapla yukselt, sonra disari goturuyoruz —
    // yatay once gidilirse yuk duvara carpiyor.
    // **Tasima halati hedefe gore kisaliyor.** Yuksek ve uzak bir hedefte ucun
    // cikabildigi kot sinirli; sabit 1 metrelik halat yuku tam terasin
    // hizasinda sallandiriyor. Gercek operator de yuku yukari tasirken kancayi
    // kisa tutar. Alt hedeflerde uzun halat daha sakin bir sarkac veriyor.
    const tasimaHalat = hedef.y > 4 ? 0.6 : 1.0;
    // Duvar gecisi ve TERAS gecisi ayri iki kot: hedef yukselince asilacak
    // engel duvar degil, terasin korkulugu oluyor.
    //
    // **Teras payi 1.0 m, 0.6 degil.** 0.6 kagit uzerinde yetiyordu ama uc
    // eklem uzayinda gidiyor ve yolun ortasinda 35 santim ALCALIYOR: S3'te
    // yuk alt katin korkuluguna takildi, 25 saniye onun ustunde donup 154
    // dereceye devrildi, sonra kayip halati silkti (LMI %118). S1'de de ayni
    // takilma 140 saniye yiyordu. Rijit halat ikisini de gizliyordu — yuku
    // korkulugun ustunden iterek geciriyordu. 1.0 ile tur 910 s'den 511'e indi.
    const gecisY = AVLU.duvarY + task.halfHeight * 2 + tasimaHalat + 0.8;
    const terasY = hedef.y + AVLU.korkulukY + task.halfHeight * 2 + tasimaHalat + 1.0;

    // **Once DUVARIN USTUNE, sonra avluya.** Iki ayri tuzak var ve ikisi de
    // olculdu:
    //
    // 1. "Ayni yaricapta dikey kaldir, sonra yatay gotur" olmuyor. Malzemenin
    //    yaricapinda (R 2.9) uc gereken kota hic cikmiyor — zarf haritasinin
    //    deligi orada. Makine yukselmek icin ayni zamanda DISARI gitmeli.
    // 2. Kaldirmayi ve tasimayi tek hamlede birlestirmek de olmuyor: yuk
    //    ucun gerisinden geliyor ve daha yeterince yukselmeden duvarin
    //    hizasina variyor. Olcumde yuk duvara carpti, halat gerilimi statigin
    //    2.5 katina firladi, LMI %156'ya cikti — ve %100'un ustunde yaricap
    //    BUYUTEN hareketler kilitli oldugu icin rig avluya hic gecemedi,
    //    141 saniye kirmizida cakili kaldi.
    //
    // Cozum ikisinin ortasi: uc once DUVARIN USTUNE gidiyor (o yaricap
    // haritada var), yuk arkadan gelip yukselirken orada bekliyor, ve avluya
    // gecis ancak yukun ALT YUZU duvari astiktan sonra basliyor.
    r.duvarPayi = -99;
    r.yukYariBoy = task.halfHeight;
    const duvarX = (AVLU.duvarSol + AVLU.duvarSag) / 2;
    r.runUntil(50, (rig) => rig.scene.load.getPosition().y - task.halfHeight
        > AVLU.duvarY + 0.45,
      (rig) => {
        const k = rig.ucaSurSonumlu(duvarX, gecisY);
        return { crane: { ...k, winch: rig.halataUzatmali(tasimaHalat, k.uzat) } };
      });
    iz('duvarin-ustunde');
    // **Once TIRMAN, sonra iceri gir.** Duvari astiktan sonra dogrudan hedefe
    // surmek olmuyor: yuk ucun gerisinden geliyor ve daha yukselmeden binanin
    // yuzune variyor. Olcumde S3'te yuk ust katin cephesine (x 5.0) bastirdi,
    // halat gerilimi 8.05 tona cikti (LMI %612) ve rig 139 saniye kirmizida
    // kaldi. Tirmanma yaricapi binanin ONUNDE, avlu zemininin ustunde.
    const tirmanX = AVLU.evSagKenar + 0.7;
    // Asilacak engel hedefe ait: en ust damda korkuluk YOK, oradaki esigi
    // korkuluk boyu kadar yuksek tutmak yukun hic inmemesine yol aciyordu.
    const korkuluk = hedef.y >= AVLU.katYuksekligi * AVLU.katSayisi ? 0 : AVLU.korkulukY;
    const asmaKotu = hedef.y + korkuluk + task.halfHeight + 0.25;
    r.runUntil(60, (rig) => rig.scene.load.getPosition().y > asmaKotu,
      (rig) => {
        const k = rig.ucaSurSonumlu(tirmanX, Math.max(gecisY, terasY));
        return { crane: { ...k, winch: rig.halataUzatmali(tasimaHalat, k.uzat) } };
      });
    iz('tirmandi');

    // **Cikis sarti UCUN degil YUKUN konumu.**
    //
    // Once ucun x'ine bakiyordu ve yuk halatin ucunda geriden geliyor: uc
    // hedefe varinca yuk hala 1.15 metre saginda kaliyor, sonra halat
    // salindiginda yuk terasin KORKULUGUNUN ustune oturuyordu (olcumde
    // yuk 6.60,3.71 — korkuluk tepesi 3.65). Gercek sart iki parcali:
    // yuk hedefin ustunde OLACAK ve korkulugu asmis olacak.
    r.runUntil(90, (rig) => {
      const l = rig.scene.load.getPosition();
      return Math.abs(l.x - hedef.x) < 0.22 && l.y > asmaKotu;
    }, (rig) => {
        const k = rig.ucaSurSonumlu(hedef.x, Math.max(gecisY, terasY));
        return { crane: { ...k, winch: rig.halataUzatmali(tasimaHalat, k.uzat) } };
      });
    r.dur();
    say(`${task.kod} GEC  duvar payi ${r.duvarPayi < -90 ? '—'
      : r.duvarPayi.toFixed(2) + ' m'}  (duvar ${AVLU.duvarY} m)`);
    iz('duvari-asti');

    // --- KOYMA ---
    r.etiket = `${task.kod}-koyma`;
    const koymaUcY = hedef.y + task.halfHeight * 2 + korkuluk + 0.6;
    r.runUntil(40, (rig) => rig.ucHatasi(hedef.x, koymaUcY) < 0.20,
      (rig) => {
        const k = rig.ucaSurSonumlu(hedef.x, koymaUcY);
        return { crane: { ...k, winch: rig.halataUzatmali(tasimaHalat, k.uzat) } };
      });
    r.dur();
    iz('koyma-ustunde');
    // Halati usulca sal: yuk hedefe otursun. Hedef halat boyu ucun kotundan
    // hesaplaniyor, sabit degil — yoksa yuksek hedefte yuk havada asili kaliyor.
    // Cikis sarti YUKUN OTURMASI, hedefe yakinlik degil. Once "hedef kotunun
    // 12 cm yakini + dusey hiz 0.05'ten kucuk" deniyordu ve rig yuku 11 cm
    // havada birakip cozuyordu: hiz sifira yakin cunku yuk asili duruyor.
    // Asili yuk artik cozulemiyor (Kanca.yukOturdu), yani ayni hata oyuncunun
    // da basina geliyordu — rig onu goremiyordu, cunku ayni yalani olcuyordu.
    //
    // **Oturma SÜREKLİ olmalı** (kasa turundaki gerekçe): halat artık
    // gevşeyebiliyor, yani bir an değip kalkan yük "oturdu" sayılıp halat
    // durunca havada asılı kalıyordu — bırakma reddediliyor, görev bitmiyor.
    // Rijit halatta bu görünmüyordu çünkü halat yükü tahtaya bastırıyordu.
    let sonIz = 0;
    let oturmaSn = 0;
    r.runUntil(30, () => oturmaSn >= 0.4,
      (rig) => {
        if (process.env['IZ'] && rig.t - sonIz > 2) { sonIz = rig.t; iz('   iniyor'); }
        oturmaSn = rig.scene.bom.yukOturdu ? oturmaSn + DT : 0;
        return { crane: { uzat: 0, luff: 0, telescope: 0,
          winch: rig.halata(rig.scene.bom.tipWorld.y
            - (hedef.y + task.halfHeight + pimOfset + DIRSEKLI.hookThroatM) + 0.04) } };
      });
    r.run(1.0, () => ({}));
    // Konum BIRAKMADAN once okunuyor: mafsal cozulunce Mission gorevi kabul
    // edip yeni yuku malzeme alanina doguruyor, `scene.load` de onu gosteriyor.
    // Once oyle yazildi ve rig 43 cm'lik bir yerlestirmeyi 251 cm diye raporladi.
    const p = r.scene.load.getPosition();
    const l = { x: p.x, y: p.y };
    r.tap('toggleHook', 2.0);
    const sapma = Math.hypot(l.x - hedef.x, l.y - (hedef.y + task.halfHeight));
    say(`${task.kod} KOY  yuk ${l.x.toFixed(2)},${l.y.toFixed(2)}`
      + `  hedef ${hedef.x.toFixed(2)},${(hedef.y + task.halfHeight).toFixed(2)}`
      + `  sapma ${(sapma * 100).toFixed(0)} cm`);
    // Gorev kabulunu bekle.
    r.runUntil(12, (rig) => rig.mission.task !== task, () => ({}));
    const ok = r.mission.sonTamamlanan;
    const sk = r.mission.score;
    if (ok && ok.sira === sk.sapmalar.length) {
      say(`      ONAY: ${ok.kod} ${ok.ad} · sapma ${ok.sapmaCm.toFixed(0)} cm`
        + ` · maxLMI %${ok.maxLmi.toFixed(0)} · sure ${ok.sure.toFixed(0)}s · kalan ${ok.kalan}`);
    }
    say(`      tamamlanan ${sk.sapmalar.length}/${DIRSEKLI_GOREVLER.length}`
      + `  maxLMI %${sk.maxLmi.toFixed(0)}  kirmizi ${sk.kirmiziSn.toFixed(1)}s`
      + `  salinim ${sk.maxSalinim.toFixed(0)}°  carpma ${sk.carpma}`);
    if (r.mission.task === task) { say(`      ${task.kod} KABUL EDILMEDI`); break; }
  }

  return sonuc(r, DIRSEKLI_GOREVLER.length);
}

/** Turun özeti — iki bölümde aynı satırlar, karşılaştırılabilsin. */
function sonuc(r: Rig, gorevSayisi: number): boolean {
  const res = r.mission.result;
  const sk = r.mission.score;
  say('--- sonuc ---');
  say(`  LMI zirvesi %${r.zirve.lmi.toFixed(0)} · ${r.zirve.etiket} · t=${r.zirve.t.toFixed(0)}s`
    + `  R ${r.zirve.R.toFixed(2)}m  yuk ${r.zirve.ton.toFixed(2)}t`);
  say(`  on pabuc payi: en az %${(r.pabuc.enAz * 100).toFixed(1)}`
    + `  en cok %${(r.pabuc.enCok * 100).toFixed(1)}`
    + `  (en az iken LMI %${r.pabuc.lmi.toFixed(0)} · ${r.pabuc.etiket})`);
  say(`  en cok egim ${r.enCokEgim.deg.toFixed(2)}° (t=${r.enCokEgim.t.toFixed(1)}s)`
    + `  devrildi ${r.scene.devrildiMi ? 'E' : 'H'}  carpma ${r.scene.carpma}`);
  // Ara sureler: speedrun karsilastirmasinin ham verisi. Kumulatif saklaniyor,
  // parca suresi iki kumulatifin farki.
  const b = r.mission.score.bitisler;
  say(`  ara sureler ${b.map((x, i) => `${(x - (b[i - 1] ?? 0)).toFixed(0)}s`).join(' · ')}`
    + `   kumulatif ${b.map((x) => x.toFixed(0)).join(' · ')}`);
  say(`  faz ${r.mission.phase}  tamamlanan ${sk.sapmalar.length}/${gorevSayisi}`
    + `  sure ${sk.sure.toFixed(0)}s  puan ${sk.puan}  not ${res?.not ?? '-'}`
    + ` (${res?.puan.toFixed(0) ?? '-'})  usta ${res?.usta ? 'E' : 'H'}`);
  return sk.sapmalar.length === gorevSayisi;
}

/**
 * Bölüm 2 — kasa yükleme: depo avlusundaki beş paleti kendi kasana.
 *
 * Birinci bölümün tersine burada uç YUKARI değil İÇERİ çalışıyor: palet
 * zarfın en uzağında (kolona 8.4 m) alınıyor ve ilk sıra kolonun 1.3 m
 * dibine konuyor. Rig her sıranın öndekiyle arasında kalan boşluğu da
 * yazıyor — bölümün dersi sıkı istif, ve hedef bir öncekinin GERÇEK yerine
 * dayandığı için rigin kendi hatası birikiyor mu, burada görünüyor.
 */
function kasaTuru(): boolean {
  const r = new Rig(KASA_YUKLEME);
  const G = KASA_YUKLEME.gorevler;
  say('=== BOLUM 2 · kasa yukleme ===');

  // --- 1) yanas, ayaklari ac, paleti bekle ---
  r.etiket = 'park';
  const depodaydi = r.scene.yukDepoda;
  r.parkEt(YUKLEME.parkX);
  say(`PARK  sasi x ${r.scene.truck.chassis.getPosition().x.toFixed(2)}`
    + ` (cep ${YUKLEME.parkX}±${YUKLEME.parkPayiM})`
    + `  tabla ${r.scene.bom.tablaWorld.x.toFixed(2)}  egim ${r.scene.tiltDeg.toFixed(2)}°`);
  r.tap('toggleOutriggers', 3);
  r.tap('toggleOutriggers', 6);
  // Palet ancak makine kurulup ayaklarin ustunde durulunca geliyor.
  const geldi = r.runUntil(10, (rig) => !rig.scene.yukDepoda, () => ({}));
  say(`AYAK  %${(r.scene.outriggers.fraction * 100).toFixed(0)}`
    + ` (${r.scene.outriggers.state})  egim ${r.scene.tiltDeg.toFixed(2)}°`
    + `  palet ${depodaydi ? 'depodaydi' : 'DEPODA DEGILDI'} -> ${geldi ? 'karede' : 'GELMEDI'}`);
  if (!depodaydi || !geldi) return false;

  // --- 2) park edilen yerden calisma zarfi ---
  const tabla = r.scene.bom.tablaWorld.x;
  const sasi = r.scene.truck.chassis;
  const H = TRUCK.chassisHalfHeight + KASA_TABANI;
  const kasaUstu = sasi.getWorldPoint(new Vec2(0, H)).y;
  const onX = sasi.getWorldPoint(new Vec2(YUKLEME.kasaOn, H)).x;
  const arkaX = sasi.getWorldPoint(new Vec2(YUKLEME.kasaArka, H)).x;
  const kare = r.scene.load.getPosition().x;
  const kapKare = dirsekliKapasitesi(tabla - kare);
  say('--- calisma zarfi (park edilen yerden) ---');
  say(`  kare     x ${kare.toFixed(2)}  R ${(tabla - kare).toFixed(2)} m`
    + `  kap ${kapKare.toFixed(2)} t   ${G.map((g) =>
      `${g.kod} %${(((g.tonnes + S.hookBlockTonnes) / kapKare) * 100).toFixed(0)}`).join(' ')}`);
  say(`  kasa     x ${arkaX.toFixed(2)}–${onX.toFixed(2)}  taban y ${kasaUstu.toFixed(2)}`
    + `  R ${(tabla - onX).toFixed(2)}–${(tabla - arkaX).toFixed(2)} m`);

  // --- 3) gorevleri sirayla oyna ---
  r.gorevBasladi = true;
  const TASIMA_HALAT = 0.6;
  for (let n = 0; n < G.length; n++) {
    const task = r.mission.task;
    const hedef = r.mission.target;
    if (!task || !hedef) break;
    const iz = (etiket: string): void => {
      if (!process.env['IZ']) return;
      const b = r.scene.bom;
      const l = r.scene.load.getPosition();
      say(`   iz ${etiket.padEnd(14)} ana ${b.anaAciDeg.toFixed(0)}° kirma ${b.kirmaAciDeg.toFixed(0)}°`
        + ` uzama ${b.uzamaBoyuM.toFixed(2)}`
        + ` uc ${b.tipWorld.x.toFixed(2)},${b.tipWorld.y.toFixed(2)} halat ${b.halatBoyuM.toFixed(2)}`
        + ` yuk ${l.x.toFixed(2)},${l.y.toFixed(2)}`
        + ` aci ${((r.scene.load.getAngle() * 180) / Math.PI).toFixed(0)}°`
        + ` bagli ${b.hasLoad ? 'E' : 'H'}`
        + ` R ${b.radiusM.toFixed(2)} LMI %${Math.min(999, r.scene.olcum.percent).toFixed(0)}`);
    };

    // --- ALMA ---
    r.etiket = `${task.kod}-alma`;
    const yukX = r.scene.load.getPosition().x;
    const yukUstu = (): number => r.scene.load.getPosition().y + task.halfHeight;
    // Gecis kotu: yukun tabani kasa tabaninin 50 cm ustunde.
    const gecisY = kasaUstu + 0.5 + task.halfHeight * 2 + TASIMA_HALAT + DIRSEKLI.hookThroatM;
    r.runUntil(12, (rig) => rig.scene.bom.halatBoyuM < 0.7,
      () => ({ crane: { uzat: 0, luff: 0, telescope: 0, winch: 1 } }));
    // Once YUKARI, sonra disari: kasadaki paletlerin ustunden gecerken uc
    // eklem uzayinda alcalabiliyor.
    const yukari = r.ulasilir(r.scene.bom.tipWorld.x, gecisY);
    r.runUntil(30, (rig) => rig.ucHatasi(yukari.x, yukari.y) < 0.15,
      (rig) => ({ crane: { ...rig.ucaSur(yukari.x, yukari.y), winch: rig.halata(TASIMA_HALAT) } }));
    const alma = r.ulasilir(yukX, gecisY);
    r.runUntil(60, (rig) => rig.ucHatasi(alma.x, alma.y) < 0.15,
      (rig) => ({ crane: { ...rig.ucaSur(alma.x, alma.y), winch: rig.halata(TASIMA_HALAT) } }));
    r.dur();
    iz('uc-yukun-ustunde');
    r.runUntil(30, (rig) => rig.scene.bom.grabPoint.y <= yukUstu() + 0.10
        && rig.scene.bom.canAttach(rig.scene.grabbables),
      (rig) => ({ crane: { uzat: 0, luff: 0, telescope: 0,
        winch: rig.halata(rig.scene.bom.tipWorld.y - yukUstu() - DIRSEKLI.hookThroatM) } }));
    r.run(1.5, () => ({}));
    iz('kanca-indi');
    const denetim = r.scene.bom.attachCheck(r.scene.grabbables);
    r.tap('toggleHook', 1.0);
    const pimOfset = r.scene.hasLoad
      ? r.scene.bom.grabPoint.y - r.scene.load.getPosition().y
      : task.halfHeight;
    say(`${task.kod} AL   R ${(tabla - yukX).toFixed(2)} m  uc y ${alma.y.toFixed(2)}`
      + ` (istenen ${gecisY.toFixed(2)})  durum ${denetim.reason}  bagli ${r.scene.hasLoad ? 'E' : 'H'}`);
    if (!r.scene.hasLoad) break;

    // --- TASIMA ---
    r.etiket = `${task.kod}-tasima`;
    // Once DIKEY: uc yukun ustunde durup halati sariyor, yuk sallanmadan kalkar.
    r.runUntil(30, (rig) => rig.scene.bom.halatBoyuM <= TASIMA_HALAT + 0.05,
      (rig) => ({ crane: { uzat: 0, luff: 0, telescope: 0, winch: rig.halata(TASIMA_HALAT) } }));
    iz('kalkti');
    // Kuyrugun onunde bekle: yukun tabani kasa tabaninin ustune cikmadan
    // kasanin hizasina girmesin.
    const kuyruk = r.ulasilir(arkaX - task.halfWidth - 0.4, gecisY);
    r.runUntil(40, (rig) => rig.scene.load.getPosition().y - task.halfHeight > kasaUstu + 0.3
        && rig.ucHatasi(kuyruk.x, kuyruk.y) < 0.2,
      (rig) => ({ crane: { ...rig.ucaSurSonumlu(kuyruk.x, kuyruk.y), winch: rig.halata(TASIMA_HALAT) } }));
    iz('kuyrukta');

    // --- KOYMA ---
    r.etiket = `${task.kod}-koyma`;
    // Nisan hedefin 3 cm GERISI: salinan yuk ondekinin kenarina binmesin.
    const nisanX = hedef.x - 0.03;
    const ust = r.ulasilir(nisanX, gecisY);
    r.runUntil(60, (rig) => rig.ucHatasi(ust.x, ust.y) < 0.03,
      (rig) => ({ crane: { ...rig.ucaSurSonumlu(ust.x, ust.y), winch: rig.halata(TASIMA_HALAT) } }));
    // **YÜKÜN kendisi dursun, kanca değil.** `dur()` kancaya bakıyor ve
    // kanca yükün tepesine pimli: yük pimin etrafında dönerken kanca durmuş
    // görünüyor. Öyle çıkınca yük 20 cm/s'yle geri salınırken indi ve her
    // palet hedefinin 17 santim gerisine, kuyruğa doğru oturdu — sıkı istif
    // dersinin tam tersi.
    r.runUntil(30, (rig) => {
      const y = rig.scene.load;
      return Math.abs(y.getPosition().x - ust.x) < 0.03
        && Math.abs(y.getLinearVelocity().x) < 0.03 && Math.abs(y.getAngularVelocity()) < 0.05;
    }, (rig) => ({ crane: { ...rig.ucaSur(ust.x, ust.y), winch: rig.halata(TASIMA_HALAT) } }));
    iz('koyma-ustunde');
    // **Oturma SÜREKLİ olmalı, tek kare değil.** Yük hafif eğik iniyor ve
    // alçak köşesi tahtaya bir an değip kalkıyor; o an "oturdu" sayılıp halat
    // durunca yük 4 cm havada asılı kaldı ve bırakma haklı olarak reddedildi.
    let oturmaSn = 0;
    r.runUntil(30, () => oturmaSn >= 0.4, (rig) => {
      oturmaSn = rig.scene.bom.yukOturdu ? oturmaSn + DT : 0;
      return { crane: { uzat: 0, luff: 0, telescope: 0,
        winch: rig.halata(rig.scene.bom.tipWorld.y
          - (hedef.y + task.halfHeight + pimOfset + DIRSEKLI.hookThroatM) + 0.04) } };
    });
    r.run(1.0, () => ({}));
    iz('oturdu');
    // Konum BIRAKMADAN once: kabulde yeni palet doguyor ve `scene.load` onu gosteriyor.
    const p = r.scene.load.getPosition();
    const l = { x: p.x, y: p.y, aci: (r.scene.load.getAngle() * 180) / Math.PI };
    r.tap('toggleHook', 2.0);
    r.runUntil(12, (rig) => rig.mission.task !== task, () => ({}));
    // Dersin olcusu: ondeki palete (ya da on duvara) kalan bosluk.
    const onceki = n > 0 ? r.scene.kasadakiler[n - 1] : undefined;
    const bosluk = onceki
      ? onceki.body.getPosition().x - onceki.task.halfWidth - (l.x + task.halfWidth)
      : onX - (l.x + task.halfWidth);
    const ok = r.mission.sonTamamlanan;
    const tamam = ok !== null && ok.sira === n + 1;
    say(`${task.kod} KOY  yuk ${l.x.toFixed(2)},${l.y.toFixed(2)}`
      + `  hedef ${hedef.x.toFixed(2)},${(hedef.y + task.halfHeight).toFixed(2)}`
      + `  ${onceki ? 'ondekine' : 'on duvara'} ${(bosluk * 100).toFixed(0)} cm`
      + `  aci ${l.aci.toFixed(1)}°  ${tamam ? 'KONDU' : 'KONMADI'}`);
    if (!tamam) {
      const q = r.scene.load.getPosition();
      const v = r.scene.load.getLinearVelocity();
      const h = r.mission.target;
      say(`      [kancada ${r.scene.hasLoad ? 'E' : 'H'}  yuk ${q.x.toFixed(2)},${q.y.toFixed(2)}`
        + `  hiz ${Math.hypot(v.x, v.y).toFixed(2)}  hedef ${h ? `${h.x.toFixed(2)},${h.y.toFixed(2)}` : '-'}`
        + `  uyari "${r.scene.uyari()?.bas ?? '-'}"]`);
    }
    if (tamam && ok) {
      say(`      +${ok.puan.toplam} puan · sapma ${ok.sapmaCm.toFixed(0)} cm`
        + ` · maxLMI %${ok.maxLmi.toFixed(0)} · sure ${ok.sure.toFixed(0)}s`);
    }
    if (!tamam) break;
  }
  return sonuc(r, G.length);
}

// **Iki bolum de her seferinde kosuyor**: biri bitemezse CI kirmizi. Ikisi
// ayni makineyi paylasiyor ve kasa bolumu kolonu baska yere koydu; birinin
// duzeltmesi otekini sessizce bozabilir.
const sadece = process.env['BOLUM'];
const sonuclar: Array<[string, boolean]> = [];
if (!sadece || sadece === 'sokak') sonuclar.push(['sokak', darSokakTuru()]);
if (!sadece || sadece === 'kasa') sonuclar.push(['kasa', kasaTuru()]);
console.log(out.join('\n'));
const kalan = sonuclar.filter(([, ok]) => !ok).map(([id]) => id);
if (kalan.length > 0) {
  console.error(`\nDIRSEKLI BOLUMU BITIRILEMEDI: ${kalan.join(', ')}`);
  process.exit(1);
}
