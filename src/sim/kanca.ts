import { Box, DistanceJoint, RevoluteJoint, Vec2,
  type Body, type World, type DistanceJoint as DJ } from 'planck';
import { TRUCK_GROUP, type Snapshotter } from './world';

/**
 * Kanca düzeneği: kanca bloğu, halat ve yüke bağlanma.
 *
 * **Neden ayrı bir sınıf.** Üçüncü makine (dirsekli bom) yazılırken ortaya
 * çıktı: teleskopik vinçle dirsekli vincin paylaşmadığı şey BOM, paylaştığı
 * şey ise kancanın tamamı. Kanca bir noktadan sarkıyor ve o noktayı neyin
 * ürettiğini bilmesi gerekmiyor — düz bom da olur, iki eklemli bom da.
 *
 * Buradaki kod kopyalanacak cinsten değil: yorumların anlattığı her tuzağa
 * bir kez düşüldü ve teşhisleri pahalı oldu (uyku kipi, `setFixedRotation`
 * sırası, çözülmemiş mafsalın fırlatan tepki kuvveti). İkinci bir kopya o
 * hataları ikinci kez davet ederdi.
 */

/** Kancanın tutabileceği bir yük. */
export interface Grabbable {
  body: Body;
  halfWidth: number;
  halfHeight: number;
  /**
   * Paletin ayak yüksekliği (m) — gövdenin alt yüzü ile zemin arasındaki cep.
   *
   * Forklift bunu iki yerde kullanıyor: çatal buraya giriyor, ve yükün
   * gerçekten KALDIRILDIĞINI anlamanın ölçüsü ayakların yerden kesilmesi.
   * Vinç yükleri paletsiz, dolayısıyla 0.
   */
  ayakM?: number;
}

/** Bağlanma neden olmadı — oyuncuya söylenecek gerekçe. */
export type AttachReason =
  | 'hazir' | 'uzak' | 'ortala' | 'yukseklik' | 'sallaniyor' | 'yan-cekme';

/** Makineye göre değişen ölçüler; kanca mantığı aynı kalıyor. */
export interface KancaAyari {
  /** Kanca bloğunun kütlesi (t). */
  kancaTon: number;
  /** Kanca bloğunun atalet momenti. */
  kancaAtalet: number;
  /** Blok yarı-genişliği ve yarı-yüksekliği (m). */
  yariEn: number;
  yariBoy: number;
  /** Bloğun merkezinden yükü tuttuğu boğaza mesafe (m). */
  bogazM: number;
  /** Bu hızın üstünde sallanan kancaya yük bağlanmıyor (m/s). */
  baglanmaMaxHizMps: number;
  /** Halat düşeyden bu kadar saparsa yan çekme sayılıyor (m). */
  maxYanCekmeM: number;
  /** Yükün merkezi kancanın boğazına bu kadar yakın olmalı (m). */
  merkezToleransM: number;
  /** Boğaz, yükün üst yüzeyinin bu kadar altında/üstünde olabilir (m). */
  ustunAltiM: number;
  ustunUstuM: number;
  /** Sapan takımı: yük bağlıyken dönmeye direnç. */
  sapanAcisalSonum: number;
  /** Yol konumunda kanca toplanır ve sönümlenir. */
  yolSonum: number;
  calismaDogrusalSonum: number;
  calismaAcisalSonum: number;
}

export class Kanca {
  readonly hook: Body;
  private readonly cable: DJ;
  private attached: Body | null = null;
  private attachJoint: RevoluteJoint | null = null;
  private birakilanAcisalSonum = 0.5;
  private baglaBekliyor = false;
  private birakBekliyor = false;
  private yolda = true;

  constructor(
    private readonly world: World,
    snaps: Snapshotter,
    private readonly ayar: KancaAyari,
    /** Halatın asıldığı gövde ve o gövde üzerindeki yerel uç noktası. */
    private readonly ucGovde: Body,
    private readonly ucYerel: Vec2,
    halatM: number,
  ) {
    const uc = ucGovde.getWorldPoint(ucYerel);
    this.hook = world.createDynamicBody({ x: uc.x, y: uc.y - halatM });
    // **Kanca aracın kendi takımı — şasiye ve tekerlere çarpmaz.**
    //
    // Teleskopik vinçte hiç ortaya çıkmadı, çünkü orada kanca kamyonun
    // üstüne hiç gelmiyor. Dirsekli bomda ise YOL KONUMUNUN TANIMI bu:
    // bom Z gibi katlanıp kanca kasanın üstünde duruyor.
    //
    // Filtresiz halinde ölçüm şunu gösterdi: kanca ilk karede şasi
    // kutusunun (y 0.97–1.81) içinde, y=1.25'te doğuyor. Temas çözücü onu
    // dışarı itiyor, RİJİT halat geri çekiyor ve kavga büyüyor —
    // 20.8 kN (t=0) → 2732 kN (t=0.6). O kuvveti şasiye elle uyguladığımız
    // için kamyon 1.4 saniyede 16.5 dereceye yatıyordu. Devrilmenin sebebi
    // bom değil, kendi kancasına çarpan kamyondu.
    this.hook.createFixture(new Box(ayar.yariEn, ayar.yariBoy), {
      density: 1, friction: 0.8, filterGroupIndex: TRUCK_GROUP,
    });

    // Kanca bloğu HİÇ dönmez: ucunda ağırlık var gibi hep aşağı bakar. Gerçek
    // kanca bloğu da ağırdır ve halat ekseninde asılı kalır.
    //
    // **SIRA ÖNEMLİ.** setFixedRotation içeride resetMassData() çağırıyor, o da
    // kütleyi fikstür yoğunluğundan yeniden hesaplıyor. Önce setMassData yazıp
    // sonra bunu çağırdığımızda 450 kiloluk kanca sessizce 0.408 kiloya düştü;
    // 2.4 tonluk yükün karşısında 5882:1 kütle oranı kaldı ve planck'in
    // "hafif gövde ağırını taşıyamaz" kuralı devreye girdi — halat 8 metre
    // kısaldığı halde yük yerinden kıpırdamadı. Kütleyi EN SON yazıyoruz.
    this.hook.setFixedRotation(true);
    this.hook.setSleepingAllowed(false);
    this.kutleyiYaz(ayar.kancaTon);
    this.hook.setLinearDamping(ayar.yolSonum);
    this.hook.setAngularDamping(ayar.yolSonum);

    // Halat RİJİT. frequencyHz verilirse yay gibi esner; spike'ta 3.45 t altında
    // yükü emniyet halatı taşımaya başladı ve kuvvet okuması yarıya düştü.
    this.cable = world.createJoint(new DistanceJoint({
      length: halatM,
      collideConnected: true,
    }, ucGovde, this.hook, uc, this.hook.getWorldCenter())) as DJ;

    snaps.track(this.hook);
  }

  /** Bom ucunun dünyadaki yeri — halatın asıldığı nokta. */
  get ucDunya(): { x: number; y: number } {
    const p = this.ucGovde.getWorldPoint(this.ucYerel);
    return { x: p.x, y: p.y };
  }

  halatiAyarla(m: number): void { this.cable.setLength(m); }

  /** Kanca bloğunun kütlesi (t) — halat katı değişince yeniden yazılıyor. */
  kutleyiYaz(ton: number): void {
    this.hook.setMassData({
      mass: ton * 1000, center: { x: 0, y: 0 }, I: this.ayar.kancaAtalet,
    });
  }

  /**
   * Yol konumu: kanca bom ucuna toplanır ve sönümlenir.
   *
   * Sürerken kancayı serbest bırakmak fizik olarak doğru ama oynanış olarak
   * saçma: testte kanca 78°'ye savruluyordu. Gerçek vinçte kanca yola
   * çıkmadan önce bağlanır. Çalışma moduna geçince sönüm neredeyse sıfıra
   * iniyor — sarkaç oyunun asıl becerisi, onu bastırmıyoruz.
   */
  yolKonumu(yolda: boolean): void {
    if (yolda === this.yolda) return;
    this.yolda = yolda;
    const a = this.ayar;
    this.hook.setLinearDamping(yolda ? a.yolSonum : a.calismaDogrusalSonum);
    this.hook.setAngularDamping(yolda ? a.yolSonum : a.calismaAcisalSonum);
  }

  /** Kancanın gerçekten yükü tuttuğu nokta — blok merkezi değil, boğaz. */
  get tutmaNoktasi(): { x: number; y: number } {
    const c = this.hook.getWorldCenter();
    return { x: c.x, y: c.y - this.ayar.bogazM };
  }

  get yukVar(): boolean { return this.attached !== null; }

  /** Salınım açısı (derece) — kancanın bom ucuna göre düşeyden sapması. */
  get salinimDeg(): number {
    const uc = this.ucDunya;
    const h = this.hook.getWorldCenter();
    return (Math.atan2(h.x - uc.x, uc.y - h.y) * 180) / Math.PI;
  }

  /**
   * Halat kuvveti, henüz çözülmemişse null.
   *
   * try/catch şart: planck'te DistanceJoint'in tepki kuvveti ancak hız
   * kısıtları bir kez çözüldükten sonra tanımlı. İlk karede iç vektör yok ve
   * metot DÖNMÜYOR, FIRLATIYOR — dönen değeri kontrol etmek yetmiyor.
   */
  halatKuvveti(dt: number): { x: number; y: number } | null {
    try {
      const f = this.cable.getReactionForce(1 / dt) as { x: number; y: number } | undefined;
      if (f && Number.isFinite(f.x) && Number.isFinite(f.y)) return f;
    } catch {
      // Henüz bir adım atılmadı; kuvvet tanımsız.
    }
    return null;
  }

  /**
   * Bağlanma denetimi — sadece evet/hayır değil, GEREKÇE de veriyor.
   *
   * Önce yalnız boolean dönüyordu ve oyuncu kancanın neden tutmadığını
   * anlayamıyordu; üç ayrı koşulun hangisinin tutmadığını söylemek, kancayı
   * yükün üstüne indirmeyi tahmin oyunu olmaktan çıkarıyor.
   */
  baglanmaDenetimi(adaylar: Grabbable[]): { item: Grabbable | null; reason: AttachReason } {
    const a = this.ayar;
    const v = this.hook.getLinearVelocity();
    if (Math.hypot(v.x, v.y) > a.baglanmaMaxHizMps) {
      return { item: null, reason: 'sallaniyor' };
    }
    // Halat düşeyden ne kadar sapmış? Bom ucu ile kanca arasındaki yatay fark.
    if (Math.abs(this.ucDunya.x - this.hook.getPosition().x) > a.maxYanCekmeM) {
      return { item: null, reason: 'yan-cekme' };
    }

    const g = this.tutmaNoktasi;
    let nearMiss: AttachReason = 'uzak';
    for (const item of adaylar) {
      const p = item.body.getWorldCenter();
      const topY = p.y + item.halfHeight;
      const sideOk = Math.abs(p.x - g.x) <= a.merkezToleransM;
      const heightOk = g.y >= topY - a.ustunAltiM && g.y <= topY + a.ustunUstuM;
      if (sideOk && heightOk) return { item, reason: 'hazir' };
      if (heightOk && Math.abs(p.x - g.x) <= item.halfWidth + 1.0) nearMiss = 'ortala';
      else if (sideOk) nearMiss = 'yukseklik';
    }
    return { item: null, reason: nearMiss };
  }

  baglanabilir(adaylar: Grabbable[]): boolean {
    return !this.attached && this.baglanmaDenetimi(adaylar).item !== null;
  }

  baglaBirakIste(): void {
    if (this.attached) this.birakBekliyor = true;
    else this.baglaBekliyor = true;
  }

  /** Mafsal kurma/yıkma **world.step()'in dışında** yapılmalı. */
  mafsalKuyrugunuBosalt(adaylar: Grabbable[]): void {
    if (this.birakBekliyor && this.attachJoint) {
      this.attached?.setAngularDamping(this.birakilanAcisalSonum);
      this.attached?.setSleepingAllowed(true);
      this.world.destroyJoint(this.attachJoint);
      this.attachJoint = null;
      this.attached = null;
    }
    this.birakBekliyor = false;

    if (this.baglaBekliyor && !this.attached) {
      const { item } = this.baglanmaDenetimi(adaylar);
      if (item) {
        const p = item.body.getWorldCenter();

        // **Yük kancanın tam altına hizalanır ve düzleştirilir.**
        //
        // Gerçekte yük iki noktadan sapanlanır ve ağırlık merkezinin üstünden
        // asılır; oyunda tek noktadan tuttuğumuz için dengeyi açıkça kurmak
        // gerekiyor. Sapan gerilirken yükün kendini toparlaması zaten olan bir
        // şey, o yüzden bu kaydırma sahada da doğal görünüyor.
        //
        // Bağlanma noktası olarak yükün üst ortası DENENDİ ve olmadı: kanca ile
        // pim arasında 1.5 metreye varan bir kol oluşuyor, kısıt esniyor ve yük
        // hiç kalkmıyordu (halat kuvveti sadece kancayı okuyordu). Pim kancanın
        // boğazında kalmalı; dengeyi yükü hizalayarak sağlıyoruz.
        const g = this.tutmaNoktasi;
        item.body.setTransform({ x: g.x, y: p.y }, 0);
        item.body.setLinearVelocity({ x: 0, y: 0 });
        item.body.setAngularVelocity(0);
        // **Uyandırmak şart.** planck'te ne setTransform ne de sıfır hız ataması
        // gövdeyi uyandırır; yerde duran yük uyku modunda kalıp joint'e hiç
        // tepki vermiyordu. Kanca yükseliyor, yük yerde kalıyor, halat boşta —
        // LMI 0.16 t okuyordu.
        item.body.setAwake(true);
        item.body.setSleepingAllowed(false);
        this.hook.setAwake(true);

        // Sapan takımı: yük bağlıyken dönmeye karşı direnir, bırakınca serbest.
        this.birakilanAcisalSonum = item.body.getAngularDamping();
        item.body.setAngularDamping(this.ayar.sapanAcisalSonum);

        this.attachJoint = this.world.createJoint(
          new RevoluteJoint({}, this.hook, item.body, g),
        ) as RevoluteJoint;
        this.attached = item.body;
      }
    }
    this.baglaBekliyor = false;
  }
}
