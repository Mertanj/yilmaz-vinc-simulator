import {
  Box, Circle, WheelJoint, PrismaticJoint, RevoluteJoint, Vec2,
  type Body, type World, type WheelJoint as WhJ,
  type PrismaticJoint as PJ, type RevoluteJoint as RJ,
} from 'planck';
import { KATEGORI, MASKE, TRUCK_GROUP, type Snapshotter } from './world';
import type { DriveInput } from '../input/kumanda';
import type { Grabbable } from './crane';

/**
 * Karşı ağırlıklı forklift.
 *
 * **Yük mafsalla değil, KİNEMATİK olarak taşınıyor.** Önce WeldJoint denendi ve
 * makineyi takla attırdı (eğim −180°, arka teker 1.5 metre havada): taşıyıcı
 * zaten kinematik olduğu için yükü her adım setTransform ile yerine koyuyoruz,
 * mafsal da aynı anda kendi kısıtını dayatıyor ve ikisi birbiriyle kavga
 * ediyordu. Vinçteki bomun deseni burada da doğru: tek denetim, ağırlık şasiye
 * elle uygulanıyor, devrilme yine solverdan çıkıyor.
 *
 * **Neden üçüncü araç olarak bu seçildi:** yük tablosu mantığı vinçle birebir
 * aynı (moment / izin verilen moment), ama devrilme ekseni ÖN AKS ve araç
 * lastik üstünde duruyor — yani vinçte ayaklar yüzünden erişilemeyen devrilme
 * burada gerçekten oluyor. Aynı fiziğin başka bir yüzü, yeni bir motor değil.
 *
 * Fizik düzeni:
 *
 *   şasi --WheelJoint--> tekerler          sürüş ve süspansiyon
 *   direk: şasinin ön ucunda, kendi eğimi   (kinematik değil, şasiye bağlı açı)
 *   taşıyıcı: direk üstünde yükseklik       (kendi durumumuz)
 *   çatal --WeldJoint--> yük                 yükleme
 *
 * Taşıyıcı ve direk bom gibi KİNEMATİK: hidrolik silindir yük altında
 * çökmüyor. Yükün ağırlığı şasiye elle uygulanıyor (applyForce), böylece
 * devrilme momenti yine solverdan çıkıyor.
 */
export const FORKLIFT = {
  spawnX: 4,
  chassisHalfLength: 1.35,
  chassisHalfHeight: 0.52,
  /** Servis ağırlığı (t) — 2.5 t sınıfı bir makine ~3.7 ton gelir. */
  tonnes: 3.7,
  /**
   * Ağırlık merkezi, şasi merkezine göre. ARKAYA kaydırılmış: karşı ağırlık
   * forkliftin tanımı, devrilmeye karşı tek dayanağı o.
   */
  comX: -0.42,
  wheelRadius: 0.32,
  /** Ön aks (devrilme ekseni) ve arka aks, şasi merkezine göre. */
  frontAxleX: 0.78,
  rearAxleX: -0.92,

  /** Ön akstan çatal yüzüne yatay mesafe (m). Yük merkezi bunun ötesinde. */
  forkFaceFromAxleM: 0.42,
  /**
   * Direğin şasi üstündeki x konumu — şasinin ÖNÜNDE.
   *
   * 1.12 iken direk şasinin (yarı boy 1.35) içinde kalıyordu: çatal palete
   * girmeden önce şasinin ön yüzü paleti önüne katıp itiyordu, dolayısıyla yük
   * hiç alınamıyordu. Gerçek forkliftte de direk en öndedir.
   */
  mastX: 1.45,
  /** Çatal bıçağının boyu (m). Yük bunun üstüne oturuyor. */
  /**
   * Çatal bıçağının boyu (m). 1.15 iken en geniş palet (2.2 m derin) bıçağın
   * ucundan taşıyordu ve ölçülen yük merkezi 1.10 yerine 1.41 okuyordu —
   * yani makine kendi kendine kapasitesini aşıyordu. Gerçek forklift bıçağı
   * da 1.2–1.5 metre arasındadır.
   */
  forkLengthM: 1.35,
  /**
   * Direk tabanının şasi merkezine göre y'si.
   *
   * Araç düz dururken tam ZEMİN hizasına gelmeli, çünkü `lift` yerden yükseklik
   * demek. Bir ara 0 bırakılmıştı ve direk tabanı şasi merkezinde sanılıyordu:
   * çatal en alttayken bile 1.04 metrede kalıyor, paletin cebine hiç girmiyor
   * ve yük alınamıyordu.
   */
  /**
   * Direk pimi, şasi merkezine göre. Düz duran boş makinede zeminden 10 cm
   * yukarıda: çatalın ve direğin yere değmemesi için gereken pay. Pim tam
   * zemin hizasındayken süspansiyon her çöküşünde bıçak yere dayanıyor, ön
   * teker boşalıyor ve tahrik patinaj yapıyordu.
   *
   * **`minLiftM` ile tutarlı olmak zorunda**: pim zeminden ne kadar
   * yukarıdaysa `minLiftM` de o. Bir ara pim 0.22'ye çıkmıştı ama minLiftM
   * 0.10 kalmıştı; panel "çatal kotu 0.12 m" yazarken bıçak gerçekte
   * 0.22'deydi ve palete cebinden değil ön yüzünden vuruyordu.
   */
  mastBaseY: -(0.52 + 0.32 + 0.02),
  /** Çatalın yerden en düşük ve en yüksek kotu (m). */
  /**
   * Çatalın en düşük kotu (m) — direk pimine göre.
   *
   * 0.04'teyken bıçak zemine değiyordu: pim zemin hizasında, süspansiyon da
   * yük altında 2-3 santim çöküyor. Sonuç ölçümde nettir — bıçak yere
   * dayanınca ÖN TEKER boşalıyor ve tahrik tekeri patinaj yapıyor, makine
   * tam gazda hiç hareket etmiyordu. Gerçek forklift de çatalını yerden
   * birkaç santim yukarıda taşır.
   */
  minLiftM: 0.10,
  /**
   * En yüksek çatal kotu (m). 5.6 iken en üst rafa (5.10) yaklaşırken çatal
   * tavana dayanıyordu: bırakma kotu 5.40, yaklaşma 5.52 — sadece 8 santim
   * pay. 5.9'luk üç kademeli direk 2.5 tonluk bir makinede olağan.
   */
  maxLiftM: 5.9,
  liftSpeedMps: 0.75,
  /** Direk eğimi: geri (+) ve ileri (−), derece. */
  maxTiltBackDeg: 10,
  maxTiltFwdDeg: 5,
  tiltSpeedDegPerSec: 6,

  /** Çatal bıçağının kalınlığı (m) — palet cebine girecek kadar ince. */
  bicakKalinligiM: 0.06,
  /** Palet cebinin yüksekliği (m) — bıçak buraya giriyor. */
  paletCebiM: 0.38,
  /** Yük sırtlığının yüksekliği (m): yük geriye yaslanıyor. */
  sirtlikM: 0.5,
  /** Direk kanalının boyu (m) ve kütlesi (kg). */
  direkBoyM: 3.2,
  direkKg: 320,
  /** Taşıyıcı + çatal kütlesi (kg). En ağır yükle oran 8.4:1 — sınırın altında. */
  tasiyiciKg: 220,
  /** Kaldırma silindirinin kuvveti (N) ve eğim silindirinin torku (N·m). */
  kaldirmaKuvvetiN: 150_000,
  egimTorkuNm: 400_000,

  /**
   * Tahrik tekerden geçiyor, gövdeye uygulanan kuvvetten değil.
   *
   * Önce `applyForceToCenter` kullanılmıştı ve tekerlerin motoru da
   * `motorSpeed: 0` ile açıktı — yani makine kendi kendini frenliyordu.
   * Ölçüm: yarım gazda 18 saniyede 0.5 metre. 2600 N·m fren torku 0.32 m
   * yarıçapta 16 kN'a karşılık geliyor, gazın verdiği 13 kN'dan fazla.
   * Kamyonda doğru olan desen burada da doğru: süspansiyon, tahrik ve fren
   * tek mafsalda. Üstelik çekiş artık lastik sürtünmesiyle sınırlı — burnu
   * yere değen makine gerçekten patinaj yapıyor.
   */
  /**
   * Tahrik torku (N·m). 4200 iken teker temasında 13 kN çıkıyordu; direk
   * yukarıdayken ağırlık merkezi yükseldiği için makine geri giderken
   * şahlanıyordu. 2600 N·m, 8 kN ve 1.4 m/s² veriyor — gerçek bir
   * forkliftin ivmesi de bu civarda, ve manevra hassaslaşıyor.
   */
  maxMotorTorque: 2_600,
  maxWheelSpeed: 13,
  /**
   * Direk yukarıdayken sürüş kısıtlanıyor — gerçek makinelerdeki
   * "travel speed limiting" sistemi.
   *
   * Sadece gerçekçi değil, gerekli: taşıyıcı 5 metreye çıkınca ağırlık
   * merkezi yükseliyor ve makine geri giderken şahlanıp takla atıyordu
   * (ölçüldü: -138°). Gerçek forklift de yükü kaldırılmışken ancak adım
   * hızında gider. Oyun tarafında da doğru şeyi öğretiyor: taşımak için
   * çatalı indir.
   */
  yuksekKotM: 1.2,
  yuksekKotHizCarpani: 0.34,
  yuksekKotTorkCarpani: 0.5,
  /**
   * El freni torku (N·m), teker başına.
   *
   * 9000 iken iki tekerden 56 kN geliyordu, yani 10.6 m/s² yavaşlama — çatal
   * sürtünmesinin tutabileceğinin üstünde. Ölçümde yük sekiz metrelik
   * taşımada bıçağın ucuna doğru 83 santim kayıyor, ölçülen yük merkezi
   * 0.68'den 1.51'e çıkıyor ve makine kendi kendini aşırı yüke sokuyordu.
   * 3200 N·m, 3.8 m/s² veriyor: gerçek bir forkliftin freni de bu civarda ve
   * yük artık yerinde duruyor.
   */
  handbrakeTorque: 3_200,
  maxSpeedKmh: 15,

} as const;

/**
 * Yük tablosu: yük merkezi mesafesine göre kapasite (ton).
 *
 * Gerçek forklift etiketi de tam olarak böyle yazar — "2500 kg @ 500 mm yük
 * merkezi". Yük merkezi uzadıkça kapasite düşüyor, çünkü moment sabit.
 */
export const FORKLIFT_CHART: ReadonlyArray<readonly [number, number]> = [
  [0.40, 3.10], [0.50, 2.50], [0.60, 2.15], [0.75, 1.78],
  [0.90, 1.52], [1.10, 1.26], [1.40, 1.00],
];

/**
 * Yükseklik cezası: yük yükseldikçe kapasite düşer.
 *
 * Gerçek makinelerde de öyle — direk esner, ağırlık merkezi yükselir ve
 * dinamik devrilme payı erir. Etiketlerde "3.3 m üstünde kapasite azalır"
 * diye yazar; burada 3.3 m'den sonra doğrusal olarak %75'e iniyor.
 */
export function yukseklikCarpani(liftM: number): number {
  if (liftM <= 3.3) return 1;
  const t = Math.min(1, (liftM - 3.3) / (FORKLIFT.maxLiftM - 3.3));
  return 1 - 0.25 * t;
}

/** Yük merkezi mesafesine göre kapasite (ton). */
export function forkliftKapasitesi(loadCentreM: number, liftM: number): number {
  const c = FORKLIFT_CHART;
  const first = c[0];
  const last = c[c.length - 1];
  if (!first || !last) return 0;
  const k = yukseklikCarpani(liftM);
  if (loadCentreM <= first[0]) return first[1] * k;
  if (loadCentreM >= last[0]) return last[1] * k;
  for (let i = 0; i < c.length - 1; i++) {
    const lo = c[i];
    const hi = c[i + 1];
    if (!lo || !hi) continue;
    if (loadCentreM >= lo[0] && loadCentreM <= hi[0]) {
      const t = (loadCentreM - lo[0]) / (hi[0] - lo[0]);
      return (lo[1] + t * (hi[1] - lo[1])) * k;
    }
  }
  return 0;
}

export interface ForkliftInput {
  /** -1 çatalı indir, +1 kaldır. */
  lift: number;
  /** -1 direği öne yatır, +1 geriye. */
  tilt: number;
}

export const FORKLIFT_NEUTRAL: ForkliftInput = { lift: 0, tilt: 0 };

export class Forklift {
  readonly chassis: Body;
  readonly wheels: Body[] = [];
  /** Direk — şasiye mafsalla bağlı, eğimi o mafsalın motoru yapıyor. */
  readonly mast: Body;
  /** Taşıyıcı ve çatal — direğin içinde kayan gövde. */
  readonly carriage: Body;
  private readonly joints: WhJ[] = [];
  private readonly kaldirma: PJ;
  private readonly egim: RJ;

  /** Bu adımda çatalın üstünde duran yük (geometriyle bulunuyor). */
  private yuk: Grabbable | null = null;
  /** Silindirlerin KOMUT değerleri: hidrolik konum tutar, hız değil. */
  private liftKomut: number = FORKLIFT.minLiftM;
  private tiltKomut = 0;
  /** Bu adımda oyuncu kilitli bir kola bastı mı? */
  kilitliDenendi = false;
  /** Arka tekerin bu adımdaki zemin impulsu (N·s) ve süzülmüş hâli (N). */
  private arkaHam = 0;
  private arkaSuzulmus = 0;
  /** Çatal ya da direk zemine değiyor mu? Devrilmenin durduğu yer burası. */
  burunYerde = false;

  constructor(world: World, snaps: Snapshotter, spawnX = FORKLIFT.spawnX) {
    const restY = FORKLIFT.wheelRadius + FORKLIFT.chassisHalfHeight + 0.12;
    this.chassis = world.createDynamicBody({ x: spawnX, y: restY });
    this.chassis.createFixture(
      new Box(FORKLIFT.chassisHalfLength, FORKLIFT.chassisHalfHeight),
      { density: 1, friction: 0.6, filterGroupIndex: TRUCK_GROUP,
        filterCategoryBits: KATEGORI.makine, filterMaskBits: 0xFFFF },
    );
    // **Karşı ağırlığın eteği.** Gerçek forkliftte karşı ağırlık aracın
    // arkasında ve alçaktadır; yerden açıklığı 10-15 santimdir. Bizim şasi
    // kutusunun altı 44 santimdeydi, yani makine arkaya doğru istediği kadar
    // şahlanabiliyordu — ölçümde direk yukarıdayken geri giderken 141 dereceye
    // kadar döndü, yani takla attı. Oysa karşı ağırlıklı bir forklift takla
    // atamaz: kuyruğu yere oturur ve iş orada biter. Etek tam olarak o.
    this.chassis.createFixture(
      new Box(0.35, 0.14, new Vec2(-1.0, -FORKLIFT.chassisHalfHeight - 0.14), 0),
      { density: 1, friction: 0.7, filterGroupIndex: TRUCK_GROUP,
        filterCategoryBits: KATEGORI.makine, filterMaskBits: 0xFFFF },
    );
    this.chassis.setMassData({
      mass: FORKLIFT.tonnes * 1000,
      center: { x: FORKLIFT.comX, y: -0.1 },
      // Kısa ve ağır bir makine; atalet momenti de ona göre.
      I: 4200,
    });
    snaps.track(this.chassis);

    for (const dx of [FORKLIFT.frontAxleX, FORKLIFT.rearAxleX]) {
      const w = world.createDynamicBody({ x: spawnX + dx, y: FORKLIFT.wheelRadius });
      w.createFixture(new Circle(FORKLIFT.wheelRadius), {
        density: 1, friction: 1.4, filterGroupIndex: TRUCK_GROUP,
        filterCategoryBits: KATEGORI.makine, filterMaskBits: 0xFFFF,
      });
      w.setMassData({ mass: 180, center: { x: 0, y: 0 }, I: 9 });
      // Forklift süspansiyonu neredeyse yok: sert lastik üstünde çalışır.
      // Yumuşak yay devrilmeyi yanlış yumuşatırdı.
      // Tahrik ÖN tekerde (dx > 0): karşı ağırlıklı forklift önden çekişli,
      // arka aks direksiyon. Yük ön aksa bindiği için çekiş de orada olmalı.
      this.joints.push(world.createJoint(new WheelJoint({
        enableMotor: dx > 0, maxMotorTorque: FORKLIFT.maxMotorTorque, motorSpeed: 0,
        frequencyHz: 12.0, dampingRatio: 0.95,
      }, this.chassis, w, w.getPosition(), new Vec2(0, 1))) as WhJ);
      this.wheels.push(w);
      snaps.track(w);
    }

    // --- DİREK ve TAŞIYICI: gerçek gövdeler, gerçek mafsallar ---
    //
    // Önce kinematik denendi (bomdaki desen) ve üç ayrı biçimde kırıldı:
    // sırtlık şasinin içine girip makineyi el freni basılıyken 27 metre
    // sürükledi; her adım setTransform yükü bıçağın üstünde 8 metrede 69 cm
    // ileri kaydırdı; hızı düzeltince de yük bıçaktan kayıp düştü. Sebep
    // hep aynı: kinematik gövde solverın çözdüğü şeyin dışında kalıyor, biz
    // de tepkileri elle taklit etmeye çalışıyoruz.
    //
    // Burada buna gerek yok. Bomdan farklı olarak direk KISA ve kuvvetler
    // ölçülü: en ağır yükte 27 kN. Dolayısıyla direk şasiye bir menteşeyle,
    // taşıyıcı direğe bir kızakla bağlanabiliyor ve ikisi de motorlu. Yükün
    // ağırlığı mafsallardan şasiye kendiliğinden geçiyor — devrilme artık
    // elle uygulanan bir kuvvetten değil, gerçekten yükün kendisinden
    // çıkıyor. Kütle oranları sınırın altında: yük/taşıyıcı 5.4, direk/şasi
    // 7.1.
    const pivot = this.chassis.getWorldPoint(
      new Vec2(FORKLIFT.mastX, FORKLIFT.mastBaseY),
    );
    const catalFiltre = {
      filterGroupIndex: TRUCK_GROUP,
      filterCategoryBits: KATEGORI.catal,
      filterMaskBits: MASKE.catal,
    };

    this.mast = world.createDynamicBody({ x: pivot.x, y: pivot.y });
    // Direğin ALT UCU zeminden 18 cm yukarıda başlıyor. Pimden başlatınca
    // direk sürekli yere dayanıyor, ön teker boşalıyor ve tahrik tekeri
    // patinaj yapıyordu: makine tam gazda hiç hareket etmedi.
    const direkAlt = 0.18;
    const direkYuk = FORKLIFT.direkBoyM - direkAlt;
    // Direk, sırtlığın ARKASINDA duruyor (x < 0). Aynı düzlemdeyken palet
    // sırtlığa yaslandığı anda direğe de değiyor ve makine paleti önüne
    // katıp 1.7 metre itiyordu. Gerçekte de direk taşıyıcının arkasındadır.
    this.mast.createFixture(
      new Box(0.09, direkYuk / 2, new Vec2(-0.16, direkAlt + direkYuk / 2), 0),
      { density: 1, friction: 0.5, filterGroupIndex: TRUCK_GROUP,
        filterCategoryBits: KATEGORI.direk, filterMaskBits: MASKE.direk },
    );
    this.mast.setMassData({
      mass: FORKLIFT.direkKg,
      center: { x: 0, y: FORKLIFT.direkBoyM / 2 },
      I: (FORKLIFT.direkKg * FORKLIFT.direkBoyM ** 2) / 3,
    });
    snaps.track(this.mast);

    this.carriage = world.createDynamicBody({ x: pivot.x, y: pivot.y });
    const k = FORKLIFT.bicakKalinligiM;
    this.carriage.createFixture(
      new Box(FORKLIFT.forkLengthM / 2, k / 2, new Vec2(FORKLIFT.forkLengthM / 2, k / 2), 0),
      { density: 1, friction: 1.1, ...catalFiltre },
    );
    // Sırtlık: yük geriye kaçmasın, direk geri yatınca ona yaslansın.
    this.carriage.createFixture(
      new Box(0.05, FORKLIFT.sirtlikM / 2, new Vec2(-0.02, FORKLIFT.sirtlikM / 2), 0),
      { density: 1, friction: 0.8, ...catalFiltre },
    );
    this.carriage.setMassData({
      mass: FORKLIFT.tasiyiciKg,
      center: { x: 0.25, y: 0.2 },
      I: (FORKLIFT.tasiyiciKg * (FORKLIFT.forkLengthM ** 2 + FORKLIFT.sirtlikM ** 2)) / 12,
    });
    snaps.track(this.carriage);

    this.egim = world.createJoint(new RevoluteJoint({
      enableMotor: true, motorSpeed: 0, maxMotorTorque: FORKLIFT.egimTorkuNm,
      enableLimit: true,
      lowerAngle: (-FORKLIFT.maxTiltFwdDeg * Math.PI) / 180,
      upperAngle: (FORKLIFT.maxTiltBackDeg * Math.PI) / 180,
    }, this.chassis, this.mast, pivot)) as RJ;

    this.kaldirma = world.createJoint(new PrismaticJoint({
      enableMotor: true, motorSpeed: 0, maxMotorForce: FORKLIFT.kaldirmaKuvvetiN,
      enableLimit: true,
      lowerTranslation: 0, upperTranslation: FORKLIFT.maxLiftM - FORKLIFT.minLiftM,
    }, this.mast, this.carriage, pivot, new Vec2(0, 1))) as PJ;

    const arka = this.wheels[1];
    world.on('post-solve', (contact, impulse: { normalImpulses: number[] }) => {
      const a = contact.getFixtureA().getBody();
      const b = contact.getFixtureB().getBody();
      if (a !== arka && b !== arka) return;
      for (const j of impulse.normalImpulses ?? []) this.arkaHam += j;
    });
  }

  get speedKmh(): number { return Math.abs(this.chassis.getLinearVelocity().x) * 3.6; }

  /**
   * Arka tekerin zemine bastığı kuvvet (N) — forkliftin devrilme göstergesi.
   *
   * Vinçte kaldırma momentini yük tablosu söylüyor; forkliftte ise devrilme
   * anı ölçülebilir bir şey: arka teker boşalır. Bu değer solverın o temasa
   * verdiği normal impulstan okunuyor, yani uydurma değil ölçüm — sıfıra
   * inmesi tam olarak "arka teker havalandı" demek.
   *
   * WheelJoint.getReactionForce denendi ve hep 0 döndü: yayın taşıdığı kuvvet
   * mafsalın kendi impulsunda görünmüyor. Temasın kendisini ölçmek hem daha
   * doğru hem de daha anlaşılır.
   */
  get arkaAksN(): number { return this.arkaSuzulmus; }

  /** Statik (boş, düz) arka aks yükü — payın paydası. */
  get arkaAksStatikN(): number {
    const toplam = FORKLIFT.tonnes * 1000 * 9.81;
    const l = FORKLIFT.frontAxleX - FORKLIFT.rearAxleX;
    return (toplam * (FORKLIFT.frontAxleX - FORKLIFT.comX)) / l;
  }

  /** Çatalın yerden kotu (m) — kızak mafsalından OKUNUYOR, tutulmuyor. */
  get liftM(): number {
    return FORKLIFT.minLiftM + this.kaldirma.getJointTranslation();
  }
  /** Direk eğimi (derece). Pozitif = geriye yatık. */
  get tiltDeg(): number { return (this.egim.getJointAngle() * 180) / Math.PI; }
  get hasLoad(): boolean { return this.yuk !== null; }

  /** Çatalın TOPUĞU — taşıyıcının kendi başlangıç noktası. */
  get forkWorld(): { x: number; y: number } {
    const p = this.carriage.getWorldPoint(new Vec2(0, 0));
    return { x: p.x, y: p.y };
  }

  /** Çatalın UCU — topuktan ileriye doğru bıçak boyu kadar. */
  get forkTip(): { x: number; y: number } {
    const p = this.carriage.getWorldPoint(new Vec2(FORKLIFT.forkLengthM, 0));
    return { x: p.x, y: p.y };
  }

  /**
   * Yük merkezi mesafesi (m) — kapasitenin girdisi.
   *
   * **ÇATAL YÜZÜNDEN** ölçülür, ön akstan değil. Gerçek forklift etiketi de
   * "2500 kg @ 500 mm yük merkezi" derken bunu kasteder ve aks mesafesini
   * zaten kendi içinde hesaba katmıştır.
   *
   * Ve artık gerçekten ÖLÇÜLÜYOR: yarı yamalak sokulmuş bir palet daha uzun
   * bir yük merkezi okuyor ve kapasiteyi gerçekten düşürüyor. Sabit bir
   * `halfWidth` bunu hiç göstermiyordu.
   */
  get loadCentreM(): number {
    if (!this.yuk) return 0.5;
    const yerel = this.carriage.getLocalPoint(this.yuk.body.getWorldCenter());
    return Math.max(0.2, yerel.x);
  }

  /** Çataldaki yükün ağırlığı (ton) — panel ve LMI bunu kullanıyor. */
  get yukTonu(): number { return this.yuk ? this.yuk.body.getMass() / 1000 : 0; }

  drive(input: DriveInput, dt: number): void {
    void dt;
    const on = this.joints[0];
    const arka = this.joints[1];
    const sinirKmh = this.liftM > FORKLIFT.yuksekKotM
      ? FORKLIFT.maxSpeedKmh * FORKLIFT.yuksekKotHizCarpani : FORKLIFT.maxSpeedKmh;
    const hizli = this.speedKmh >= sinirKmh;

    if (input.handbrake) {
      // El freni iki tekeri de kilitliyor — forklift zaten kısa ve ağır.
      for (const j of [on, arka]) {
        if (!j) continue;
        j.enableMotor(true);
        j.setMaxMotorTorque(FORKLIFT.handbrakeTorque);
        j.setMotorSpeed(0);
      }
      return;
    }
    if (arka) arka.enableMotor(false);
    if (!on) return;
    on.enableMotor(true);
    const yuksek = this.liftM > FORKLIFT.yuksekKotM;
    if (input.throttle !== 0 && !hizli) {
      on.setMaxMotorTorque(
        FORKLIFT.maxMotorTorque * (yuksek ? FORKLIFT.yuksekKotTorkCarpani : 1),
      );
      on.setMotorSpeed(
        -input.throttle * FORKLIFT.maxWheelSpeed
        * (yuksek ? FORKLIFT.yuksekKotHizCarpani : 1),
      );
    } else {
      // Gaz bırakıldığında motor freni: hidrostatik şanzımanlı forklift
      // gerçekten de gaz bırakınca kendi kendine durur.
      on.setMaxMotorTorque(FORKLIFT.maxMotorTorque * 0.3);
      on.setMotorSpeed(0);
    }
  }

  /** world.step()'ten ÖNCE. */
  update(input: ForkliftInput, dt: number, asiriYuk: boolean, adaylar: Grabbable[]): void {
    // Geçen adımın teması ölçüldü; süz ve sıfırla. Ham değer adım adım
    // zıplıyor, gösterge okunaksız olurdu.
    const ham = this.arkaHam / dt;
    this.arkaSuzulmus += (ham - this.arkaSuzulmus) * Math.min(1, dt / 0.15);
    this.arkaHam = 0;

    // Aşırı yükte kaldırma kilitli — gerçek makinede de yükseltmek devrilmeyi
    // yaklaştırır. İndirmek her zaman serbest, çünkü çıkış yolu o.
    const liftCmd = asiriYuk ? Math.min(0, input.lift) : input.lift;
    // Öne yatırmak yük merkezini uzatır, o da kilitli — **ama sadece düşeyin
    // ötesi.** Geriye yatık direği düzleştirmek bir KURTARMA hareketi; onu da
    // kilitlemek oyuncuyu kapana kıstırıyordu: aşırı yükte direk 10 derecede
    // takılı kalıyor, çatalın ucu yukarıda duruyor ve geri çekilirken raf
    // kirişine takılıyordu (ölçümde makine 22 derece şahlandı).
    const tiltCmd = asiriYuk && !(input.tilt < 0 && this.tiltKomut > 0)
      ? Math.max(0, input.tilt) : input.tilt;
    this.kilitliDenendi = liftCmd !== input.lift || tiltCmd !== input.tilt;

    // **Silindirler KONUM tutuyor, hız değil.**
    //
    // Önce motor hızıyla sürüldü ve direk kendi kendine 4 dereceye kadar
    // kaydı: motor hız kısıtıdır, konum hatasını geri almaz. Hidrolik silindir
    // ise konum tutar — valf kapalıyken piston nerede kaldıysa orada durur.
    // Mafsal limitini komut değerine kilitlemek tam olarak bunu veriyor ve
    // rijit: yük altında çökmüyor, sürerken kaymıyor.
    this.liftKomut = clamp(
      this.liftKomut + liftCmd * FORKLIFT.liftSpeedMps * dt,
      FORKLIFT.minLiftM, FORKLIFT.maxLiftM,
    );
    this.tiltKomut = clamp(
      this.tiltKomut + tiltCmd * FORKLIFT.tiltSpeedDegPerSec * dt,
      asiriYuk ? 0 : -FORKLIFT.maxTiltFwdDeg, FORKLIFT.maxTiltBackDeg,
    );
    // Silindir, komut konumunu kovalayan bir servo. Mafsal limitini komuta
    // kilitlemek denendi ve planck'te taşıyıcıyı hiç hareket ettirmedi;
    // motor hızıyla sürmek ise konum hatasını geri almadığı için direği
    // kendi kendine 4 dereceye kaydırdı. Hız komutunu HATAYLA orantılı
    // vermek ikisini birden çözüyor: hareket ederken hız sınırlı, dururken
    // her sapma anında geri alınıyor — hidrolik valfin yaptığı da bu.
    const liftHata = this.liftKomut - this.liftM;
    this.kaldirma.setMotorSpeed(
      clamp(liftHata * 9, -FORKLIFT.liftSpeedMps * 1.4, FORKLIFT.liftSpeedMps * 1.4),
    );
    const tiltHata = ((this.tiltKomut * Math.PI) / 180) - this.egim.getJointAngle();
    const tiltHiz = (FORKLIFT.tiltSpeedDegPerSec * Math.PI) / 180;
    this.egim.setMotorSpeed(clamp(tiltHata * 9, -tiltHiz * 1.6, tiltHiz * 1.6));
    this.mast.setAwake(true);
    this.carriage.setAwake(true);

    this.yuk = this.catalinUstundeki(adaylar);
    this.burunYerde = this.zeminTemasi();
  }

  /**
   * Çatal zemine dayandı mı? Devrilme orada duruyor.
   *
   * Temas listesine bakmak yetmiyordu: raf kirişi de statik ve çatal rafa
   * girince ona da değiyor. Geometri hem kesin hem ucuz — bıçağın iki ucundan
   * alçak olanı zemin hizasının altındaysa makine burnunun üstünde demektir.
   */
  private zeminTemasi(): boolean {
    return Math.min(this.forkWorld.y, this.forkTip.y) < 0.025;
  }

  /**
   * Çatalın üstünde duran yük — geometriyle bulunuyor, tutma diye bir şey yok.
   *
   * Sadece "değiyor mu" yetmez: makine paletin ön yüzüne çarpınca da temas
   * var. Yükün çatalın ÜSTÜNDE olması ve yerden KESİLMİŞ olması gerekiyor —
   * sırtlıkla yerde itilen palet de temas veriyor ve ölçümde ibreyi %129'a
   * çıkarıyordu, oysa çatalda bir şey yok.
   */
  private catalinUstundeki(adaylar: Grabbable[]): Grabbable | null {
    for (const item of adaylar) {
      const yerel = this.carriage.getLocalPoint(item.body.getWorldCenter());
      // Bant dar tutuluyor: taşınan yükün tabanı bıçağın üstünde, yani
      // aradaki mesafe bıçak kalınlığı kadar. Bant genişken rafa konmuş yük
      // de "çatalda" sayılıyordu (bıçak kirişin 6 cm üstünde, yük 18 cm
      // yukarıda) ve görev tamamlanmış sayılmıyordu.
      const bicaginUstunde = yerel.y - item.halfHeight >= -0.03
        && yerel.y - item.halfHeight <= FORKLIFT.bicakKalinligiM + 0.05;
      const bicaginUzerinde = yerel.x > -0.15
        && yerel.x < FORKLIFT.forkLengthM + 1.4;
      const ayak = item.ayakM ?? 0;
      const yerdenKesik = item.body.getWorldCenter().y - item.halfHeight - ayak > 0.035;
      if (bicaginUstunde && bicaginUzerinde && yerdenKesik) return item;
    }
    return null;
  }

  /**
   * Oyuncuya "şu an ne eksik" demek için geometrik durum.
   *
   * Bu bir KİLİT DEĞİL — hiçbir şeyi engellemiyor, sadece anlatıyor. Yük alma
   * tamamen fiziksel: bıçak cebe girer, kaldırırsın, palet gelir.
   */
  durum(adaylar: Grabbable[]): ForkReason {
    if (this.hasLoad) return 'yuklu';
    const h = this.forkWorld;
    const t = this.forkTip;
    let enIyi: ForkReason = 'uzak';
    for (const item of adaylar) {
      const p = item.body.getWorldCenter();
      const taban = p.y - item.halfHeight;
      const yakinYuz = p.x - item.halfWidth;
      const uzakYuz = p.x + item.halfWidth;
      if (t.x < yakinYuz - 2.5 || h.x > uzakYuz) continue;
      const altinda = h.y < taban - 0.01 && h.y > taban - FORKLIFT.paletCebiM;
      const girdi = t.x >= yakinYuz + 0.25;
      if (altinda && girdi) return 'hazir';
      if (girdi && h.y >= taban - 0.01) enIyi = 'yuksek';
      else if (girdi) enIyi = 'alcak';
      else if (altinda) enIyi = 'yanas';
      else enIyi = enIyi === 'uzak' ? 'kot' : enIyi;
    }
    return enIyi;
  }

  reset(spawnX = FORKLIFT.spawnX): void {
    const restY = FORKLIFT.wheelRadius + FORKLIFT.chassisHalfHeight + 0.12;
    this.chassis.setTransform({ x: spawnX, y: restY }, 0);
    this.chassis.setLinearVelocity({ x: 0, y: 0 });
    this.chassis.setAngularVelocity(0);
    this.wheels.forEach((w, i) => {
      const dx = i === 0 ? FORKLIFT.frontAxleX : FORKLIFT.rearAxleX;
      w.setTransform({ x: spawnX + dx, y: FORKLIFT.wheelRadius }, 0);
      w.setLinearVelocity({ x: 0, y: 0 });
      w.setAngularVelocity(0);
    });
    const pivotY = restY + FORKLIFT.mastBaseY;
    for (const [b, y] of [[this.mast, pivotY], [this.carriage, pivotY]] as const) {
      b.setTransform({ x: spawnX + FORKLIFT.mastX, y }, 0);
      b.setLinearVelocity({ x: 0, y: 0 });
      b.setAngularVelocity(0);
    }
    this.liftKomut = FORKLIFT.minLiftM;
    this.tiltKomut = 0;
    this.kaldirma.setMotorSpeed(0);
    this.egim.setMotorSpeed(0);
    this.yuk = null;
    this.arkaHam = 0;
    this.arkaSuzulmus = 0;
    this.burunYerde = false;
  }
}

export type ForkReason = 'yuklu' | 'hazir' | 'yuksek' | 'alcak' | 'yanas' | 'kot' | 'uzak';


function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
