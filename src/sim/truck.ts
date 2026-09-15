import { Box, Circle, WheelJoint, type Body, type World, type WheelJoint as WJ } from 'planck';
import type { DriveInput } from '../input/keyboard';
import { TRUCK_GROUP, type Snapshotter } from './world';

/**
 * YV-25 kamyon şasisi. Üç akslı, arkadan çekişli.
 *
 * Süspansiyon, tahrik ve fren tek bir WheelJoint'te toplanıyor — planck'in
 * example/Car.ts deseninin aynısı. Rapier'i elemenin sebeplerinden biri buydu:
 * onda WheelJoint yok, süspansiyonu prismatic + revolute + yay ile elle
 * kurmak gerekiyor.
 */
export const TRUCK = {
  /** Şasi yarı-boyutları (m). */
  chassisHalfLength: 4.8,
  chassisHalfHeight: 0.42,
  /** Şasi kütlesi — bom ve üst yapı hariç. */
  chassisTonnes: 24,
  wheelRadius: 0.55,
  wheelTonnes: 0.4,
  /** Aks konumları, şasi merkezine göre (m). Kamyon +x yönüne gider,
   *  yani ön aks +x tarafta, çeken tandem arkada. */
  axles: [3.4, -2.2, -3.5],
  /** Çekiş uygulanan akslar (indeks). */
  drivenAxles: [1, 2] as readonly number[],
  suspensionHz: 4.0,
  suspensionDamping: 0.7,
  /** Tam gazda tekerlek açısal hızı (rad/s). 20 rad/s ≈ 40 km/s. */
  maxWheelSpeed: 20,
  maxMotorTorque: 26_000,
  handbrakeTorque: 90_000,
  spawnX: 4,
} as const;

export class Truck {
  readonly chassis: Body;
  readonly wheels: Body[] = [];
  private readonly joints: WJ[] = [];

  constructor(world: World, snaps: Snapshotter, spawnX = TRUCK.spawnX) {
    const restHeight = TRUCK.wheelRadius + TRUCK.chassisHalfHeight + 0.42;

    this.chassis = world.createDynamicBody({ x: spawnX, y: restHeight });
    this.chassis.createFixture(
      new Box(TRUCK.chassisHalfLength, TRUCK.chassisHalfHeight),
      { density: 1, friction: 0.6, filterGroupIndex: TRUCK_GROUP },
    );
    // Kütleyi elle veriyoruz: yoğunluktan gelen değer gerçekçi değil.
    //
    // Ağırlık merkezi arkada — arka uçtaki karşı ağırlık modellenmiş oluyor.
    // Değer ölçümle seçildi: askı noktaları [3.4, -2.2, -3.5], yani yaylar
    // ancak merkez bunların ortasına yakınken eşit basıyor. Boşta duran aracın
    // eğimi -0.4'te +1.56°, -0.7'de +0.78°, -1.0'de -0.08°.
    //
    // NOT: "araç öne baskı yapıyor" şikâyetinin asıl sebebi bu DEĞİLDİ — yol
    // konumunda bomun ağırlığı şasinin 4 metre önüne biniyordu. Onun çözümü
    // crane.ts'teki bom yatağı (boom rest). Burada sadece aracın kendi
    // süspansiyonunda düz oturmasını sağlıyoruz.
    this.chassis.setMassData({
      mass: TRUCK.chassisTonnes * 1000,
      center: { x: -1.0, y: -0.15 },
      I: 150_000,
    });
    snaps.track(this.chassis);

    TRUCK.axles.forEach((dx, i) => {
      const wheel = world.createDynamicBody({ x: spawnX + dx, y: TRUCK.wheelRadius });
      wheel.createFixture(new Circle(TRUCK.wheelRadius), {
        density: 1, friction: 1.4, restitution: 0.05,
        filterGroupIndex: TRUCK_GROUP,
      });
      wheel.setMassData({
        mass: TRUCK.wheelTonnes * 1000,
        center: { x: 0, y: 0 },
        I: TRUCK.wheelTonnes * 1000 * TRUCK.wheelRadius ** 2 * 0.5,
      });

      const joint = world.createJoint(new WheelJoint({
        motorSpeed: 0,
        maxMotorTorque: TRUCK.maxMotorTorque,
        enableMotor: TRUCK.drivenAxles.includes(i),
        frequencyHz: TRUCK.suspensionHz,
        dampingRatio: TRUCK.suspensionDamping,
      }, this.chassis, wheel, wheel.getPosition(), { x: 0, y: 1 })) as WJ;

      this.wheels.push(snaps.track(wheel));
      this.joints.push(joint);
    });
  }

  /** Her fizik adımında, world.step()'ten önce. */
  drive(input: DriveInput): void {
    const { throttle, handbrake } = input;

    this.joints.forEach((joint, i) => {
      const driven = TRUCK.drivenAxles.includes(i);

      if (handbrake) {
        // Fren tüm tekerleklerde: motoru sıfır hıza kilitle.
        joint.enableMotor(true);
        joint.setMaxMotorTorque(TRUCK.handbrakeTorque);
        joint.setMotorSpeed(0);
        return;
      }

      if (!driven) { joint.enableMotor(false); return; }

      if (throttle !== 0) {
        joint.enableMotor(true);
        joint.setMaxMotorTorque(TRUCK.maxMotorTorque);
        // planck'te pozitif açısal hız saat yönünün tersi; ileri gitmek için negatif.
        joint.setMotorSpeed(-throttle * TRUCK.maxWheelSpeed);
      } else {
        // Gaz yokken motor freni — tam serbest bırakmak kamyonu kaygan hissettiriyor.
        joint.enableMotor(true);
        joint.setMaxMotorTorque(TRUCK.maxMotorTorque * 0.12);
        joint.setMotorSpeed(0);
      }
    });
  }

  /** Yatay hız, km/s. HUD için. */
  get speedKmh(): number {
    return Math.abs(this.chassis.getLinearVelocity().x) * 3.6;
  }

  get position(): { x: number; y: number } {
    const p = this.chassis.getPosition();
    return { x: p.x, y: p.y };
  }

  reset(spawnX = TRUCK.spawnX): void {
    const restHeight = TRUCK.wheelRadius + TRUCK.chassisHalfHeight + 0.42;
    this.chassis.setTransform({ x: spawnX, y: restHeight }, 0);
    this.chassis.setLinearVelocity({ x: 0, y: 0 });
    this.chassis.setAngularVelocity(0);
    this.wheels.forEach((w, i) => {
      w.setTransform({ x: spawnX + (TRUCK.axles[i] ?? 0), y: TRUCK.wheelRadius }, 0);
      w.setLinearVelocity({ x: 0, y: 0 });
      w.setAngularVelocity(0);
    });
  }
}
