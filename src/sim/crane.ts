import {
  Box, DistanceJoint, RevoluteJoint, Vec2,
  type Body, type World, type DistanceJoint as DJ,
} from 'planck';
import type { Snapshotter } from './world';
import { capacityAt, computeLmi, OutriggerState, type LmiReading } from './loadChart';

/**
 * YV-25'in vinç düzeneği.
 *
 * Her şey solverın içinde (bkz. docs/01-oyun-tasarimi.md §5.5):
 *
 *   şasi --RevoluteJoint(motor+limit)--> bom dibi      luff
 *   bom dibi --PrismaticJoint(motor+limit)--> bom ucu  teleskop
 *   bom ucu --DistanceJoint(rijit, setLength)--> kanca vinç
 *   kanca --RevoluteJoint--> yük                       bağlama
 *
 * **Bom KİNEMATİK, yük tamamen dinamik.** Bu karar ölçümle alındı.
 *
 * Önce her şey solverdaydı: bom motorlu revolute + prismatic joint'lerle
 * sürülüyordu. 3.2 tonluk yük kaldırılırken bom 28°'den 3°'ye çöktü. Tork
 * sınırını 1e10'a (pratikte sınırsız) çıkarmak hiçbir şey değiştirmedi, yani
 * suçlu tork değildi; planck'in belgelediği hata kipiydi — *"daha hafif bir
 * gövde daha ağırını taşıyorsa mafsallar esner."* Kütleleri gerçekçi sınırlarda
 * yükseltmek düşüşü 12°'ye indirdi ama bitirmedi, üstelik ağırlaşan bom aracı
 * boşta 4.5° yatırdı.
 *
 * Gerçek bir vinç bomu yük altında 12 derece çökmez, birkaç santim eğilir.
 * Yani "her şey solverda" ısrarı hibritten DAHA AZ gerçekçi sonuç veriyordu.
 *
 * Şimdiki yapı:
 *  - Bom açısı ve boyu kendi durumumuz; kinematik gövdelere yazılıyor. Rijit.
 *  - Halat, kanca, YÜK, kamyon, ayaklar tamamen dinamik. Sarkaç aynen çalışıyor.
 *  - Yükün ve bomun ağırlığı şasiye ELLE uygulanıyor (applyForce). Böylece
 *    devrilme ve yük momenti yine solverdan çıkıyor — kinematik bom bunu
 *    kendiliğinden yapmaz, o yüzden açıkça yazılıyor.
 *
 * **Slew (döner tabla) bilinçli olarak yok.** Firma fotoğraflarında vinç yükü
 * kendi kasasından alıp indiriyor — alma ve bırakma aynı tarafta. Dikey eksen
 * etrafındaki dönüş yan görünümde zaten dejenere; ihtiyaç ortadan kalkınca
 * dürüst çözüm onu hiç modellememek oldu. İleride katlanır bom eklenirse
 * birlikte değerlendirilir.
 */
export const CRANE = {
  /** Bom ayağı pimi, şasi merkezine göre (m). */
  pivot: { x: -0.8, y: 2.42 },
  /** Döner tabla merkezinden bom ayağına yatay ofset — R formülündeki d_pivot. */
  pivotOffsetM: 0.6,

  boomBaseLengthM: 9.5,
  /**
   * Bom kütleleri — gerçekçi değerler.
   *
   * Bir ara 8 ve 5 tona çıkarılmışlardı: bom o zaman solverın içindeydi ve
   * planck'in *"hafif gövde ağırını taşıyamaz"* kuralı yüzünden yük altında
   * çöküyordu. Bom kinematik olunca bu kısıt ortadan kalktı — kütle artık
   * sadece şasiye uyguladığımız bir kuvvetin katsayısı. Şişirilmiş değerler
   * aracı boşta 4.7° yatırıyordu, o yüzden gerçeğe döndüler.
   */
  boomBaseTonnes: 3.2,
  boomFlyTonnes: 2.0,
  maxExtensionM: 20.5,

  minAngleDeg: 0,
  maxAngleDeg: 78,
  /** Yol konumu — bom kabin üstünde yatıyor. */
  stowAngleDeg: 11,

  luffSpeedDegPerSec: 5.0,
  telescopeSpeedMps: 1.1,
  winchSpeedMps: 1.4,

  /**
   * Hidrolik kilit valfi: gerçek bir vinç silindiri yükü neredeyse rijit tutar.
   *
   * İlk değerler (4.0e6 N·m ve 5.0e5 N) STATİK yüke göre seçilmişti ve yük
   * altında üç aktüatör birden çöktü: bom 28°'den 8°'ye düştü, teleskop
   * kendiliğinden toplandı, araç 5° yattı. Sebep dinamik: halat rijit, vinç
   * her adımda 2.3 cm çekiyor, yani 3.6 tonu bir adımda 1.4 m/s'ye çıkarmak
   * 302 kN'luk anlık kuvvet demek — statik ağırlığın 8.6 katı, 8.3 m kolda
   * 2.5 MN·m. Hem limitleri yükselttik hem vince rampa koyduk.
   */
  maxLuffTorque: 3.0e7,
  maxTelescopeForce: 6.0e6,
  /** Vinç hızının sıfırdan tama çıkma süresi (s). Anlık basamak darbe yaratıyor. */
  winchRampSec: 0.45,

  hookTonnes: 0.45,
  /** Kanca boğazının blok merkezine göre düşey ofseti (m) — görselle aynı. */
  hookThroatM: 0.46,
  minRopeM: 1.2,
  maxRopeM: 26,

  /**
   * Bağlanma penceresi — küresel yarıçap değil, yükün üstündeki bir BANT.
   *
   * Önce yarıçap kullanılıyordu (1.1, sonra 1.8 m) ve ikisi de ıskalıyordu:
   * kanca yükten 1 metre yanda kalıp yere kadar inince küresel mesafe 2.09 m
   * oluyor, oysa yatayda zaten yükün üstünde. Yarıçap yatay ve düşey hatayı
   * aynı kefeye koyuyor, halbuki bunlar farklı şeyler — kancanın yükün ÜSTÜNDE
   * olması gerekir, ona eşit uzaklıkta değil.
   *
   * Bant: yatayda yükün yarı genişliği + pay, düşeyde üst yüzeyin biraz altı
   * ile epey üstü arası. Gerçekte kancayı yüke geçiren bir sapancı var, bu
   * kadar cömert olması gerçekçi de.
   */
  attachSideMarginM: 0.75,
  attachBelowTopM: 0.7,
  attachAboveTopM: 1.7,
  attachMaxSpeedMps: 1.2,
} as const;

/** Yol konumunda kancanın sönümü — savrulmasın diye. */
const STOW_DAMPING = 7.0;
/** Çalışma konumunda neredeyse sönüm yok: sarkaç oyunun asıl becerisi. */
const WORK_DAMPING = 0.05;

export interface CraneInput {
  /** -1 indir, +1 kaldır. */
  luff: number;
  /** -1 topla, +1 aç. */
  telescope: number;
  /** -1 kancayı indir, +1 kaldır. */
  winch: number;
}

export const NEUTRAL: CraneInput = { luff: 0, telescope: 0, winch: 0 };

/**
 * Kancalanabilir bir yük.
 *
 * Yarı yükseklik açıkça veriliyor. Önce şeklin iç alanlarından (`m_vertices`)
 * okunmaya çalışılıyordu; bulamayınca 0.4'e düşüyordu, oysa yükün gerçek yarı
 * yüksekliği 0.85. Bağlanma noktası 45 santim yanlış hesaplanıyor ve kanca
 * doğru yerde dururken "yakalamıyordu".
 */
export interface Grabbable {
  body: Body;
  halfWidth: number;
  halfHeight: number;
}

export class Crane {
  readonly boomBase: Body;
  readonly boomFly: Body;
  readonly hook: Body;

  private readonly cable: DJ;
  /** Aktüatör durumu — kinematik boma her adımda yazılıyor. */
  private angle = (CRANE.stowAngleDeg * Math.PI) / 180;
  private extension = 0;

  /** Bom ucunun bom dibi yerel çerçevesindeki bağlantı noktası. */
  private readonly tipLocal: Vec2;

  private attached: Body | null = null;
  private attachJoint: RevoluteJoint | null = null;
  /** world.step() içinde joint yaratılamaz; istekler kuyruğa alınıp sonra işlenir. */
  private pendingAttach = false;
  private pendingDetach = false;

  private ropeLength = 3.0;
  private stowed = true;
  private winchRate = 0;

  constructor(
    private readonly world: World,
    private readonly chassis: Body,
    snaps: Snapshotter,
  ) {
    const pivot = chassis.getWorldPoint(CRANE.pivot);
    const rad = (CRANE.stowAngleDeg * Math.PI) / 180;
    const dir = { x: Math.cos(rad), y: Math.sin(rad) };

    // --- bom dibi ---
    const baseHalf = CRANE.boomBaseLengthM / 2;
    this.boomBase = world.createDynamicBody(
      { x: pivot.x + dir.x * baseHalf, y: pivot.y + dir.y * baseHalf }, rad,
    );
    this.boomBase.setKinematic();

    // --- teleskop kesiti ---
    const flyHalf = 4.3;
    const flyCentre = CRANE.boomBaseLengthM - flyHalf;
    this.boomFly = world.createDynamicBody(
      { x: pivot.x + dir.x * flyCentre, y: pivot.y + dir.y * flyCentre }, rad,
    );
    this.boomFly.setKinematic();

    this.tipLocal = new Vec2(flyHalf, 0);

    // --- kanca ---
    const tip = this.boomFly.getWorldPoint(this.tipLocal);
    this.hook = world.createDynamicBody({ x: tip.x, y: tip.y - this.ropeLength });
    this.hook.createFixture(new Box(0.3, 0.34), { density: 1, friction: 0.8 });
    this.hook.setMassData({
      mass: CRANE.hookTonnes * 1000, center: { x: 0, y: 0 }, I: 90,
    });
    this.hook.setLinearDamping(STOW_DAMPING);
    this.hook.setAngularDamping(STOW_DAMPING);

    // Halat RİJİT. frequencyHz verilirse yay gibi esner; spike'ta 3.45 t altında
    // yükü emniyet halatı taşımaya başladı ve kuvvet okuması yarıya düştü.
    this.cable = world.createJoint(new DistanceJoint({
      length: this.ropeLength,
      collideConnected: true,
    }, this.boomFly, this.hook, tip, this.hook.getWorldCenter())) as DJ;

    snaps.track(this.boomBase);
    snaps.track(this.boomFly);
    snaps.track(this.hook);
  }

  /**
   * Yol konumu: kanca bom ucuna toplanır ve sönümlenir.
   *
   * Sürerken kancayı serbest bırakmak fizik olarak doğru ama oynanış olarak
   * saçma: testte kanca 78°'ye savruluyordu. Gerçek vinçte kanca yola
   * çıkmadan önce bağlanır. Çalışma moduna geçince sönüm neredeyse sıfıra
   * iniyor — sarkaç oyunun asıl becerisi, onu bastırmıyoruz.
   */
  setStowed(stowed: boolean): void {
    if (stowed === this.stowed) return;
    this.stowed = stowed;
    this.hook.setLinearDamping(stowed ? STOW_DAMPING : 0);
    this.hook.setAngularDamping(stowed ? STOW_DAMPING : WORK_DAMPING);
  }

  /** Her fizik adımında, world.step()'ten ÖNCE. */
  update(input: CraneInput, dt: number, lmi: LmiReading): void {
    if (this.stowed) {
      // Halatı toparla, kancayı bom ucuna yasla.
      this.winchRate = 0;
      this.ropeLength = Math.max(CRANE.minRopeM, this.ropeLength - 2.5 * dt);
      this.cable.setLength(this.ropeLength);
      return;
    }
    const scale = lmi.speedScale;

    // Kırmızıda yarıçapı artıran hareketler kilitli: bom indirme ve teleskop açma.
    const luffCmd = lmi.blockRadiusIncrease ? Math.max(0, input.luff) : input.luff;
    const teleCmd = lmi.blockRadiusIncrease ? Math.min(0, input.telescope) : input.telescope;

    // Hidrolik silindir pozisyon kontrollüdür: komutu doğrudan konuma entegre
    // ediyoruz, hız sınırı ve strok limitiyle. Kilit valfli bir silindir gibi
    // rijit tutuyor — solvera yaptırmaya çalıştığımızda 12° çöküyordu.
    const luffRate = (luffCmd * CRANE.luffSpeedDegPerSec * Math.PI * scale) / 180;
    this.angle = clamp(
      this.angle + luffRate * dt,
      (CRANE.minAngleDeg * Math.PI) / 180,
      (CRANE.maxAngleDeg * Math.PI) / 180,
    );
    this.extension = clamp(
      this.extension + teleCmd * CRANE.telescopeSpeedMps * scale * dt,
      0, CRANE.maxExtensionM,
    );

    // Vinç hızı rampalı: komut basamak, hidrolik değil. Rampasız her basış
    // rijit halata bir darbe bindiriyor ve bomu aşağı çekiyordu.
    const target = -input.winch * CRANE.winchSpeedMps * scale;
    const maxDelta = (CRANE.winchSpeedMps / CRANE.winchRampSec) * dt;
    this.winchRate += clamp(target - this.winchRate, -maxDelta, maxDelta);

    if (Math.abs(this.winchRate) > 1e-4) {
      this.ropeLength = clamp(
        this.ropeLength + this.winchRate * dt, CRANE.minRopeM, CRANE.maxRopeM,
      );
      this.cable.setLength(this.ropeLength);
    }
  }

  /** world.step()'ten SONRA. Joint yaratma/yok etme burada güvenli. */
  flushJointQueue(candidates: Grabbable[]): void {
    if (this.pendingDetach && this.attachJoint) {
      this.world.destroyJoint(this.attachJoint);
      this.attachJoint = null;
      this.attached = null;
    }
    this.pendingDetach = false;

    if (this.pendingAttach && !this.attached) {
      const target = this.findGrabbable(candidates);
      if (target) {
        this.attachJoint = this.world.createJoint(
          new RevoluteJoint({}, this.hook, target, this.grabPoint),
        ) as RevoluteJoint;
        this.attached = target;
      }
    }
    this.pendingAttach = false;
  }

  /** Kancanın gerçekten yükü tuttuğu nokta — blok merkezi değil, boğaz. */
  get grabPoint(): { x: number; y: number } {
    const c = this.hook.getWorldCenter();
    return { x: c.x, y: c.y - CRANE.hookThroatM };
  }

  private findGrabbable(candidates: Grabbable[]): Body | null {
    const v = this.hook.getLinearVelocity();
    if (Math.hypot(v.x, v.y) > CRANE.attachMaxSpeedMps) return null;

    const g = this.grabPoint;
    for (const item of candidates) {
      const p = item.body.getWorldCenter();
      const topY = p.y + item.halfHeight;
      const sideOk =
        Math.abs(p.x - g.x) <= item.halfWidth + CRANE.attachSideMarginM;
      const heightOk =
        g.y >= topY - CRANE.attachBelowTopM && g.y <= topY + CRANE.attachAboveTopM;
      if (sideOk && heightOk) return item.body;
    }
    return null;
  }

  /** HUD için: şu an boşluğa basılsa bağlanır mı? */
  canAttach(candidates: Grabbable[]): boolean {
    return !this.attached && this.findGrabbable(candidates) !== null;
  }

  requestToggleAttach(): void {
    if (this.attached) this.pendingDetach = true;
    else this.pendingAttach = true;
  }

  // --- okumalar ---

  get angleDeg(): number { return (this.angle * 180) / Math.PI; }
  get extensionM(): number { return this.extension; }

  /**
   * Bom gövdelerini aktüatör durumundan konumlandırır ve yükün ağırlığını
   * şasiye aktarır. **world.step()'ten ÖNCE, update()'ten sonra.**
   *
   * Kinematik gövde kuvvet hissetmez, yani yükün ağırlığı kendiliğinden
   * kamyona binmez. Devrilmenin ve yük momentinin emergent kalması için
   * halattaki gerçek kuvveti okuyup şasiye elle uyguluyoruz.
   */
  applyToWorld(dt: number): void {
    const pivot = this.chassis.getWorldPoint(CRANE.pivot);
    const chassisAngle = this.chassis.getAngle();
    const a = this.angle + chassisAngle;
    const dir = { x: Math.cos(a), y: Math.sin(a) };

    const baseHalf = CRANE.boomBaseLengthM / 2;
    this.boomBase.setTransform(
      { x: pivot.x + dir.x * baseHalf, y: pivot.y + dir.y * baseHalf }, a,
    );
    const flyCentre = CRANE.boomBaseLengthM + this.extension - 4.3;
    this.boomFly.setTransform(
      { x: pivot.x + dir.x * flyCentre, y: pivot.y + dir.y * flyCentre }, a,
    );

    // Bomun kendi ağırlığı — merkezi bom uzadıkça dışarı kayıyor, yani
    // teleskop açmak devrilme momentini kendiliğinden artırıyor.
    const boomTonnes = CRANE.boomBaseTonnes + CRANE.boomFlyTonnes;
    const boomCentre = (CRANE.boomBaseLengthM + this.extension) * 0.42;
    this.chassis.applyForce(
      { x: 0, y: -boomTonnes * 1000 * 9.81 },
      { x: pivot.x + dir.x * boomCentre, y: pivot.y + dir.y * boomCentre },
      true,
    );

    // Halattaki gerçek kuvvet — kanca ve yük ne kadar çekiyorsa o.
    //
    // try/catch şart: planck'te DistanceJoint'in tepki kuvveti ancak hız
    // kısıtları bir kez çözüldükten sonra tanımlı. İlk karede iç vektör yok ve
    // metot DÖNMÜYOR, FIRLATIYOR — dönen değeri kontrol etmek yetmiyor. Bu
    // hataya bir kez düşülüp (LMI okumasında) yanlış ders çıkarılmıştı; burada
    // adımdan önce çağrıldığı için tüm simülasyonu donduruyordu.
    const f = this.readCableForce(dt);
    if (f) this.chassis.applyForce({ x: -f.x, y: -f.y }, this.tipWorld, true);
  }

  get lengthM(): number {
    return CRANE.boomBaseLengthM + this.extensionM;
  }

  get ropeM(): number { return this.ropeLength; }

  get tipWorld(): { x: number; y: number } {
    const p = this.boomFly.getWorldPoint(this.tipLocal);
    return { x: p.x, y: p.y };
  }

  /** Çalışma yarıçapı — döner tabla merkezinden kancaya yatay mesafe. */
  get radiusM(): number {
    const centre = this.chassis.getWorldPoint(CRANE.pivot);
    return Math.abs(this.tipWorld.x - centre.x) + CRANE.pivotOffsetM;
  }

  get hasLoad(): boolean { return this.attached !== null; }

  /**
   * Anlık halat kuvvetinden LMI. **world.step()'ten SONRA çağrılmalı.**
   *
   * Kendi defterimizden değil solverdan okuyoruz: sarkaç salınırken gerilim
   * statik ağırlığın üstüne çıkıyor (40°'de +%46, spikes/02 ile doğrulandı).
   * Statik yükle hesaplanan bir LMI yalan söyler.
   *
   * Sıra önemli ve ilk sürümde yanlıştı: LMI hem adımdan önce hem render'da
   * okunuyordu. planck'te DistanceJoint'in tepki kuvveti ancak hız kısıtları
   * çözüldükten sonra tanımlı; ilk karede iç vektör tanımsız olduğu için her
   * karede hata fırlıyordu. Artık adımdan sonra bir kez örnekleniyor ve
   * saklanıyor; aktüatör kısıtları bir kare önceki değeri kullanıyor, ki
   * 16 ms'lik gecikme hissedilmiyor.
   */
  sampleLmi(dt: number, outriggers: OutriggerState): void {
    const f = this.readCableForce(dt);
    const tonnes = f ? Math.hypot(f.x, f.y) / 9810 : 0;
    this.lmi = computeLmi(this.radiusM, tonnes, 0, outriggers);
  }

  /** Halat kuvveti, henüz çözülmemişse null. */
  private readCableForce(dt: number): { x: number; y: number } | null {
    try {
      const f = this.cable.getReactionForce(1 / dt) as { x: number; y: number } | undefined;
      if (f && Number.isFinite(f.x) && Number.isFinite(f.y)) return f;
    } catch {
      // Henüz bir adım atılmadı; kuvvet tanımsız.
    }
    return null;
  }

  /** Son örneklenen LMI. Hem HUD hem aktüatör kısıtları bunu okur. */
  lmi: LmiReading = computeLmi(0, 0, 0, OutriggerState.Full);

  capacityTonnes(outriggers: OutriggerState): number {
    return capacityAt(this.radiusM, outriggers);
  }

  /** Salınım açısı (derece) — kancanın bom ucuna göre düşeyden sapması. */
  get swingDeg(): number {
    const tip = this.tipWorld;
    const h = this.hook.getWorldCenter();
    return (Math.atan2(h.x - tip.x, tip.y - h.y) * 180) / Math.PI;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
