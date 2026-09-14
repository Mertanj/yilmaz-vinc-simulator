import { Box, Circle, PrismaticJoint, RevoluteJoint, Vec2,
  type Body, type World, type PrismaticJoint as PJ } from 'planck';
import type { Snapshotter } from './world';
import { OutriggerState } from './loadChart';

/**
 * Outrigger (stabilizatör ayak) düzeneği.
 *
 * **Yan görünüm uyarlaması.** Gerçek kamyon vincinde ayaklar dört köşede ve
 * yanlara (ekrana doğru) açılır — yandan bakan bir oyunda bu hareket görünmez.
 * Bu yüzden ayakları öne ve arkaya çapraz açıyoruz: hem okunaklı, hem "açıklık
 * genişledi = daha stabil" mesajını doğrudan veriyor, hem de yük tablosundaki
 * outrigger çarpanına birebir karşılık geliyor.
 *
 * Fizik tarafında her ayak iki gövde:
 *
 *   şasi --PrismaticJoint(motor+limit)--> mil --RevoluteJoint--> pabuç
 *
 * **Pabuğun ayrı ve mafsallı olması şart.** İlk sürümde pabuk doğrudan
 * prismatic ile şasiye bağlıydı; prismatic joint iki gövde arasındaki DÖNMEYİ
 * de kilitlediği için iki ayak yere basınca şasi hiç eğilemiyordu. Sonuç: aşırı
 * kısıtlanmış bir sistem (ölçümde 0.65 m düzensiz kaldırma, ayaklar %58'de
 * takılı, 2.3° eğim) ve daha kötüsü — devrilme imkânsız hale geliyordu.
 * Mafsallı pabuç, şasinin bir pabuk üzerinde dönüp diğerini yerden kesmesine
 * izin veriyor; devrilme yine solverdan çıkıyor.
 *
 * Motor kuvveti aracın ağırlığını yenecek kadar yüksek olduğu için, ayaklar
 * yere bastığında şasi süspansiyondan kendiliğinden kalkıyor.
 */
export const OUTRIGGER = {
  /** Şasi üzerindeki bağlanma noktaları (x, y) ve açılma yönü. */
  mounts: [
    { x: 2.0, dir: 1 },    // ön ayak (kabin arkası), öne-aşağı
    { x: -4.4, dir: -1 },  // arka ayak, arkaya-aşağı
  ],
  mountY: -0.1,
  /** Pabuğun mil ucundaki sabit ofseti (m). */
  legLength: 0.45,
  /**
   * Tam açıldığında milin uzama miktarı (m).
   *
   * Hesaplanmış: bağlantı yerden 1.04 m yukarıda, eksenin dikey bileşeni 0.8.
   * Pabuk 0.70 m'de yere değiyor, 0.35 m kaldırma için toplam 1.14 m.
   * İlk denemede 2.9 m verilmişti ve araç 1.67 m kalkıyordu — gerçek bir vinç
   * süspansiyonu boşaltacak kadar, ~30 cm kalkar.
   */
  maxStroke: 1.15,
  /** Çapraz açılma açısı: yataya göre. Büyük = daha geniş açıklık. */
  spreadRatio: 0.75,
  extendSpeed: 0.85,
  /** Aracın ağırlığını kaldıracak kadar yüksek olmalı. */
  maxMotorForce: 5.0e5,
  padRadius: 0.12,
  /** Bu oranın altında "toplu", üstünde "tam açık" sayılır. */
  halfThreshold: 0.35,
  fullThreshold: 0.88,
} as const;

interface Leg {
  joint: PJ;
  foot: Body;
  mountLocal: Vec2;
}

export class Outriggers {
  private readonly legs: Leg[] = [];
  /** Oyuncunun komutu: açık mı kapalı mı. */
  private wantDeployed = false;

  constructor(world: World, chassis: Body, snaps: Snapshotter) {
    for (const m of OUTRIGGER.mounts) {
      const axis = Vec2.normalize({ x: m.dir * OUTRIGGER.spreadRatio, y: -1 });
      const mountLocal = new Vec2(m.x, OUTRIGGER.mountY);
      const anchor = chassis.getWorldPoint(mountLocal);

      // Mil: şasiye kızakla bağlı, dönmesi şasiye kilitli (gerçekte de öyle).
      const ram = world.createDynamicBody({ x: anchor.x, y: anchor.y });
      ram.createFixture(new Box(0.16, 0.16), { density: 1, isSensor: true });
      // planck'in 10:1 kütle oranı sınırı bir vinç oyununda doğrudan bizi
      // vuruyor: 20 t şasiyi taşıyacak parçalar çok hafif olamaz.
      ram.setMassData({ mass: 1400, center: { x: 0, y: 0 }, I: 200 });

      // Pabuç: milin ucuna MAFSALLI. Şasinin bir pabuk üzerinde dönebilmesi
      // için gerekli — devrilmenin emergent kalmasını sağlayan şey bu.
      const padPos = {
        x: anchor.x + axis.x * OUTRIGGER.legLength,
        y: anchor.y + axis.y * OUTRIGGER.legLength,
      };
      const foot = world.createDynamicBody(padPos);
      // Fizik şekli küçük bir daire: köşesi zemine takılmıyor, temas kararlı.
      // Görsel dikdörtgen pabuk OutriggerView'de ayrıca çiziliyor.
      foot.createFixture(new Circle(OUTRIGGER.padRadius), { density: 1, friction: 1.2 });
      foot.setMassData({ mass: 900, center: { x: 0, y: 0 }, I: 120 });

      world.createJoint(new RevoluteJoint({}, ram, foot, padPos));

      const joint = world.createJoint(new PrismaticJoint({
        enableMotor: true,
        motorSpeed: 0,
        maxMotorForce: OUTRIGGER.maxMotorForce,
        enableLimit: true,
        // Limit aralığı sıfırı içermeli, yoksa simülasyon başında sıçrar.
        lowerTranslation: 0,
        upperTranslation: OUTRIGGER.maxStroke,
      }, chassis, ram, anchor, axis)) as PJ;

      snaps.track(foot);
      this.legs.push({ joint, foot, mountLocal });
    }
  }

  toggle(): void { this.wantDeployed = !this.wantDeployed; }
  get deployedCommand(): boolean { return this.wantDeployed; }

  /** Her fizik adımında, world.step()'ten önce. */
  update(): void {
    const speed = this.wantDeployed ? OUTRIGGER.extendSpeed : -OUTRIGGER.extendSpeed;
    for (const leg of this.legs) leg.joint.setMotorSpeed(speed);
  }

  /** 0 = tamamen toplu, 1 = tam açık. Ayakların en azı belirler. */
  get fraction(): number {
    let min = 1;
    for (const leg of this.legs) {
      min = Math.min(min, leg.joint.getJointTranslation() / OUTRIGGER.maxStroke);
    }
    return Math.max(0, Math.min(1, min));
  }

  /** Yük tablosuna verilecek durum. */
  get state(): OutriggerState {
    const f = this.fraction;
    if (f >= OUTRIGGER.fullThreshold) return OutriggerState.Full;
    if (f >= OUTRIGGER.halfThreshold) return OutriggerState.Half;
    return OutriggerState.Stowed;
  }

  /** Render için: her ayağın şasi bağlantısı ve pabuç konumu. */
  geometry(chassis: Body): Array<{ from: Vec2; to: Vec2 }> {
    return this.legs.map((leg) => ({
      from: chassis.getWorldPoint(leg.mountLocal),
      to: leg.foot.getWorldCenter(),
    }));
  }

  get feet(): Body[] { return this.legs.map((l) => l.foot); }

  reset(chassis: Body): void {
    this.wantDeployed = false;
    for (const leg of this.legs) {
      const anchor = chassis.getWorldPoint(leg.mountLocal);
      leg.foot.setTransform({ x: anchor.x, y: anchor.y }, 0);
      leg.foot.setLinearVelocity({ x: 0, y: 0 });
      leg.foot.setAngularVelocity(0);
    }
  }
}
