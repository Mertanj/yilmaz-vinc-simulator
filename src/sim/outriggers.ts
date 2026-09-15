import { Circle, PrismaticJoint, Vec2,
  type Body, type World, type PrismaticJoint as PJ } from 'planck';
import { TRUCK_GROUP, type Snapshotter } from './world';
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
 * Fizik tarafında her ayak TEK joint:
 *
 *   şasi --PrismaticJoint(motor+limit)--> pabuç
 *
 * **Araya mil + mafsal koymak denendi ve başarısız oldu.** Amaç şasinin bir
 * pabuk üzerinde dönebilmesiydi. Ama zincir `şasi → mil → mafsal → pabuk →
 * zemin` olunca 900 kg'lık pabuk 24 tonluk şasiyi taşımaya çalışıyor ve
 * planck'in belgelediği kural devreye giriyor: *"daha hafif bir gövde daha
 * ağırını taşıyorsa mafsallar esner."* Ölçümde joint 2.14 m uzama raporlarken
 * bağlantı–pabuk gerçek mesafesi bambaşkaydı: mafsal kopmuştu. Araç da hiç
 * kalkmıyordu.
 *
 * Zincir kısaltıldı: pabuk doğrudan şasiye prismatic ile bağlı, tek kısıt.
 * Prismatic dönmeyi de kilitliyor, ama bu artık sorun değil — iki pabuk da
 * yerdeyken şasinin dönmemesi zaten istenen şey (kriko üstünde bir vinç öyle
 * durur), ve aşırı yüklenince bir pabuk yerden kesildiği anda (temas tek
 * yönlü) şasi diğerinin üzerinde dönebiliyor. Devrilme emergent kalıyor.
 *
 * Pabuğun çarpışma şekli DAİRE: kutu köşesi araç yatınca zemine takılıyor.
 * Yuvarlanma sorunu yok, çünkü prismatic pabuğun dönüşünü şasiye kilitliyor —
 * daha önce daire serbest mafsaldayken yuvarlanıp aracı 10 metre geri
 * kaydırmıştı.
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
   * x=3.9'da pabuk +4.86'ya basıyor: hem tekerleğin (+3.95 ön kenar) dışında
   * hem de bacak lastiğin önünden geçiyor. Gerçek kamyon vinçlerinde de ön
   * ayak kabinin altında/önündedir.
   */
  mounts: [
    { x: 3.9, dir: 1 },    // ön ayak, ön tekerleğin önüne
    { x: -4.4, dir: -1 },  // arka ayak, arkaya-aşağı
  ],
  mountY: -0.1,
  /** Pabuğun mil ucundaki sabit ofseti (m). */
  legLength: 0.45,
  /**
   * Hedef: bağlantı noktasının yerden yüksekliği (m).
   *
   * **Kontrol edilen büyüklük strok değil, bu.** Strok komutu vermek yanlıştı:
   * kontrolcü 2.0 m uzama istiyordu, oysa o yükseklikten pabuğun yere değmesi
   * için 0.7 m yetiyor. Mil pabuğu yerin 1.3 m altına sürmeye çalışıyor, zemin
   * durduruyor ve mil–pabuk mafsalı kopuyordu (ölçümde joint 1.99 diyordu ama
   * gerçek mesafe 1.44'tü). Gerçek bir ayak silindiri de böyle çalışmaz: pabuk
   * yere değene kadar açılır, sonra aracı kaldırır.
   *
   * Yükseklik hedefi aynı zamanda seviyeyi KENDİLİĞİNDEN sağlıyor: iki
   * bağlantının yerel y'si eşit olduğu için ikisi de aynı dünya yüksekliğine
   * gelirse şasi düzdür. Ayrı bir PID gerekmiyor.
   *
   * 1.50 m, süspansiyon tam açıkken bağlantının olacağı yüksekliğin biraz
   * üstünde — yani lastikler yerden kesiliyor.
   */
  targetMountHeight: 1.50,
  /**
   * Komutun anlık stroktan ne kadar önde olabileceği (m).
   *
   * Mafsalın kopmasının sebebi komutun 1.3 metre ileride olmasıydı. Önce
   * "pabuk yere değince tavan koy" denendi ve bu sefer araç hiç kalkmadı:
   * kaldırmak için ayağın temas noktasının ÖTESİNE bastırması gerekiyor, tavan
   * tam da onu yasaklıyordu (arka ayak tavanı aşınca geri çekilme komutu bile
   * alıyordu).
   *
   * Doğrusu tavan değil, önde gitme sınırı: komut her an stroktan en fazla
   * 15 cm ileride. Bu kadarı kaldırma kuvvetini üretmeye yetiyor, ama mafsalı
   * koparacak kadar değil. Araç yükseldikçe hata küçülüyor ve kendiliğinden
   * duruyor.
   */
  maxCommandLead: 0.15,
  /**
   * Tam açıldığında milin uzama miktarı (m).
   *
   * Hesaplanmış: bağlantı yerden 1.04 m yukarıda, eksenin dikey bileşeni 0.8.
   * Pabuk 0.70 m'de yere değiyor, 0.35 m kaldırma için toplam 1.14 m.
   * İlk denemede 2.9 m verilmişti ve araç 1.67 m kalkıyordu — gerçek bir vinç
   * süspansiyonu boşaltacak kadar, ~30 cm kalkar.
   */
  maxStroke: 2.15,
  /** HUD'da "%100 açık" sayılacak nominal uzama — ölçülen yerleşme değeri. */
  nominalStroke: 1.25,
  /** Çapraz açılma açısı: yataya göre. Büyük = daha geniş açıklık. */
  spreadRatio: 0.75,
  extendSpeed: 0.85,
  /** Yükseklik hatasını strok hızına çeviren kazanç. */
  heightGain: 3.0,
  /**
   * Aracın ağırlığını kaldıracak ve YÜK ALTINDA çökmeyecek kadar yüksek olmalı.
   * İlk değer 5.0e5'ti ve 3.6 tonluk yük kaldırılırken ayaklar sıkışıp araç
   * 5° yatıyordu. Gerçek ayak silindiri kilit valfiyle rijit tutar.
   */
  maxMotorForce: 3.0e6,
  padRadius: 0.12,
  /** Bu oranın altında "toplu", üstünde "tam açık" sayılır. */
  halfThreshold: 0.35,
  fullThreshold: 0.88,
} as const;

interface Leg {
  joint: PJ;
  foot: Body;
  mountLocal: Vec2;
  /** Kızak ekseni, şasi yerel çerçevesinde. */
  axisLocal: Vec2;
}

export class Outriggers {
  private readonly legs: Leg[] = [];
  /** Oyuncunun komutu: açık mı kapalı mı. */
  private wantDeployed = false;

  constructor(world: World, private readonly chassis: Body, snaps: Snapshotter) {
    for (const m of OUTRIGGER.mounts) {
      const axis = Vec2.normalize({ x: m.dir * OUTRIGGER.spreadRatio, y: -1 });
      const mountLocal = new Vec2(m.x, OUTRIGGER.mountY);
      const anchor = this.chassis.getWorldPoint(mountLocal);

      // Pabuk: doğrudan şasiye bağlı. Dönüşü kilitli daire — kutu köşesi
      // zemine takılıyor, serbest daire yuvarlanıyordu.
      const padPos = {
        x: anchor.x + axis.x * OUTRIGGER.legLength,
        y: anchor.y + axis.y * OUTRIGGER.legLength,
      };
      const foot = world.createDynamicBody(padPos);
      foot.createFixture(new Circle(OUTRIGGER.padRadius), {
        density: 1, friction: 1.4, filterGroupIndex: TRUCK_GROUP,
      });
      foot.setMassData({ mass: 900, center: { x: 0, y: 0 }, I: 120 });
      // setFixedRotation YOK. Denendi ve sistemi bozdu: prismatic pabuğun
      // dönüşünü şasiye bağlar; pabuğun dönüşü ayrıca dünyaya kilitlenince
      // şasi de dünyaya dönüşsüz kilitleniyor. Eğim tam 0.00° çıkıyordu ama
      // sebebi seviye kontrolü değil, aracın döndürülemez olmasıydı —
      // devrilme de imkânsız hale geliyordu, üstelik ayaklar jamlanıyordu.
      // Daire + prismatic zaten yeterli: dönüş kilitli olduğu için yuvarlanmaz.

      const joint = world.createJoint(new PrismaticJoint({
        enableMotor: true,
        motorSpeed: 0,
        maxMotorForce: OUTRIGGER.maxMotorForce,
        enableLimit: true,
        // Limit aralığı sıfırı içermeli, yoksa simülasyon başında sıçrar.
        lowerTranslation: 0,
        upperTranslation: OUTRIGGER.maxStroke,
      }, this.chassis, foot, padPos, axis)) as PJ;

      snaps.track(foot);
      this.legs.push({ joint, foot, mountLocal, axisLocal: axis });
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
  update(): void {
    if (!this.wantDeployed) {
      for (const leg of this.legs) leg.joint.setMotorSpeed(-OUTRIGGER.extendSpeed);
      return;
    }

    for (const leg of this.legs) {
      const mount = this.chassis.getWorldPoint(leg.mountLocal);
      // Eksenin dünyadaki düşey bileşeni; mil şasiye kilitli olduğu için
      // araç yattıkça eksen de yatıyor.
      const axis = this.chassis.getWorldVector(leg.axisLocal);
      const down = Math.max(-axis.y, 0.25);

      const ext = leg.joint.getJointTranslation();

      // Hedef: bağlantıyı istenen yüksekliğe getirecek strok. Komut stroktan
      // en fazla maxCommandLead kadar önde olabilir.
      const heightError = OUTRIGGER.targetMountHeight - mount.y;
      const lead = clamp(
        heightError / down, -OUTRIGGER.maxCommandLead, OUTRIGGER.maxCommandLead,
      );
      const target = clamp(ext + lead, 0, OUTRIGGER.maxStroke);

      leg.joint.setMotorSpeed(clamp(
        (target - ext) * OUTRIGGER.heightGain,
        -OUTRIGGER.extendSpeed, OUTRIGGER.extendSpeed,
      ));
    }
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
