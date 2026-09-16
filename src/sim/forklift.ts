import {
  Box, Circle, WheelJoint, Vec2,
  type Body, type World, type WheelJoint as WhJ,
} from 'planck';
import { TRUCK_GROUP, type Snapshotter } from './world';
import type { DriveInput } from '../input/keyboard';
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
  forkLengthM: 1.15,
  /**
   * Direk tabanının şasi merkezine göre y'si.
   *
   * Araç düz dururken tam ZEMİN hizasına gelmeli, çünkü `lift` yerden yükseklik
   * demek. Bir ara 0 bırakılmıştı ve direk tabanı şasi merkezinde sanılıyordu:
   * çatal en alttayken bile 1.04 metrede kalıyor, paletin cebine hiç girmiyor
   * ve yük alınamıyordu.
   */
  mastBaseY: -(0.52 + 0.32 + 0.12),
  /** Çatalın yerden en düşük ve en yüksek kotu (m). */
  minLiftM: 0.08,
  maxLiftM: 4.9,
  liftSpeedMps: 0.75,
  /** Direk eğimi: geri (+) ve ileri (−), derece. */
  maxTiltBackDeg: 10,
  maxTiltFwdDeg: 5,
  tiltSpeedDegPerSec: 6,

  /** Yük almak için çatal kotu, yükün tabanına bu kadar yakın olmalı (m). */
  forkPocketToleranceM: 0.16,
  /** Çatal yüzü yükün içine bu kadar girmiş olmalı (m). */
  forkInsertM: 0.35,
  attachMaxSpeedMps: 1.0,

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
  maxMotorTorque: 4_200,
  maxWheelSpeed: 16,
  handbrakeTorque: 9_000,
  maxSpeedKmh: 18,

  /**
   * Çatalın ZEMİN TEMASI — devrilmeyi durduran şey.
   *
   * Direk ve çatal birer gövde değil, sadece sayı; dolayısıyla makine öne
   * yatarken solverın gördüğü hiçbir şey onu tutmuyordu ve forklift 180°
   * takla atıp sırtüstü kalıyordu. Oysa gerçekte devrilen bir forklift
   * ÇATALININ ÜSTÜNE oturur: burun birkaç derece iner, bıçaklar yere değer,
   * iş orada biter. Bomun "yatakta dururken ağırlık şasiden geçer" kuralının
   * aynısı — kinematik parçanın tepki kuvvetini elle uyguluyoruz.
   *
   * Yay katsayısı, 5 cm batmada makine + yükü (yaklaşık 7 ton) taşıyacak
   * kadar sert; sönüm kritik sönümün altında, çünkü zıplamasını değil
   * oturmasını istiyoruz.
   */
  /** Temasın izin verdiği batma payı (m) ve düzeltme oranı. */
  zeminPayiM: 0.01,
  zeminDuzeltme: 0.25,
  zeminMaxDuzeltmeMps: 1.2,
  zeminSurtunme: 0.9,
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
  private readonly joints: WhJ[] = [];

  /** Çatalın yerden kotu (m) — kendi durumumuz, kinematik. */
  private lift: number = FORKLIFT.minLiftM;
  /** Direk eğimi (derece). Pozitif = geriye yatık. */
  private tilt = 0;

  private attached: Body | null = null;
  private attachedSpec: Grabbable | null = null;
  private pendingAttach = false;
  private pendingDetach = false;
  /** Bu adımda oyuncu kilitli bir kola bastı mı? */
  kilitliDenendi = false;

  /** Arka tekerin bu adımdaki zemin impulsu (N·s) ve süzülmüş hâli (N). */
  private arkaHam = 0;
  private arkaSuzulmus = 0;
  /** Çatal/yük zemine değiyor mu? Devrilmenin durduğu yer burası. */
  burunYerde = false;

  constructor(world: World, snaps: Snapshotter, spawnX = FORKLIFT.spawnX) {
    const restY = FORKLIFT.wheelRadius + FORKLIFT.chassisHalfHeight + 0.12;
    this.chassis = world.createDynamicBody({ x: spawnX, y: restY });
    this.chassis.createFixture(
      new Box(FORKLIFT.chassisHalfLength, FORKLIFT.chassisHalfHeight),
      { density: 1, friction: 0.6, filterGroupIndex: TRUCK_GROUP },
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
      });
      w.setMassData({ mass: 180, center: { x: 0, y: 0 }, I: 9 });
      // Forklift süspansiyonu neredeyse yok: sert lastik üstünde çalışır.
      // Yumuşak yay devrilmeyi yanlış yumuşatırdı.
      // Tahrik ÖN tekerde (dx > 0): karşı ağırlıklı forklift önden çekişli,
      // arka aks direksiyon. Yük ön aksa bindiği için çekiş de orada olmalı.
      this.joints.push(world.createJoint(new WheelJoint({
        enableMotor: dx > 0, maxMotorTorque: FORKLIFT.maxMotorTorque, motorSpeed: 0,
        frequencyHz: 9.0, dampingRatio: 0.9,
      }, this.chassis, w, w.getPosition(), new Vec2(0, 1))) as WhJ);
      this.wheels.push(w);
      snaps.track(w);
    }

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
  get liftM(): number { return this.lift; }
  get tiltDeg(): number { return this.tilt; }
  get hasLoad(): boolean { return this.attached !== null; }

  /** Çatalın TOPUĞU — direğin dibi, yükün dayandığı yüz. */
  get forkWorld(): { x: number; y: number } {
    const p = this.chassis.getWorldPoint({ x: FORKLIFT.mastX, y: FORKLIFT.mastBaseY });
    const a = this.chassis.getAngle() + (this.tilt * Math.PI) / 180;
    // Direk eğimi çatalı geri/ileri alıyor.
    return { x: p.x - Math.sin(a) * this.lift, y: p.y + Math.cos(a) * this.lift };
  }

  /** Çatalın UCU — topuktan ileriye doğru bıçak boyu kadar. */
  get forkTip(): { x: number; y: number } {
    const h = this.forkWorld;
    const a = this.chassis.getAngle() + (this.tilt * Math.PI) / 180;
    return { x: h.x + Math.cos(a) * FORKLIFT.forkLengthM,
             y: h.y + Math.sin(a) * FORKLIFT.forkLengthM };
  }

  /**
   * Yük merkezi mesafesi (m) — kapasitenin girdisi.
   *
   * **ÇATAL YÜZÜNDEN** ölçülür, ön akstan değil. Gerçek forklift etiketi de
   * "2500 kg @ 500 mm yük merkezi" derken bunu kasteder ve aks mesafesini
   * zaten kendi içinde hesaba katmıştır. İkisini toplamak tabloyu bir kez daha
   * cezalandırıyordu: standart palet 1.02 m yük merkezi gösteriyor, oysa
   * gerçeği 0.60.
   */
  get loadCentreM(): number {
    return this.attachedSpec?.halfWidth ?? 0.5;
  }

  drive(input: DriveInput, dt: number): void {
    void dt;
    const on = this.joints[0];
    const arka = this.joints[1];
    const hizli = this.speedKmh >= FORKLIFT.maxSpeedKmh;

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
    if (input.throttle !== 0 && !hizli) {
      on.setMaxMotorTorque(FORKLIFT.maxMotorTorque);
      on.setMotorSpeed(-input.throttle * FORKLIFT.maxWheelSpeed);
    } else {
      // Gaz bırakıldığında motor freni: hidrostatik şanzımanlı forklift
      // gerçekten de gaz bırakınca kendi kendine durur.
      on.setMaxMotorTorque(FORKLIFT.maxMotorTorque * 0.3);
      on.setMotorSpeed(0);
    }
  }

  /** world.step()'ten ÖNCE. */
  update(input: ForkliftInput, dt: number, asiriYuk: boolean): void {
    // Geçen adımın teması ölçüldü; süz ve sıfırla. Ham değer adım adım
    // zıplıyor, gösterge okunaksız olurdu.
    const ham = this.arkaHam / dt;
    this.arkaSuzulmus += (ham - this.arkaSuzulmus) * Math.min(1, dt / 0.15);
    this.arkaHam = 0;

    // Aşırı yükte kaldırma kilitli — gerçek makinede de yükseltmek devrilmeyi
    // yaklaştırır. İndirmek her zaman serbest, çünkü çıkış yolu o.
    const liftCmd = asiriYuk ? Math.min(0, input.lift) : input.lift;
    // Öne yatırmak yük merkezini uzatır, o da kilitli.
    const tiltCmd = asiriYuk ? Math.max(0, input.tilt) : input.tilt;
    this.kilitliDenendi = liftCmd !== input.lift || tiltCmd !== input.tilt;

    this.lift = clamp(
      this.lift + liftCmd * FORKLIFT.liftSpeedMps * dt,
      FORKLIFT.minLiftM, FORKLIFT.maxLiftM,
    );
    this.tilt = clamp(
      this.tilt + tiltCmd * FORKLIFT.tiltSpeedDegPerSec * dt,
      -FORKLIFT.maxTiltFwdDeg, FORKLIFT.maxTiltBackDeg,
    );

    // Yükün ağırlığı şasiye, çatalın bulunduğu noktadan. Devrilme momenti
    // buradan çıkıyor — kinematik taşıyıcı bunu kendiliğinden yapmaz.
    if (this.attached) {
      const w = this.attached.getMass() * 9.81;
      const f = this.forkWorld;
      const kol = this.attachedSpec?.halfWidth ?? 0.5;
      // Ağırlık çatalın üstünde, topuktan yük merkezi kadar ileride — devrilme
      // momentinin kolu tam olarak bu.
      this.chassis.applyForce({ x: 0, y: -w }, { x: f.x + kol, y: f.y }, true);
      // Yükü çatala kilitli tut: taşıyıcı kinematik, yük onunla gider.
      const a = this.chassis.getAngle() + (this.tilt * Math.PI) / 180;
      const hw = this.attachedSpec?.halfWidth ?? 0.5;
      const hh = this.attachedSpec?.halfHeight ?? 0.4;
      this.attached.setTransform(
        { x: f.x + Math.cos(a) * hw - Math.sin(a) * hh,
          y: f.y + Math.sin(a) * hw + Math.cos(a) * hh },
        a,
      );
      this.attached.setLinearVelocity(this.chassis.getLinearVelocity());
      this.attached.setAngularVelocity(0);
      this.attached.setAwake(true);
    }

    this.yereBas(dt);
  }

  /**
   * Çatal (ve üstündeki yük) zemine değdiyse şasiyi oradan destekle.
   *
   * Devrilmenin sonu burası. Üç nokta bakılıyor: çatalın topuğu, ucu ve
   * yüklüyken yükün ön-alt köşesi — hangisi önce yere iner, makineyi o tutar.
   * Yükü yüksekteyken devrilen forklift gerçekten de önce yükünün köşesine,
   * sonra çatalına oturur; alçakta taşıyan forklift ise birkaç derece eğilip
   * bıçaklarının üstünde kalır. İkisi de aynı denklemden çıkıyor.
   */
  private yereBas(dt: number): void {
    const noktalar: Array<{ x: number; y: number }> = [this.forkWorld, this.forkTip];
    if (this.attached && this.attachedSpec) {
      // Yük çatalın ucundan taşabilir; taşan ön-alt köşe daha alçaktır.
      const h = this.forkWorld;
      const a = this.chassis.getAngle() + (this.tilt * Math.PI) / 180;
      const boy = this.attachedSpec.halfWidth * 2;
      noktalar.push({ x: h.x + Math.cos(a) * boy, y: h.y + Math.sin(a) * boy });
    }

    this.burunYerde = false;
    const c = this.chassis;
    const m = c.getMass();
    const I = c.getInertia();
    // İki tur: noktalar birbirini etkiliyor, tek tur çözümü sallantılı bırakıyor.
    for (let tur = 0; tur < 2; tur++) {
      for (const p of noktalar) {
        const batma = -p.y;
        if (batma <= 0) continue;
        const merkez = c.getWorldCenter();
        const rx = p.x - merkez.x;
        const ry = p.y - merkez.y;
        const w = c.getAngularVelocity();
        const v = c.getLinearVelocity();
        // Temas noktasının hızı: v + ω × r
        const vy = v.y + w * rx;
        const vx = v.x - w * ry;
        // Batmayı yavaşça geri itme hızı (Baumgarte) — sertlik değil, düzeltme.
        const bias = Math.min(
          FORKLIFT.zeminMaxDuzeltmeMps,
          (Math.max(0, batma - FORKLIFT.zeminPayiM) * FORKLIFT.zeminDuzeltme) / dt,
        );
        const kn = 1 / m + (rx * rx) / I;
        const jn = -(vy - bias) / kn;
        if (jn <= 0) continue;
        this.burunYerde = true;
        c.applyLinearImpulse({ x: 0, y: jn }, { x: p.x, y: p.y }, true);
        // Sürtünme: burun yere değdikten sonra makine gaza rağmen sürünmesin.
        const kt = 1 / m + (ry * ry) / I;
        const jtHam = -vx / kt;
        const sinir = FORKLIFT.zeminSurtunme * jn;
        const jt = Math.max(-sinir, Math.min(sinir, jtHam));
        c.applyLinearImpulse({ x: jt, y: 0 }, { x: p.x, y: p.y }, true);
      }
    }
  }

  /** world.step()'ten SONRA. Joint yaratma/yok etme burada güvenli. */
  flushJointQueue(candidates: Grabbable[]): void {
    if (this.pendingDetach && this.attached) {
      // Bırakırken yükü tekrar serbest bırak: artık kendi fiziğiyle oturacak.
      for (let f = this.attached.getFixtureList(); f; f = f.getNext()) {
        f.setFilterData({ groupIndex: 0, categoryBits: 1, maskBits: 0xFFFF });
      }
      this.attached.setSleepingAllowed(true);
      this.attached.setLinearVelocity(this.chassis.getLinearVelocity());
      this.attached = null;
      this.attachedSpec = null;
    }
    this.pendingDetach = false;

    if (this.pendingAttach && !this.attached) {
      const item = this.alinabilir(candidates);
      if (item) {
        // **Çataldaki yük hiçbir şeye çarpmıyor.**
        // Taşınan yük kinematik: her adım setTransform ile çatala konuyor.
        // Böyle bir gövdenin temas impulsu anlamsız — ne yükü durdurabiliyor
        // (bir sonraki adımda yeri zaten eziliyor) ne de makineye doğru bir
        // kuvvet veriyor; sadece gürültü ve sahte "çarpma" sayısı üretiyordu.
        // Bırakınca filtre geri açılıyor ve yük yine rafa oturuyor.
        for (let f = item.body.getFixtureList(); f; f = f.getNext()) {
          f.setFilterData({ groupIndex: TRUCK_GROUP, categoryBits: 1, maskBits: 0xFFFF });
        }
        const f = this.forkWorld;
        item.body.setTransform(
          { x: f.x + item.halfWidth, y: f.y + item.halfHeight }, 0,
        );
        item.body.setLinearVelocity({ x: 0, y: 0 });
        item.body.setAngularVelocity(0);
        item.body.setAwake(true);
        item.body.setSleepingAllowed(false);
        this.attached = item.body;
        this.attachedSpec = item;
      }
    }
    this.pendingAttach = false;
  }

  /**
   * Çatal yüke girmiş mi?
   *
   * İki koşul: çatal kotu yükün TABANINA yakın olmalı (palet cebi orada) ve
   * çatal yüzü yükün içine girmiş olmalı. Vinçteki "üstüne indir" kuralının
   * forklift karşılığı — ve sahada da sapancı değil, sürücü hizalıyor.
   */
  alinabilirSebep(candidates: Grabbable[]): { item: Grabbable | null; reason: ForkReason } {
    const v = this.chassis.getLinearVelocity();
    if (Math.abs(v.x) > FORKLIFT.attachMaxSpeedMps) return { item: null, reason: 'hizli' };
    const h = this.forkWorld;
    const t = this.forkTip;
    let yakin: ForkReason = 'uzak';
    for (const item of candidates) {
      const p = item.body.getWorldCenter();
      const taban = p.y - item.halfHeight;
      const yakinYuz = p.x - item.halfWidth;
      const kotOk = Math.abs(h.y - taban) <= FORKLIFT.forkPocketToleranceM;
      // Bıçak yükün altına girmiş olmalı: uç yeterince içeride, topuk ise
      // yükün ön yüzünü geçmemiş. İkisi birden gerçek bir "çatal altta" hali.
      const girdi = t.x >= yakinYuz + FORKLIFT.forkInsertM && h.x <= yakinYuz + 0.18;
      if (kotOk && girdi) return { item, reason: 'hazir' };
      if (girdi) yakin = 'kot';
      else if (kotOk && Math.abs(h.x - yakinYuz) < 2.2) yakin = 'yanas';
    }
    return { item: null, reason: yakin };
  }

  alinabilir(candidates: Grabbable[]): Grabbable | null {
    return this.alinabilirSebep(candidates).item;
  }

  requestToggleAttach(): void {
    if (this.attached) this.pendingDetach = true;
    else this.pendingAttach = true;
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
    this.lift = FORKLIFT.minLiftM;
    this.tilt = 0;
    this.arkaHam = 0;
    this.arkaSuzulmus = 0;
    this.burunYerde = false;
  }
}

export type ForkReason = 'hazir' | 'hizli' | 'kot' | 'yanas' | 'uzak';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
