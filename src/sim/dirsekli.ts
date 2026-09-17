import { Vec2, type Body, type World } from 'planck';
import type { Snapshotter } from './world';
import { Kanca, type Grabbable, type KancaAyari } from './kanca';
import { LmiZone, type LmiReading } from './loadChart';
import {
  DIRSEKLI_SPEC as S, dirsekNoktasi, dirsekliKapasitesi, kirmaYonuDeg, ucNoktasi,
} from './dirsekliGeometri';

/**
 * YV-9 dirsekli bom — iki eklemli, kamyon üstü vinç.
 *
 * **Teleskopik vinçten farkı tek cümlede:** düz bomun ucu her zaman bomun
 * doğrultusunda, dolayısıyla bir engelin üstünden aşıp arkasına inemez.
 * Burada ana bomu dikleştirip kırmayı aşağı katlayınca uç engelin ARKASINA
 * iniyor. Bölüm de bunun üstüne kuruluyor.
 *
 * **Yapı teleskopik vinçle aynı desende**, çünkü o desen ölçülerek oturdu:
 * bom parçaları KİNEMATİK ve her adımda `setTransform` ile sürülüyor; kanca
 * dinamik ve rijit halatla asılı; kinematik gövde kuvvet hissetmediği için
 * hem bomun kendi ağırlığı hem halattaki kuvvet şasiye ELLE uygulanıyor.
 * Devrilme ve yük momenti bu yüzden emergent kalıyor.
 *
 * **Katlanmanın momenti azaltması kendiliğinden çıkıyor:** her kolun ağırlığı
 * kendi merkezine uygulanıyor, dolayısıyla kırmayı içeri katlamak hem yükü
 * hem bomun kendi ağırlığını tablaya yaklaştırıyor. Ayrı bir kural yazmadık.
 */
export const DIRSEKLI = {
  ...S,
  /** Bom ayağının şasi yerel çerçevesindeki yeri. Kabinin arkasında. */
  pivot: new Vec2(-1.4, 1.05),
  /** Kolların kütlesi (t) — moment hesabına elle giriyor. */
  anaBomTon: 0.95,
  kirmaBomTon: 0.55,

  /** Halat: kancanın bom ucuna dayanma eşiği (m). */
  minHalatM: 0.5,
  maxHalatM: 12.0,
  /** Yol konumunda kanca bom ucuna toplanır. */
  yolHalatM: 0.9,

  hookThroatM: 0.34,
  attachCentreToleranceM: 0.42,
  attachBelowTopM: 0.6,
  attachAboveTopM: 1.5,
  attachMaxSpeedMps: 1.2,
  maxSidePullM: 0.6,
  slungAngularDamping: 6.0,
} as const;

const YOL_SONUM = 7.0;
const CALISMA_DOGRUSAL_SONUM = 0.4;
const CALISMA_ACISAL_SONUM = 0.05;

const KANCA_AYARI: KancaAyari = {
  kancaTon: DIRSEKLI.hookBlockTonnes,
  kancaAtalet: 40,
  yariEn: 0.22,
  yariBoy: 0.26,
  bogazM: DIRSEKLI.hookThroatM,
  baglanmaMaxHizMps: DIRSEKLI.attachMaxSpeedMps,
  maxYanCekmeM: DIRSEKLI.maxSidePullM,
  merkezToleransM: DIRSEKLI.attachCentreToleranceM,
  ustunAltiM: DIRSEKLI.attachBelowTopM,
  ustunUstuM: DIRSEKLI.attachAboveTopM,
  sapanAcisalSonum: DIRSEKLI.slungAngularDamping,
  yolSonum: YOL_SONUM,
  calismaDogrusalSonum: CALISMA_DOGRUSAL_SONUM,
  calismaAcisalSonum: CALISMA_ACISAL_SONUM,
};

/** Eklem komutları, -1..+1. */
export interface DirsekliInput {
  /** Ana bom: +1 kaldır. */
  ana: number;
  /** Kırma: +1 aç (düzleştir), -1 katla. */
  kirma: number;
  /** Kanca: +1 sar (yukarı). */
  winch: number;
}

export const DIRSEKLI_NEUTRAL: DirsekliInput = { ana: 0, kirma: 0, winch: 0 };

const clamp = (v: number, lo: number, hi: number): number =>
  (v < lo ? lo : v > hi ? hi : v);

export class Dirsekli {
  readonly anaBom: Body;
  readonly kirmaBom: Body;
  private readonly kanca: Kanca;

  /** Eklem durumu (derece) — kinematik gövdelere her adımda yazılıyor. */
  private anaDeg: number = S.anaMaxDeg;
  private kirmaDeg: number = S.kirmaMaxDeg;
  private halatM: number = DIRSEKLI.yolHalatM;
  private yolda = true;

  /** Bu adımda oyuncu kilitli bir kola bastı mı? */
  kilitliDenendi = false;
  /** Kanca bom ucuna dayandı mı? */
  ikiBlokta = false;

  private lmiTon = 0;

  constructor(world: World, private readonly chassis: Body, snaps: Snapshotter) {
    // Kinematik gövdeler: konumları her adımda eklem açılarından yazılıyor,
    // dolayısıyla kurulumda nereye konduklarının önemi yok — ilk adım
    // düzeltiyor. Yine de doğru yere koyuyoruz ki ilk kare sıçramasın.
    this.anaBom = world.createDynamicBody();
    this.anaBom.setKinematic();
    // **Uyku kapalı.** Kinematik gövdeyi setTransform ile sürmek planck'e
    // "hareket" gibi görünmüyor; zincir uyku eşiğinin altında sayılabiliyor.
    // Teleskopik vinçte bu tuzağa bir kez düşüldü (bağlanan yük hiç kalkmadı)
    // ve teşhisi pahalı oldu.
    this.anaBom.setSleepingAllowed(false);

    this.kirmaBom = world.createDynamicBody();
    this.kirmaBom.setKinematic();
    this.kirmaBom.setSleepingAllowed(false);

    this.govdeleriYerlestir();

    // Halat kırmanın UCUNDAN sarkıyor: yerel çerçevede kolun yarısı kadar
    // ileride, çünkü gövdenin merkezi kolun ortasında.
    this.kanca = new Kanca(
      world, snaps, KANCA_AYARI, this.kirmaBom,
      new Vec2(S.kirmaBoomM / 2, 0), this.halatM,
    );

    snaps.track(this.anaBom);
    snaps.track(this.kirmaBom);
  }

  get hook(): Body { return this.kanca.hook; }
  get anaAciDeg(): number { return this.anaDeg; }
  get kirmaAciDeg(): number { return this.kirmaDeg; }
  get halatBoyuM(): number { return this.halatM; }
  get hasLoad(): boolean { return this.kanca.yukVar; }
  get grabPoint(): { x: number; y: number } { return this.kanca.tutmaNoktasi; }
  get swingDeg(): number { return this.kanca.salinimDeg; }
  get tipWorld(): { x: number; y: number } { return this.kanca.ucDunya; }

  /** Tabla merkezinin dünyadaki yeri. */
  get tablaWorld(): { x: number; y: number } {
    const p = this.chassis.getWorldPoint(DIRSEKLI.pivot);
    return { x: p.x, y: p.y };
  }

  /**
   * Çalışma yarıçapı — tabla merkezinden uca yatay mesafe.
   *
   * **`pivotOffsetM` BURAYA EKLENMEZ.** Bir kez eklendi ve 35 cm şişirdi:
   * geometri modülünün `ucNoktasi` fonksiyonu x'i zaten tabla merkezinden
   * ölçüyor, yani ofset ucun içinde. Yol konumunda gerçek yarıçap 1.45 m
   * iken makine 1.80 m okuyordu — kapasite tablosu da o kadar yalan
   * söylüyordu. `npm run zarf` saf geometriyi kullandığı için ikisi
   * birbirini tutmuyordu; farkı ölçüm yakaladı, göz değil.
   *
   * `abs` duruyor: slew gelince uç tablanın arkasına geçebilir ve yarıçap
   * işaret değil MESAFE demek — negatif bir sayı kapasite formülüne girerse
   * tavan değeri döner, yani sessizce yalan söyler.
   */
  get radiusM(): number {
    return Math.abs(this.tipWorld.x - this.tablaWorld.x);
  }

  attachCheck(adaylar: Grabbable[]): ReturnType<Kanca['baglanmaDenetimi']> {
    return this.kanca.baglanmaDenetimi(adaylar);
  }
  canAttach(adaylar: Grabbable[]): boolean { return this.kanca.baglanabilir(adaylar); }
  requestToggleAttach(): void { this.kanca.baglaBirakIste(); }
  flushJointQueue(adaylar: Grabbable[]): void {
    this.kanca.mafsalKuyrugunuBosalt(adaylar);
  }

  setStowed(stowed: boolean): void {
    if (stowed === this.yolda) return;
    this.yolda = stowed;
    this.kanca.yolKonumu(stowed);
  }

  /**
   * Her fizik adımında, world.step()'ten ÖNCE.
   *
   * Aşırı yükte yarıçapı BÜYÜTEN hareketler kilitli: ana bomu indirmek ve
   * kırmayı açmak. Küçültenler (kaldır, katla) her zaman serbest — çıkış yolu
   * onlar. Teleskopik vinçteki kuralın aynısı; orada oyuncuyu kapana kısmamak
   * için ölçülerek konmuştu.
   */
  update(input: DirsekliInput, dt: number, lmi: LmiReading): void {
    this.kilitliDenendi = false;
    if (this.yolda) {
      // Yol konumu: bom katlı ve kanca toplu.
      this.anaDeg += clamp(S.anaMaxDeg - this.anaDeg, -1, 1) * S.anaHizDegPerSec * dt * 3;
      this.kirmaDeg += clamp(S.kirmaMaxDeg - this.kirmaDeg, -1, 1)
        * S.kirmaHizDegPerSec * dt * 3;
      this.halatM += clamp(DIRSEKLI.yolHalatM - this.halatM, -1, 1) * 2 * dt;
      this.govdeleriYerlestir();
      this.kanca.halatiAyarla(this.halatM);
      return;
    }

    const kilit = lmi.blockRadiusIncrease;
    const olcek = lmi.speedScale;

    // Ana bomu İNDİRMEK yarıçapı büyütüyor.
    let ana = input.ana;
    if (kilit && ana < 0) { ana = 0; this.kilitliDenendi = true; }
    // Kırmayı AÇMAK (düzleştirmek) da yarıçapı büyütüyor.
    let kirma = input.kirma;
    if (kilit && kirma > 0) { kirma = 0; this.kilitliDenendi = true; }

    this.anaDeg = clamp(
      this.anaDeg + ana * S.anaHizDegPerSec * olcek * dt, S.anaMinDeg, S.anaMaxDeg,
    );
    // Kırma açısı ters: komutun +1'i "aç" demek, açı ise KÜÇÜLÜRKEN açılıyor.
    this.kirmaDeg = clamp(
      this.kirmaDeg - kirma * S.kirmaHizDegPerSec * olcek * dt,
      S.kirmaMinDeg, S.kirmaMaxDeg,
    );

    // Halat: kanca bom ucuna dayanınca sarmak kilitli (iki-blok).
    const hedefHalat = this.halatM - input.winch * S.winchSpeedMps * olcek * dt;
    this.ikiBlokta = hedefHalat <= DIRSEKLI.minHalatM;
    if (this.ikiBlokta && input.winch > 0) this.kilitliDenendi = true;
    this.halatM = clamp(hedefHalat, DIRSEKLI.minHalatM, DIRSEKLI.maxHalatM);

    this.govdeleriYerlestir();
    this.kanca.halatiAyarla(this.halatM);
  }

  /** Kinematik kolları eklem açılarından konumlandırır. */
  private govdeleriYerlestir(): void {
    const taban = this.chassis.getWorldPoint(DIRSEKLI.pivot);
    const sasiAci = this.chassis.getAngle();
    const durum = { anaDeg: this.anaDeg, kirmaDeg: this.kirmaDeg };

    // Yerel geometri tabla merkezine göre; şasi eğimini üstüne bindiriyoruz.
    const ana = (this.anaDeg * Math.PI) / 180 + sasiAci;
    const ayak = {
      x: taban.x + S.pivotOffsetM * Math.cos(sasiAci),
      y: taban.y + S.pivotOffsetM * Math.sin(sasiAci),
    };
    this.anaBom.setTransform({
      x: ayak.x + (S.anaBoomM / 2) * Math.cos(ana),
      y: ayak.y + (S.anaBoomM / 2) * Math.sin(ana),
    }, ana);

    const d = dirsekNoktasi(durum);
    const dirsekDunya = this.yereldenDunyaya(d, taban, sasiAci);
    const kirmaAci = (kirmaYonuDeg(durum) * Math.PI) / 180 + sasiAci;
    this.kirmaBom.setTransform({
      x: dirsekDunya.x + (S.kirmaBoomM / 2) * Math.cos(kirmaAci),
      y: dirsekDunya.y + (S.kirmaBoomM / 2) * Math.sin(kirmaAci),
    }, kirmaAci);
  }

  /** Tabla merkezine göre verilmiş noktayı dünyaya taşır. */
  private yereldenDunyaya(
    p: { x: number; y: number }, taban: { x: number; y: number }, aci: number,
  ): { x: number; y: number } {
    // Geometri modülü y'yi ZEMİNDEN ölçüyor; tabla merkezi de zeminden
    // `pivotHeightM` yukarıda, o yüzden farkı alıyoruz.
    const dx = p.x;
    const dy = p.y - S.pivotHeightM;
    return {
      x: taban.x + dx * Math.cos(aci) - dy * Math.sin(aci),
      y: taban.y + dx * Math.sin(aci) + dy * Math.cos(aci),
    };
  }

  /**
   * Bom ağırlıklarını ve halat kuvvetini şasiye aktarır.
   * **world.step()'ten ÖNCE, update()'ten sonra.**
   */
  applyToWorld(dt: number): void {
    const merkez = (g: Body): { x: number; y: number } => {
      const p = g.getWorldCenter();
      return { x: p.x, y: p.y };
    };
    const agirlik = (t: number): number => t * 1000 * 9.81;

    if (this.yolda) {
      // **Yol konumunda bom yatağa oturur.**
      //
      // Gerçek makinede bom katlanıp kasanın üstündeki mesnede yaslanır;
      // ağırlığı tabla ile mesnet arasında paylaşılır ve araç yolda düz durur.
      // Modellemeyince ölçüldü ve sonuç netti: kamyon SÜRERKEN kendi kendine
      // takla atıyor. Sebep bom parçalarının fikstürü olmaması — ağırlık
      // momenti üretiyor ama hiçbir şey dönmeyi durdurmuyor, araç 180 dereceye
      // kadar dönüp duruyordu (ölçümde 0.25 saniyede 2.1°, 3 saniyede 29.3°).
      //
      // Yatak devredeyken ağırlığı doğrudan şasi ağırlık merkezine bindiriyoruz:
      // moment sıfır, araç düz. Ayaklar inip çalışma moduna geçince bom
      // yataktan kalkar ve aşağıdaki gerçek moment devreye girer.
      this.chassis.applyForce(
        { x: 0, y: -agirlik(DIRSEKLI.anaBomTon + DIRSEKLI.kirmaBomTon) },
        this.chassis.getWorldCenter(), true,
      );
    } else {
      // Her kolun ağırlığı KENDİ merkezine: katlamak momenti kendiliğinden
      // azaltıyor, ayrıca bir kural gerekmiyor.
      this.chassis.applyForce(
        { x: 0, y: -agirlik(DIRSEKLI.anaBomTon) }, merkez(this.anaBom), true,
      );
      this.chassis.applyForce(
        { x: 0, y: -agirlik(DIRSEKLI.kirmaBomTon) }, merkez(this.kirmaBom), true,
      );
    }

    const f = this.kanca.halatKuvveti(dt);
    if (f) this.chassis.applyForce({ x: -f.x, y: -f.y }, this.tipWorld, true);
  }

  /**
   * Halat kuvvetinden LMI. **world.step()'ten SONRA.**
   *
   * Teleskopik vinçteki sebebin aynısı: sarkaç salınırken gerilim statik
   * ağırlığın üstüne çıkıyor, statik yükle hesaplanan bir LMI yalan söyler.
   */
  sampleLmi(dt: number): void {
    const f = this.kanca.halatKuvveti(dt);
    const ham = f ? Math.hypot(f.x, f.y) / 9810 : 0;
    this.lmiTon += (ham - this.lmiTon) * Math.min(1, dt / 0.25);
  }

  get lmi(): LmiReading {
    const r = this.radiusM;
    const kap = dirsekliKapasitesi(r);
    const yuk = Math.max(0, this.lmiTon);
    const percent = kap <= 0 ? Infinity : (yuk / kap) * 100;
    const zone = percent > 100 ? LmiZone.Red : percent >= 80 ? LmiZone.Amber : LmiZone.Green;
    return {
      percent, zone,
      capacityTonnes: kap, chartTonnes: kap, ropeTonnes: kap, limitedBy: 'tablo',
      loadTonnes: yuk, radiusM: r,
      speedScale: zone === LmiZone.Red ? 0.3 : zone === LmiZone.Amber ? 0.6 : 1,
      blockRadiusIncrease: zone === LmiZone.Red,
    };
  }

  /** Tablo dışı mı — uç makinenin erişemeyeceği kadar uzakta. */
  get tabloDisi(): boolean { return this.radiusM > S.maxYaricapM; }

  /** Ucun dünyadaki yeri, geometri modülünün beklediği yerel biçimde. */
  get ucYerel(): { x: number; y: number } {
    return ucNoktasi({ anaDeg: this.anaDeg, kirmaDeg: this.kirmaDeg });
  }
}
