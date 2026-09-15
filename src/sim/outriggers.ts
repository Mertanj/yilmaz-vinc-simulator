import { Box, PrismaticJoint, RevoluteJoint, Vec2,
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
  /**
   * Bağlanma noktaları. Pabuçlar TEKERLEKLERDEN DIŞARIDA olmalı.
   *
   * Ön ayak önce x=2.0'daydı ve pabuk +2.96'ya basıyordu; ön tekerlek ise
   * +3.40'ta, yani tekerlek pabuktan dışarıdaydı. Burun aşağı bastırınca ön
   * tekerlek yere değip dayanak oluyor ve ayaklar onu aşıp aracı
   * düzeltemiyordu — seviye kontrolünün kazancı ne olursa olsun 2.7°'de
   * takılmasının sebebi buydu, kontrolcü değil geometri.
   *
   * x=3.3'te pabuk +4.26'ya basıyor, tekerleğin dışında. Gerçek kamyon
   * vinçlerinde de ön ayak kabinin altında/önündedir.
   */
  mounts: [
    { x: 3.3, dir: 1 },    // ön ayak, ön tekerleğin dışına
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
  maxStroke: 2.15,
  /** Seviye ararken hedeflenen nominal uzama; kalanı düzeltme payı. */
  nominalStroke: 1.15,
  /** Bir ayağın nominalden sapabileceği en fazla miktar (m). */
  levelAuthority: 0.85,
  /** Çapraz açılma açısı: yataya göre. Büyük = daha geniş açıklık. */
  spreadRatio: 0.75,
  extendSpeed: 0.85,
  /**
   * Seviye kontrolü: PI.
   *
   * Önce sadece oransaldı ve yakınsamıyordu — kalıcı hata oransal kontrolde
   * kaçınılmaz. Hesap: kazanç 9 iken ayak farkı 2·corr/8.3 = 0.241·corr kadar
   * karşı eğim üretiyor, yani döngü kazancı 2.17. 8.5°'lik bozucu moment
   * 8.5/(1+2.17) = 2.7°'de dengeleniyordu; ölçülen değer tam buydu. Kazancı
   * büyütmek salınım riski getirir, integral terim kalıcı hatayı sıfırlar.
   */
  levelGain: 9.0,
  /** İntegral kazancı (radyan·saniye -> metre). */
  levelIntegralGain: 14.0,
  /**
   * Aracın ağırlığını kaldıracak ve YÜK ALTINDA çökmeyecek kadar yüksek olmalı.
   * İlk değer 5.0e5'ti ve 3.6 tonluk yük kaldırılırken ayaklar sıkışıp araç
   * 5° yatıyordu. Gerçek ayak silindiri kilit valfiyle rijit tutar.
   */
  maxMotorForce: 3.0e6,
  padHalfWidth: 0.42,
  padHalfHeight: 0.1,
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
  private levelIntegral = 0;

  constructor(world: World, private readonly chassis: Body, snaps: Snapshotter) {
    for (const m of OUTRIGGER.mounts) {
      const axis = Vec2.normalize({ x: m.dir * OUTRIGGER.spreadRatio, y: -1 });
      const mountLocal = new Vec2(m.x, OUTRIGGER.mountY);
      const anchor = this.chassis.getWorldPoint(mountLocal);

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
      // Pabuk düz bir plaka. İlk denemede daire yapılmıştı — temas kararlıydı
      // ama daire YUVARLANIR: araç iki tekerlek üstünde duruyor gibi oldu ve
      // ayaklar açıkken yavaşça geri kaydı (ölçümde 10 metre). Kutu + kilitli
      // dönüş doğrusu: pabuk yere düz basıyor, dönemiyor, ve mafsal sayesinde
      // şasi yine onun üzerinde eğilebiliyor.
      foot.createFixture(
        new Box(OUTRIGGER.padHalfWidth, OUTRIGGER.padHalfHeight),
        { density: 1, friction: 1.4 },
      );
      foot.setMassData({ mass: 900, center: { x: 0, y: 0 }, I: 120 });
      foot.setFixedRotation(true);

      world.createJoint(new RevoluteJoint({}, ram, foot, padPos));

      const joint = world.createJoint(new PrismaticJoint({
        enableMotor: true,
        motorSpeed: 0,
        maxMotorForce: OUTRIGGER.maxMotorForce,
        enableLimit: true,
        // Limit aralığı sıfırı içermeli, yoksa simülasyon başında sıçrar.
        lowerTranslation: 0,
        upperTranslation: OUTRIGGER.maxStroke,
      }, this.chassis, ram, anchor, axis)) as PJ;

      snaps.track(foot);
      this.legs.push({ joint, foot, mountLocal });
    }
  }

  toggle(): void { this.wantDeployed = !this.wantDeployed; }
  get deployedCommand(): boolean { return this.wantDeployed; }

  /**
   * Her fizik adımında, world.step()'ten önce.
   *
   * Ayaklar açıkken aracı **seviyeye getiriyor.** Gerçek operatör de tam olarak
   * bunu yapar: her ayağı ayrı ayrı oynatıp su terazisini ortalar. Olmadığında
   * bomun kendi ağırlığı burnu aşağı bastırıyor, arka ayak yerden kesiliyor ve
   * araç kalıcı olarak yatık kalıyordu.
   */
  update(dt: number): void {
    const base = this.wantDeployed ? OUTRIGGER.extendSpeed : -OUTRIGGER.extendSpeed;

    if (!this.wantDeployed) {
      this.levelIntegral = 0;
      for (const leg of this.legs) leg.joint.setMotorSpeed(base);
      return;
    }

    // Şasi açısı pozitif = saat yönünün tersi = burun yukarı.
    //
    // Hıza düzeltme eklemek yetmiyordu: iki ayak da strok sonuna dayanınca
    // düzeltecek pay kalmıyor ve araç 2.6° yatık kalıyordu. Artık her ayağın
    // kendi HEDEF uzaması var; strok nominalin üstünde pay bırakacak kadar
    // uzun, ve motorlar hedefe oransal kontrolle sürülüyor.
    const noseDown = -this.chassis.getAngle();

    // İntegral terimi yetki payı içinde biriktir; dışarı taşarsa sarmal
    // birikme (windup) olur ve araç ters yöne aşar.
    this.levelIntegral = clamp(
      this.levelIntegral + noseDown * OUTRIGGER.levelIntegralGain * dt,
      -OUTRIGGER.levelAuthority, OUTRIGGER.levelAuthority,
    );

    const corr = clamp(
      noseDown * OUTRIGGER.levelGain + this.levelIntegral,
      -OUTRIGGER.levelAuthority, OUTRIGGER.levelAuthority,
    );

    this.legs.forEach((leg, i) => {
      const front = (OUTRIGGER.mounts[i]?.dir ?? 1) > 0;
      const target = OUTRIGGER.nominalStroke + (front ? corr : -corr);
      const error = target - leg.joint.getJointTranslation();
      leg.joint.setMotorSpeed(
        clamp(error * 4, -OUTRIGGER.extendSpeed, OUTRIGGER.extendSpeed),
      );
    });
  }

  /**
   * 0 = tamamen toplu, 1 = tam açık.
   *
   * **Ortalama alınıyor, minimum değil.** Seviye düzeltmesi bir ayağı uzatıp
   * diğerini kısaltıyor; minimumu almak kısalan ayağı ölçüp aracı "yarı açık"
   * sayıyordu. Sonuç sadece kozmetik değildi — yük tablosu 0.6 ile çarpılıyor
   * ve kapasite 2.9 tondan 1.7 tona düşüyordu. Açılma durumu ile seviye
   * düzeltmesi ayrı şeyler; ortalama ikisini doğru ayırıyor.
   */
  get fraction(): number {
    if (this.legs.length === 0) return 0;
    let total = 0;
    for (const leg of this.legs) total += leg.joint.getJointTranslation();
    const avg = total / this.legs.length;
    return Math.max(0, Math.min(1, avg / OUTRIGGER.nominalStroke));
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
    this.levelIntegral = 0;
    for (const leg of this.legs) {
      const anchor = chassis.getWorldPoint(leg.mountLocal);
      leg.foot.setTransform({ x: anchor.x, y: anchor.y }, 0);
      leg.foot.setLinearVelocity({ x: 0, y: 0 });
      leg.foot.setAngularVelocity(0);
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
