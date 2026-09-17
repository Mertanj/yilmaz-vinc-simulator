import { Vec2, type Body, type World } from 'planck';
import type { Snapshotter } from './world';
import {
  Kanca, type AttachReason, type Grabbable, type KancaAyari,
} from './kanca';
import {
  capacityAt, computeLmi, halatKapasitesi, KAT_SECENEKLERI, OutriggerState,
  type KatSayisi, type LmiReading,
} from './loadChart';

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
  /**
   * Bom ve teleskop için aynı rampa.
   *
   * Vince rampa konmuştu ama boma konmamıştı ve fatura ölçümde çıktı: LMI
   * zirvesi taşıma sırasında %172, halat kuvveti 10.8 t — statik 2.75 tonun
   * 3.9 KATI. Sebep basamak komut: tuşu bırakınca bom aynı karede duruyor,
   * rijit halat da bu duruşu yüke aynen geçiriyor. Gerçek bir hidrolik
   * kumanda kolu da, valfi de böyle davranmaz; ikisi de rampalıdır.
   */
  boomRampSec: 0.6,
  /**
   * İki-blok koruması (anti two-block): halat strok sonuna bu kadar kala vinç
   * yavaşlar. Gerçek vinçlerde bunu bir limit anahtarı yapar.
   *
   * Ölçümle geldi: tam hızda minRope'a çarpınca kanca bom ucuna tokatlanıyor,
   * darbe yükü savuruyordu — düzgün ilerleyen bir kaldırmada yük 3.5 saniyede
   * -0.8 dereceye oturmuşken çarpma anında yeniden -13.7 dereceye açılıyordu.
   */
  winchLimitFadeM: 1.6,

  /**
   * Kanca bloğunun ağırlığı, kat sayısına göre (ton).
   *
   * Çok katlı blokta daha fazla makara var, blok ağırlaşıyor — ve bu ağırlık
   * doğrudan yükten düşülüyor. Liebherr'de 1 kattan 12 kata blok 140 kg'dan
   * 760 kg'a çıkıyor; aynı eğrinin küçük vinç ölçeği.
   */
  hookTonnesByKat: { 1: 0.22, 2: 0.45, 4: 0.78 } as Record<number, number>,
  hookTonnes: 0.45,
  /**
   * Halatı yeniden geçirme (re-reeving) süresi, kat başına saniye.
   *
   * Sahada iki kişiyle 30–90 dakika sürüyor; oyuna o ölçekte alınamaz ama
   * BEDAVA da olmamalı — yoksa oyuncu her yükte en yüksek kata geçer ve karar
   * diye bir şey kalmaz. Değiştirmek kancayı yere indirmeyi ve beklemeyi
   * gerektiriyor; bedeli süre puanından çıkıyor.
   */
  reevingSecPerKat: 7.0,
  /** Kanca boğazının blok merkezine göre düşey ofseti (m) — görselle aynı. */
  hookThroatM: 0.46,
  /**
   * Kancanın bom kafasına en fazla yaklaşabileceği mesafe.
   *
   * 1.2 idi ve ölçümde pahalıya mal oldu: halat dibe vurunca yük fiilen bom
   * ucuna RİJİT bağlanıyor, bomun her ivmesi doğrudan yüke biniyor ve halat
   * kuvveti 13.7 tona (statik yükün 5 katı) fırlıyordu. Gerçek kanca bloğu da
   * makara takımı yüzünden kafanın 1.5-2 metre altında durur; iki-blok zaten
   * vinççilikte yasak durumdur. 2.0 hem gerçek hem de o rijit kipi kapatıyor.
   */
  minRopeM: 2.0,
  /** Kat değiştirmek için kanca bu yüksekliğin altında olmalı (m). */
  reevingMaxHookY: 2.6,
  /** LMI okumasının zaman sabiti (s). Gerçek yük hücreleri de filtrelidir. */
  lmiFilterSec: 0.2,
  /**
   * İki-blok bölgesi: kanca bom kafasına bu kadar yaklaşınca kilit devreye
   * girer. Gerçek vinçte bunu, halatı çevreleyen ağırlıklı bir halka ve ona
   * bağlı limit anahtarı yapar; tetikleme mesafesi 30–46 cm.
   */
  ikiBlokPayiM: 0.55,
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
  /**
   * Yatay pencere — yükün KENARINA değil, MERKEZİNE göre.
   *
   * Önce yükün yarı genişliği + pay kullanılıyordu; 2.3 m genişliğindeki yükte
   * bu 1.7 metrelik bir tolerans demekti ve bağlanma anında yük kancanın altına
   * 1.06 m ışınlanıyordu. Ekranda yük yan sıçrıyor, sonra sarkaç gibi savrulup
   * 29 derece yatıyordu.
   *
   * Sapancı da kancayı gözüyle ağırlık merkezinin üstüne getirir; tek noktadan
   * asılan bir yük başka türlü dengelenmez. Dolayısıyla doğru kural dar bir
   * merkez penceresi: oyuncu kancayı yükün ortasına getirmek zorunda, karşılığında
   * yük dengeli kalkıyor ve kalan 45 santimlik düzeltme sapanın gerilmesi gibi
   * görünüyor.
   */
  attachCentreToleranceM: 0.45,

  /**
   * Bağlıyken yükün açısal sönümü — tek pimle iki noktalı sapanı taklit eder.
   *
   * Gerçekte yük iki noktadan sapanlanır ve sapan takımı yükü dönmeye karşı
   * kilitler; düzgün asılmış bir yük sallanır ama TAKLA ATMAZ. Oyunda tek pim
   * olduğu için yük pimin altında serbest bir sarkaç: ölçümde ±17° yalpalıyordu
   * ve "dengelemiyor" hissi veriyordu. Yüksek açısal sönüm, sapanın yaptığı işi
   * yapıyor — yatay sarkaç (oyunun asıl becerisi) hiç etkilenmiyor, çünkü o
   * doğrusal harekette.
   */
  slungAngularDamping: 6.0,
  attachBelowTopM: 0.7,
  attachAboveTopM: 1.7,
  attachMaxSpeedMps: 1.2,
  /**
   * Yan çekme (side pull) sınırı: halat düşeyden bu kadar sapabilir.
   *
   * Gerçekte yükü eğik halatla kaldırmak yasaktır — yük kalkar kalkmaz düşeye
   * savrulur, bom yanal zorlanır. Ölçümde tam olarak bu oldu: kanca yükün
   * üstüne oturunca halat eğik kalıyor, kaldırınca yük 2.4 metre savrulup
   * dönüyordu. Sınır koymak hem gerçekçi hem de oyuncuya asıl beceriyi
   * öğretiyor: önce sarkacı söndür, sonra bağla.
   */
  maxSidePullM: 0.7,
} as const;

/** Yol konumunda kancanın sönümü — savrulmasın diye. */
const STOW_DAMPING = 7.0;

/**
 * Çalışma konumunda sönüm — sarkaç oyunun asıl becerisi, onu bastırmıyoruz.
 *
 * Bir ara sıfıra yakındı (0.05) ve bu yanlış çıktı: sarkaç HİÇ sönmüyordu, yani
 * "salınım dursun, sonra bağla" diye bir hamle yoktu; ölçümde kanca 1.8 metre
 * genlikle sonsuza kadar gidiyordu. Gerçek kanca bloğu makara ve halat
 * sürtünmesiyle söner. 0.4 ile genlik ~3.5 saniyede yarıya iniyor: salınım hâlâ
 * bütün ağırlığıyla orada ama oyuncu bekleyip söndürebiliyor.
 */
const WORK_LINEAR_DAMPING = 0.4;
/** Kanca zaten setFixedRotation ile sabit; bu sadece bütünlük için. */
const WORK_ANGULAR_DAMPING = 0.05;

/** YV-25'in kanca düzeneği — ölçüler makineye ait, mantık ortak. */
const KANCA_AYARI: KancaAyari = {
  kancaTon: CRANE.hookTonnes,
  kancaAtalet: 90,
  yariEn: 0.3,
  yariBoy: 0.34,
  bogazM: CRANE.hookThroatM,
  baglanmaMaxHizMps: CRANE.attachMaxSpeedMps,
  maxYanCekmeM: CRANE.maxSidePullM,
  merkezToleransM: CRANE.attachCentreToleranceM,
  ustunAltiM: CRANE.attachBelowTopM,
  ustunUstuM: CRANE.attachAboveTopM,
  sapanAcisalSonum: CRANE.slungAngularDamping,
  yolSonum: STOW_DAMPING,
  calismaDogrusalSonum: WORK_LINEAR_DAMPING,
  calismaAcisalSonum: WORK_ANGULAR_DAMPING,
};

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
// Kanca düzeneğinin tipleri artık `kanca.ts`'te: dirsekli bom da aynı kancayı
// kullanıyor. Buradan yeniden dışa veriliyor ki mevcut import'lar bozulmasın.
export type { Grabbable, AttachReason } from './kanca';

/**
 * Kat değiştirme reddedilince sebebi — metin değil KOD.
 *
 * Önceden Türkçe cümle dönüyordu ve zaten hiçbir yerde okunmuyordu; artık
 * uyarı şeridine çıkıyor, dolayısıyla çevrilebilir olmak zorunda.
 */
export type KatRet = '' | 'suruyor' | 'yuklu' | 'yuksek';

export class Crane {
  readonly boomBase: Body;
  readonly boomFly: Body;

  private readonly kanca: Kanca;
  /** Aktüatör durumu — kinematik boma her adımda yazılıyor. */
  private angle = (CRANE.stowAngleDeg * Math.PI) / 180;
  private extension = 0;

  /** Bom ucunun bom dibi yerel çerçevesindeki bağlantı noktası. */
  private readonly tipLocal: Vec2;


  private ropeLength = 3.0;
  private stowed = true;
  /** Halat kat sayısı. 2 kat varsayılan — çoğu iş onunla dönüyor. */
  private kat: KatSayisi = 2;
  /** Yeniden geçirme sürerken kalan saniye; 0 ise vinç çalışır. */
  private reevingKalan = 0;
  private reevingHedef: KatSayisi = 2;
  private winchRate = 0;
  /** Rampalanmış aktüatör hızları — komut basamak, hidrolik değil. */
  private luffRate = 0;
  private teleRate = 0;

  constructor(
    world: World,
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
    // **Uyku kapalı.** Kinematik gövdeyi setTransform ile sürmek planck'e
    // "hareket" gibi görünmüyor; bom hareket ederken bile zincir uyku eşiğinin
    // altında sayılabiliyor. Bu tuzağa bir kez düşüldü: yerde duran yük uykuda
    // kaldığı için bağlandığı halde hiç kalkmadı ve teşhisi pahalı oldu
    // (bkz. flushJointQueue'daki setAwake). Vinç zincirinin uyumasına hiç izin
    // vermemek o sınıf hatayı tamamen kapatıyor ve ölçülebilir bir bedeli yok.
    this.boomBase.setSleepingAllowed(false);

    // --- teleskop kesiti ---
    const flyHalf = 4.3;
    const flyCentre = CRANE.boomBaseLengthM - flyHalf;
    this.boomFly = world.createDynamicBody(
      { x: pivot.x + dir.x * flyCentre, y: pivot.y + dir.y * flyCentre }, rad,
    );
    this.boomFly.setKinematic();
    this.boomFly.setSleepingAllowed(false);

    this.tipLocal = new Vec2(flyHalf, 0);

    // --- kanca ---
    // Blok, halat ve bağlanma mantığı `Kanca`'da: dirsekli bom da aynısını
    // kullanıyor, tek fark halatın hangi gövdenin hangi noktasından sarktığı.
    this.kanca = new Kanca(
      world, snaps, KANCA_AYARI, this.boomFly, this.tipLocal, this.ropeLength,
    );

    snaps.track(this.boomBase);
    snaps.track(this.boomFly);
  }

  /** Kanca bloğu — görünüm ve sahne bunu okuyor. */
  get hook(): Body { return this.kanca.hook; }

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
    this.kanca.yolKonumu(stowed);
  }

  /** Her fizik adımında, world.step()'ten ÖNCE. */
  update(input: CraneInput, dt: number, lmi: LmiReading): void {
    // Halat yeniden geçiriliyorsa vinç hiç çalışmıyor — sapancı bomun altında.
    if (this.reevingKalan > 0) {
      this.reevingKalan -= dt;
      if (this.reevingKalan <= 0) {
        this.reevingKalan = 0;
        this.kat = this.reevingHedef;
        this.kanca.kutleyiYaz(CRANE.hookTonnesByKat[this.kat] ?? CRANE.hookTonnes);
      }
      this.winchRate = 0; this.luffRate = 0; this.teleRate = 0;
      return;
    }
    if (this.stowed) {
      // Halatı toparla, kancayı bom ucuna yasla.
      this.winchRate = 0;
      this.ropeLength = Math.max(CRANE.minRopeM, this.ropeLength - 2.5 * dt);
      this.kanca.halatiAyarla(this.ropeLength);
      return;
    }
    const scale = lmi.speedScale;

    // Kırmızıda yarıçapı artıran hareketler kilitli: bom indirme ve teleskop açma.
    const luffCmd = lmi.blockRadiusIncrease ? Math.max(0, input.luff) : input.luff;
    const teleCmd = lmi.blockRadiusIncrease ? Math.min(0, input.telescope) : input.telescope;
    // Oyuncu KİLİTLİ bir hareketi denedi mi? Uyarının somut olması buna bağlı:
    // "aşırı yük" demek yetmiyor, hangi kolun neden çalışmadığını söylemek
    // gerekiyor. Sahadan gelen geri bildirim tam da buydu — panelde bir şeyler
    // kırmızıya dönüyor ama ne yapılması gerektiği anlaşılmıyor.
    this.kilitliDenendi = luffCmd !== input.luff || teleCmd !== input.telescope;

    // Hidrolik silindir pozisyon kontrollüdür: komutu doğrudan konuma entegre
    // ediyoruz, hız sınırı ve strok limitiyle. Kilit valfli bir silindir gibi
    // rijit tutuyor — solvera yaptırmaya çalıştığımızda 12° çöküyordu.
    const luffHedef = (luffCmd * CRANE.luffSpeedDegPerSec * Math.PI * scale) / 180;
    const luffMax = ((CRANE.luffSpeedDegPerSec * Math.PI) / 180 / CRANE.boomRampSec) * dt;
    this.luffRate += clamp(luffHedef - this.luffRate, -luffMax, luffMax);
    this.angle = clamp(
      this.angle + this.luffRate * dt,
      (CRANE.minAngleDeg * Math.PI) / 180,
      (CRANE.maxAngleDeg * Math.PI) / 180,
    );

    // **İki-blok koruması.** Kanca bom kafasına dayanmışken halatı daha da
    // kısaltan üç hareket kilitlenir: vinç yukarı ve teleskop açma (aşağıdaki
    // halat modeli yüzünden teleskop da halat yer).
    const ikiBlok = this.ropeLength <= CRANE.minRopeM + CRANE.ikiBlokPayiM;
    const teleIzin = ikiBlok ? Math.min(0, teleCmd) : teleCmd;
    const winchIzin = ikiBlok ? Math.min(0, input.winch) : input.winch;
    this.ikiBlokta = ikiBlok;
    if (teleIzin !== teleCmd || winchIzin !== input.winch) this.kilitliDenendi = true;

    const teleHedef = teleIzin * CRANE.telescopeSpeedMps * scale;
    const teleMax = (CRANE.telescopeSpeedMps / CRANE.boomRampSec) * dt;
    this.teleRate += clamp(teleHedef - this.teleRate, -teleMax, teleMax);
    const oncekiUzama = this.extension;
    this.extension = clamp(
      this.extension + this.teleRate * dt, 0, CRANE.maxExtensionM,
    );

    // **Halat bom boyunu takip eder.**
    //
    // Toplam halat sabit: tambur→kafa yolu + kafa→kanca. Bom uzayınca birinci
    // parça uzuyor, dolayısıyla İKİNCİSİ kısalıyor — yani teleskobu açmak
    // kancayı kafaya doğru çeker. Gerçek operatör bu yüzden teleskobu açarken
    // aynı anda vinci salar; modellemezsek teleskop bedava bir hamle olur ve
    // iki-blok diye bir tehlike hiç oluşmaz.
    this.ropeLength = clamp(
      this.ropeLength - (this.extension - oncekiUzama),
      CRANE.minRopeM, CRANE.maxRopeM,
    );

    // Vinç hızı rampalı: komut basamak, hidrolik değil. Rampasız her basış
    // rijit halata bir darbe bindiriyor ve bomu aşağı çekiyordu.
    // **Kanca hızı kat sayısına bölünür.** Dört kat dört kat yavaş: kapasitenin
    // bedeli bu ve oyundaki asıl takas da bu.
    const katHiz = CRANE.winchSpeedMps / this.kat;
    const target = -winchIzin * katHiz * scale;
    const maxDelta = (katHiz / CRANE.winchRampSec) * dt;
    this.winchRate += clamp(target - this.winchRate, -maxDelta, maxDelta);

    if (true) {
      // Strok sonuna yaklaşırken yavaşla — sert duruş kancayı bom ucuna çarpıyor.
      const headroom = this.winchRate < 0
        ? this.ropeLength - CRANE.minRopeM
        : CRANE.maxRopeM - this.ropeLength;
      const fade = clamp(headroom / CRANE.winchLimitFadeM, 0, 1);
      if (Math.abs(this.winchRate) > 1e-4) {
        this.ropeLength = clamp(
          this.ropeLength + this.winchRate * fade * dt, CRANE.minRopeM, CRANE.maxRopeM,
        );
      }
      this.kanca.halatiAyarla(this.ropeLength);
    }
  }

  /** world.step()'ten SONRA. Joint yaratma/yok etme burada güvenli. */
  /**
   * Mafsal kurma/yıkma **world.step()'in dışında** yapılmalı.
   *
   * Bağlanmanın tamamı `Kanca`'da; burada sadece geçiş var. Vincin bu konuda
   * söyleyecek bir şeyi yok — kanca neyi nasıl tuttuğunu kendisi biliyor.
   */
  flushJointQueue(candidates: Grabbable[]): void {
    this.kanca.mafsalKuyrugunuBosalt(candidates);
  }

  /** Kancanın gerçekten yükü tuttuğu nokta — blok merkezi değil, boğaz. */
  get grabPoint(): { x: number; y: number } { return this.kanca.tutmaNoktasi; }

  attachCheck(candidates: Grabbable[]): { item: Grabbable | null; reason: AttachReason } {
    return this.kanca.baglanmaDenetimi(candidates);
  }

  canAttach(candidates: Grabbable[]): boolean {
    return this.kanca.baglanabilir(candidates);
  }

  requestToggleAttach(): void { this.kanca.baglaBirakIste(); }

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

    // Kinematik gövdeler sadece setTransform ile sürülüyor, hızları yazılmıyor.
    //
    // Hızı da yazmak DENENDİ (çözücü mafsal bağlantı noktasının hızını gövdeden
    // okuyor, dolayısıyla doğru olan bu görünüyordu) ve sistemi bozdu: LMI %999,
    // salınım 80°, araç devrildi. Sebep ilk adımlar — gövde kurulum konumunda,
    // hedef ise oturmuş şasiye göre hesaplanıyor, aradaki yarım metrelik fark
    // dt'ye bölününce 30 m/s'lik bir hız oluyor ve rijit halat bunu kancaya
    // aynen geçiriyor. Konum yazmak yeterli; bir sonraki adım zaten yeniden
    // yazıyor.
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
    const boomWeight = boomTonnes * 1000 * 9.81;
    if (this.stowed) {
      // **Yol konumunda bom yatağa oturur.**
      //
      // Gerçek bom kamyonunda bom, kabinin üstündeki mesnede (boom rest)
      // yaslanır; ağırlığı taretle mesnet arasında paylaşılır ve araç yolda
      // düz durur. Bunu modellemeyince 5.2 tonluk bom şasi ağırlık merkezinin
      // 4 metre önünde asılı kalıyordu: araç DURURKEN BİLE burnu 1.83° aşağıda
      // duruyor, sürerken öne bastırıyordu. ("Vinç hareket ederken öne doğru
      // baskı yapıyor" şikâyetinin sebebi buydu; ağırlık merkezini arkaya
      // kaydırmak -0.4'ten -1.0'e- semptomu azaltmış ama sebebi çözmemişti.)
      //
      // Yatak devredeyken ağırlığı doğrudan şasi ağırlık merkezine bindiriyoruz:
      // moment sıfır, araç düz. Ayaklar inip çalışma moduna geçince bom yataktan
      // kalkar ve aşağıdaki gerçek moment devreye girer — devrilme fiziği
      // olduğu gibi kalıyor.
      this.chassis.applyForce({ x: 0, y: -boomWeight }, this.chassis.getWorldCenter(), true);
    } else {
      const boomCentre = (CRANE.boomBaseLengthM + this.extension) * 0.42;
      this.chassis.applyForce(
        { x: 0, y: -boomWeight },
        { x: pivot.x + dir.x * boomCentre, y: pivot.y + dir.y * boomCentre },
        true,
      );
    }

    // Halattaki gerçek kuvvet — kanca ve yük ne kadar çekiyorsa o.
    //
    // try/catch şart: planck'te DistanceJoint'in tepki kuvveti ancak hız
    // kısıtları bir kez çözüldükten sonra tanımlı. İlk karede iç vektör yok ve
    // metot DÖNMÜYOR, FIRLATIYOR — dönen değeri kontrol etmek yetmiyor. Bu
    // hataya bir kez düşülüp (LMI okumasında) yanlış ders çıkarılmıştı; burada
    // adımdan önce çağrıldığı için tüm simülasyonu donduruyordu.
    const f = this.kanca.halatKuvveti(dt);
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

  get hasLoad(): boolean { return this.kanca.yukVar; }

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
    const f = this.kanca.halatKuvveti(dt);
    const ham = f ? Math.hypot(f.x, f.y) / 9810 : 0;
    // **Okuma filtreli.** Gerçek LMI'ler yük hücresini filtreler; filtresiz bir
    // sistem her tümsekte alarm verirdi. Bizde de gerekti: tek karelik çözücü
    // sıçramaları %427'ye kadar çıkıp hem göstergeyi hem puanı anlamsız
    // kılıyordu. Zaman sabiti 0.2 s — sarkacın saniyelerle ölçülen gerçek
    // gerilim artışını (40°'de +%46) olduğu gibi geçiriyor, sadece tek adımlık
    // dikenleri kesiyor.
    const k = Math.min(1, dt / CRANE.lmiFilterSec);
    this.lmiTonnes += (ham - this.lmiTonnes) * k;
    this.lmi = computeLmi(this.radiusM, this.lmiTonnes, 0, outriggers, this.kat);
  }

  private lmiTonnes = 0;

  /** Bu adımda oyuncu kilitli bir kola bastı mı? (yük momenti ya da iki-blok) */
  kilitliDenendi = false;
  /** Kanca bom kafasına dayandı mı — iki-blok bölgesinde miyiz? */
  ikiBlokta = false;

  get katSayisi(): KatSayisi { return this.kat; }
  /** K'ya basınca geçilecek kat — panelde göstermek için. */
  get sonrakiKat(): KatSayisi {
    const i = KAT_SECENEKLERI.indexOf(this.kat);
    return KAT_SECENEKLERI[(i + 1) % KAT_SECENEKLERI.length] ?? 2;
  }
  get reevingSuresi(): number { return this.reevingKalan; }
  get halatKapasiteTon(): number { return halatKapasitesi(this.kat); }

  /**
   * Kat sayısını değiştirmeye başlar. Kanca boş ve yere yakın olmalı —
   * sapancı halatı ancak kanca elinin altındayken yeniden geçirebilir.
   */
  katDegistir(): { ok: boolean; neden: KatRet } {
    if (this.reevingKalan > 0) return { ok: false, neden: 'suruyor' };
    if (this.kanca.yukVar) return { ok: false, neden: 'yuklu' };
    if (this.hook.getPosition().y > CRANE.reevingMaxHookY) {
      return { ok: false, neden: 'yuksek' };
    }
    const i = KAT_SECENEKLERI.indexOf(this.kat);
    const sonraki = KAT_SECENEKLERI[(i + 1) % KAT_SECENEKLERI.length] ?? 2;
    this.reevingHedef = sonraki;
    this.reevingKalan = CRANE.reevingSecPerKat * Math.abs(sonraki - this.kat);
    return { ok: true, neden: '' };
  }

  /** Son örneklenen LMI. Hem HUD hem aktüatör kısıtları bunu okur. */
  lmi: LmiReading = computeLmi(0, 0, 0, OutriggerState.Full);

  capacityTonnes(outriggers: OutriggerState): number {
    return capacityAt(this.radiusM, outriggers);
  }

  /** Salınım açısı (derece) — kancanın bom ucuna göre düşeyden sapması. */
  get swingDeg(): number { return this.kanca.salinimDeg; }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
