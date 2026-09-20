import { Vec2, type Body, type World } from 'planck';
import type { Snapshotter } from './world';
import { Kanca, type BirakRet, type Grabbable, type KancaAyari } from './kanca';
import type { SimKipi } from './kip';
import { LmiZone, type LmiReading } from './loadChart';
import type { DirsekliDurum } from './dirsekliGeometri';
import {
  DIRSEKLI_SPEC as S, dirsekNoktasi, dirsekliKapasitesi, kirmaBoyu, kirmaYonuDeg,
  ucNoktasi,
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
  /**
   * Bom ayağının şasi yerel çerçevesindeki yeri — kasanın EN ARKASI.
   *
   * Kabinin arkasına (yerel -1.4) konmuştu ve ölçüm bunu eledi. Orta montajda
   * bomun ayağı ile ön tamponun arası 6.2 metre, makinenin menzili ise 8.95 —
   * yani kendi burnunun ÖTESİNDE yalnızca 2.75 metre çalışma alanı kalıyor.
   * Yükü oradan alıp oraya koymak imkânsız, üstelik yükün yolu kabinin
   * üstünden geçiyor. Gerçek hayatta orta montajlı vinçler bu yüzden yana
   * döner (slew) — bizde henüz yok.
   *
   * Arka montajda kolon arka tamponun 60 cm berisinde, dolayısıyla kuyruğun
   * ötesinde 8.45 metre boş çalışma alanı var. Kamyon üstü kırma bomlu
   * vinçlerin en yaygın hâli de bu, tam da bu sebeple.
   */
  pivot: new Vec2(-4.2, 1.05),
  /**
   * Bomun çalışma yönü: -1 kuyruğa doğru (-x), +1 buruna doğru.
   *
   * Geometri modülü her şeyi +x'te kuruyor ve öyle kalıyor — saf matematiği
   * makinenin montaj yönüyle kirletmenin âlemi yok. Ayna burada, tek yerde:
   * yerel (x, y) -> (yon·x, y), açı θ -> π - θ. Slew geldiğinde bu işaret
   * zaten tablanın işi olacak.
   */
  yon: -1 as 1 | -1,
  /**
   * Kolların kütlesi (t) — moment hesabına elle giriyor.
   *
   * Toplam 1.5 t sabit; paylaşım kol boylarıyla birlikte değişti (4.2/4.4
   * iken 0.95/0.55, şimdi 5.2/3.4). Ana bom metre başına da daha ağır: kesiti
   * büyük, üstelik kırmanın bütün yükünü o taşıyor.
   */
  anaBomTon: 1.05,
  kirmaBomTon: 0.45,

  /** Halat: kancanın bom ucuna dayanma eşiği (m). */
  minHalatM: 0.5,
  /**
   * İki-blok bölgesinin genişliği (m) — kanca kafaya BU kadar yaklaşınca
   * halatı kısaltan hareketler kilitleniyor.
   *
   * **Ölçümle küçüldü: 0.35 denendi ve bölüm oynanamaz hale geldi.** Vinçteki
   * pay 0.55 ve orada asgari halat 2.0 (yani %27); aynı oranı buraya taşımak
   * yanlış çıktı, çünkü bu bölüm 0.6 metrelik bir ÇALIŞMA halatıyla tasarlandı
   * — taşıma halatı yüksek hedeflerde bilerek kısa tutuluyor, yoksa yük tam
   * terasın hizasında sallanıyor. 0.35'lik pay eşiği 0.85'e çıkarıyor, yani
   * bölümün normal çalışma halatı sürekli iki-blok bölgesinde kalıyor ve
   * teleskop hiç açılamıyordu: rig 2/5'te takıldı.
   *
   * 0.06 eşiği 0.56'ya koyuyor. Kilit hâlâ gerçek — kanca kafaya dayanmadan
   * önce devreye giriyor — ama makinenin kendi ölçeğinde: bu vinçte asgari
   * halat 0.5 ve yol konumu 0.35, yani zaten santimlerle çalışan bir düzen.
   */
  ikiBlokPayiM: 0.06,
  maxHalatM: 12.0,
  /**
   * Yol konumunda kanca bom ucuna toplanır (m).
   *
   * `minHalatM`'den kısa olması kasıtlı: nakliyede kanca ucun dibine
   * çekilip bağlanır, çalışma sınırı orada geçerli değil.
   */
  yolHalatM: 0.35,

  hookThroatM: 0.34,
  attachCentreToleranceM: 0.42,
  attachBelowTopM: 0.6,
  /**
   * Boğaz yükün üst yüzünden en fazla bu kadar YUKARIDA olabilir (m).
   *
   * Vinçten 1.5 kopyalanmıştı ve bu makinede işe yaramadı: kanca yükün bir
   * metre üstündeyken bağlanabiliyor, mafsal oraya kuruluyor ve yükün ağırlık
   * merkezi pimin 1.45 m altında kalıyordu. Yük sarkaç gibi peşten sürükleniyor
   * (ölçümde uçtan 1.8 m geride, salınım 74°) ve duvarı hiç aşamıyordu.
   * `kanca.ts` aynı tuzağı zaten anlatıyor — orada bağlanma noktası yükün üst
   * ORTASI seçilmişti ve aynı sebeple elenmişti.
   *
   * 0.6, kanca bloğunun kendi boyu kadar: sapancı kancayı yükün üstüne
   * indirmek zorunda.
   */
  attachAboveTopM: 0.6,
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
  /** Teleskop: +1 uzat, -1 topla. */
  uzat: number;
  /** Kanca: +1 sar (yukarı). */
  winch: number;
}

export const DIRSEKLI_NEUTRAL: DirsekliInput = { ana: 0, kirma: 0, uzat: 0, winch: 0 };

const clamp = (v: number, lo: number, hi: number): number =>
  (v < lo ? lo : v > hi ? hi : v);

export class Dirsekli {
  readonly anaBom: Body;
  readonly kirmaBom: Body;
  /**
   * Bom ucu — fikstürü olmayan, kütlesiz kinematik gövde.
   *
   * **Sırf halatın asıldığı nokta için var.** Halat önce doğrudan kırma
   * gövdesinin yerel ucundan (`+L/2, 0`) sarkıyordu ve teleskop gelince bu
   * çalışmaz oldu: uzayan bir kolda o yerel nokta KAYIYOR, planck'te ise bir
   * mafsalın yerel bağlanma noktası kurulduktan sonra değiştirilemiyor.
   * Uç ayrı bir gövde olunca halatın yerel bağlantısı (0,0) sabit kalıyor ve
   * uzama sadece gövdeyi taşıyor.
   */
  readonly ucGovde: Body;
  private readonly kanca: Kanca;

  /** Eklem durumu (derece) — kinematik gövdelere her adımda yazılıyor. */
  private anaDeg: number = S.yolAnaDeg;
  private kirmaDeg: number = S.yolKirmaDeg;
  private halatM: number = DIRSEKLI.yolHalatM;
  /** Kırmanın hidrolik uzaması (m). */
  private uzamaM = 0;
  private yolda = true;

  /** Bu adımda oyuncu kilitli bir kola bastı mı? */
  kilitliDenendi = false;
  /** Kanca bom ucuna dayandı mı? */
  ikiBlokta = false;

  private lmiTon = 0;
  /**
   * Aşırı yükte KESİNTİSİZ geçen süre (s) — kilidin şartı bu, anlık değer değil.
   *
   * **Neden gecikme var.** Yük salınırken halat gerilimi statiğin 1.4 katına
   * çıkıyor ve anlık bir sıçrama LMI'yi %100'ün üstüne atıyor. Kilit anlık
   * değere bağlıyken tam o anda yarıçap BÜYÜTEN hareketler kesiliyordu — ve
   * yükü terasa indirmek için gereken hareket tam olarak o. Ölçümde rig
   * ikinci görevde yükü korkuluğun üstünde asılı bıraktı: statik %76'lık bir
   * yük, dinamik %106 okuyup makineyi kendi kilidiyle durdurdu.
   *
   * Gerçek yük moment göstergeleri de anlık tepede kesmez; sinyal
   * sönümlenmiş ve kesinti gecikmeli olur, yoksa her salınımda vinç durur.
   * Gösterge YİNE anlık değeri gösteriyor (oyuncu sıçramayı görmeli), kilit
   * ise sürekliliğe bakıyor.
   */
  private asiriSn = 0;
  /**
   * Halat kuvvetinin SIKIŞMA sayılacak kadar yüksek kaldığı süre (s).
   *
   * **Kinematik bom temasla durmuyor.** Kollar `setTransform` ile sürülüyor,
   * yani sonsuz kütleli: oyuncu ucu bir korkuluğa ya da zemine doğru sürerse
   * bom durmaz, arada kalan yükü ezer ve rijit halat kuvveti sınırsız büyür.
   * Sahadan gelen ölçüm: 1.05 tonluk bir palet korkuluğa bastırılınca kanca
   * 5.17 t okudu (izin verilen 1.84 t) ve makine %281'de takılı kaldı.
   *
   * Gerçek makinede karşılığı var ve adı da var: yük moment göstergesi
   * fonksiyonları KESER. Burada da öyle — sıkışma sürerse bomun yarıçabı
   * büyüten ve ucu indiren hareketleri duruyor, kurtulma yolları (kırmayı
   * katla, ana bomu kaldır, halatı sal) açık kalıyor.
   */
  private sikismaSn = 0;

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

    this.ucGovde = world.createDynamicBody();
    this.ucGovde.setKinematic();
    this.ucGovde.setSleepingAllowed(false);

    this.govdeleriYerlestir();

    // Halat UÇ GÖVDESİNİN merkezinden sarkıyor; yerel nokta (0,0) ve sabit.
    this.kanca = new Kanca(
      world, snaps, KANCA_AYARI, this.ucGovde, new Vec2(0, 0), this.halatM,
    );

    snaps.track(this.anaBom);
    snaps.track(this.kirmaBom);
  }

  get hook(): Body { return this.kanca.hook; }
  get anaAciDeg(): number { return this.anaDeg; }
  get kirmaAciDeg(): number { return this.kirmaDeg; }
  get uzamaBoyuM(): number { return this.uzamaM; }
  /** Kırmanın o andaki toplam boyu (m) — çizim bunu istiyor. */
  get kirmaBoyuM(): number { return kirmaBoyu(this.durum); }
  private get durum(): DirsekliDurum {
    return { anaDeg: this.anaDeg, kirmaDeg: this.kirmaDeg, uzamaM: this.uzamaM };
  }
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
  /**
   * Simülasyon kipi. Varsayılan `tam`: bir sim modülünün varsayılanı "yardım
   * açık" değil, yazıldığı fizik olmalı. Ürün varsayılanını `kip.ts` seçiyor.
   */
  private kip: SimKipi = 'tam';
  kipiSec(k: SimKipi): void { this.kip = k; }

  /** Yük bir şeyin üstüne oturdu mu — bırakmanın şartı. */
  get yukOturdu(): boolean { return this.kanca.yukOturdu; }

  /**
   * Kancayı bağla ya da bırak. Havadaki yük bırakılmaz — sebebi
   * `Kanca.yukOturdu`'da.
   */
  requestToggleAttach(): { ok: boolean; neden: BirakRet } {
    if (this.kanca.yukVar && !this.kanca.yukOturdu) {
      return { ok: false, neden: 'havada' };
    }
    this.kanca.baglaBirakIste();
    return { ok: true, neden: '' };
  }
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
      this.anaDeg += clamp(S.yolAnaDeg - this.anaDeg, -1, 1) * S.anaHizDegPerSec * dt * 3;
      this.kirmaDeg += clamp(S.yolKirmaDeg - this.kirmaDeg, -1, 1)
        * S.kirmaHizDegPerSec * dt * 3;
      this.halatM += clamp(DIRSEKLI.yolHalatM - this.halatM, -1, 1) * 2 * dt;
      // Nakliyede teleskop tamamen toplanır — yoksa bom kuyruktan taşar.
      this.uzamaM += clamp(-this.uzamaM, -1, 1) * S.uzamaHizMps * dt * 3;
      this.govdeleriYerlestir();
      this.kanca.halatiAyarla(this.halatM);
      return;
    }

    const kilit = lmi.blockRadiusIncrease;
    const olcek = lmi.speedScale;

    // Yarıçapı BÜYÜTEN üç hareket kilitli: ana bomu indirmek, kırmayı açmak,
    // teleskobu uzatmak. Küçültenler her zaman serbest — çıkış yolu onlar.
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

    // Teleskobu UZATMAK da yarıçapı büyütüyor — aynı kilit.
    let uzat = input.uzat;
    if (kilit && uzat > 0) { uzat = 0; this.kilitliDenendi = true; }

    // **İki-blok koruması — vinçteki modelin AYNISI, ve bir kusurun tamiri.**
    //
    // Sahadan gelen gözlem: *"kırmalı vinçte halatı salmadan çok yukarıda bom
    // kırabiliyorken normal vinçte halat kilitlenebiliyor."* Ölçüldü ve
    // haklıydı: aynı pozdan teleskop komutu verildiğinde vinçte uzama 0.00 m
    // (kilit devrede), dirseklide 2.80 m — halat ise 0.50'de sabit. Yani
    // `ikiBlokta` bayrağı yanıyordu ama HİÇBİR ŞEYİ kilitlemiyordu ve teleskop
    // halat yemiyordu.
    //
    // Vincin kendi yorumu bunu zaten yazmış: "modellemezsek teleskop bedava
    // bir hamle olur ve iki-blok diye bir tehlike hiç oluşmaz." İki makine
    // aynı fiziği paylaşmalı; oyuncunun öğrendiği kural makineye göre
    // değişmemeli.
    //
    // **`temel` kipte teleskop kilidi YOK** ve olmamalı: orada halatı makine
    // telafi ediyor, yani uzatmak halat yemiyor ve kilitlenecek bir sebep de
    // kalmıyor. İki-blok bayrağı yine hesaplanıyor — vinci yukarı sarmak iki
    // kipte de kilitli, çünkü o oyuncunun kendi hareketi.
    const ikiBlok = this.halatM <= DIRSEKLI.minHalatM + DIRSEKLI.ikiBlokPayiM;
    this.ikiBlokta = ikiBlok;
    if (this.kip === 'tam' && ikiBlok && uzat > 0) {
      uzat = 0; this.kilitliDenendi = true;
    }

    // **Sıkışma: hidrolik kesildi.** Yarıçabı büyüten her şey zaten yukarıda
    // kilitli; burada ucu AŞAĞI indiren hareketler de duruyor, çünkü sıkışan
    // yükü daha da ezen hareket odur. Kurtulma yolları açık: kırmayı katla
    // (kirma < 0), ana bomu kaldır (ana > 0), halatı sal.
    if (this.hidrolikDurdu) {
      if (ana < 0) { ana = 0; this.kilitliDenendi = true; }
      if (kirma > 0) { kirma = 0; this.kilitliDenendi = true; }
      if (uzat !== 0) { uzat = 0; this.kilitliDenendi = true; }
    }
    const oncekiUzama = this.uzamaM;
    this.uzamaM = clamp(
      this.uzamaM + uzat * S.uzamaHizMps * olcek * dt, 0, S.kirmaUzamaM,
    );

    // **Halat bom boyunu takip ediyor.** Toplam halat sabit: tambur→uç yolu ile
    // uç→kanca parçasının toplamı. Teleskop uzayınca birincisi uzuyor, yani
    // İKİNCİSİ kısalıyor — teleskobu açmak kancayı uca doğru çekiyor. Gerçek
    // operatör de teleskobu açarken aynı anda vinci salar.
    //
    // Kırmayı katlamak halat YEMİYOR ve yememeli: dirsek makarası döndüğünde
    // halat bükülüyor, yolu uzamıyor. Vinçte de bom açısı halata dokunmuyor —
    // iki makine yine aynı kuralda.
    if (this.kip === 'tam') {
      this.halatM = clamp(
        this.halatM - (this.uzamaM - oncekiUzama),
        DIRSEKLI.minHalatM, DIRSEKLI.maxHalatM,
      );
    }

    // İki-blok bölgesindeyken halatı daha da SARMAK kilitli; salmak serbest,
    // çıkış yolu o.
    const winchIzin = ikiBlok ? Math.min(0, input.winch) : input.winch;
    if (winchIzin !== input.winch) this.kilitliDenendi = true;
    this.halatM = clamp(
      this.halatM - winchIzin * S.winchSpeedMps * olcek * dt,
      DIRSEKLI.minHalatM, DIRSEKLI.maxHalatM,
    );

    this.govdeleriYerlestir();
    this.kanca.halatiAyarla(this.halatM);
  }

  /** Kinematik kolları eklem açılarından konumlandırır. */
  private govdeleriYerlestir(): void {
    const taban = this.chassis.getWorldPoint(DIRSEKLI.pivot);
    const sasiAci = this.chassis.getAngle();
    const durum = this.durum;
    const L2 = kirmaBoyu(durum);

    // Gövde merkezleri kolun ORTASINDA: ayak/dirsek noktasından kolun yarısı
    // kadar kendi doğrultusunda ileride.
    const ayak = this.yereldenDunyaya(
      { x: S.pivotOffsetM, y: S.pivotHeightM }, taban, sasiAci,
    );
    const ana = this.dunyaAcisi(this.anaDeg, sasiAci);
    this.anaBom.setTransform({
      x: ayak.x + (S.anaBoomM / 2) * Math.cos(ana),
      y: ayak.y + (S.anaBoomM / 2) * Math.sin(ana),
    }, ana);

    const dirsekDunya = this.yereldenDunyaya(dirsekNoktasi(durum), taban, sasiAci);
    const kirmaAci = this.dunyaAcisi(kirmaYonuDeg(durum), sasiAci);
    this.kirmaBom.setTransform({
      x: dirsekDunya.x + (L2 / 2) * Math.cos(kirmaAci),
      y: dirsekDunya.y + (L2 / 2) * Math.sin(kirmaAci),
    }, kirmaAci);

    // Uç gövdesi tam bomun ucunda: halat buradan sarkıyor.
    this.ucGovde.setTransform({
      x: dirsekDunya.x + L2 * Math.cos(kirmaAci),
      y: dirsekDunya.y + L2 * Math.sin(kirmaAci),
    }, kirmaAci);
  }

  /**
   * Yerel (geometri) açısını dünya açısına çevirir.
   *
   * Ayna bir doğrultuyu düşey eksende yansıtıyor: θ -> π - θ. Şasi eğimi
   * aynadan SONRA biniyor, çünkü araç dönünce bomun montajı da onunla dönüyor.
   */
  private dunyaAcisi(yerelDeg: number, sasiAci: number): number {
    const a = (yerelDeg * Math.PI) / 180;
    return sasiAci + (DIRSEKLI.yon > 0 ? a : Math.PI - a);
  }

  /** Tabla merkezine göre verilmiş noktayı dünyaya taşır. */
  private yereldenDunyaya(
    p: { x: number; y: number }, taban: { x: number; y: number }, aci: number,
  ): { x: number; y: number } {
    // Geometri modülü y'yi ZEMİNDEN ölçüyor; tabla merkezi de zeminden
    // `pivotHeightM` yukarıda, o yüzden farkı alıyoruz. x ise aynadan geçiyor.
    const dx = p.x * DIRSEKLI.yon;
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
    const kap = dirsekliKapasitesi(this.radiusM);
    const asiri = kap > 0 ? this.lmiTon > kap : true;
    this.asiriSn = asiri ? this.asiriSn + dt : 0;
    // Sıkışma eşiği kapasitenin 2.5 katı: salınımın tepesi statiğin 1.4
    // katına çıkıyor, yani normal oynanış buraya hiç değmiyor. Tablo
    // dışında kapasite sıfır olduğu için taban 0.5 t.
    this.sikismaSn = this.lmiTon > 2.5 * Math.max(kap, 0.5)
      ? this.sikismaSn + dt : 0;
  }

  /** Aşırı yük kesintisi devrede mi? */
  get hidrolikDurdu(): boolean { return this.sikismaSn >= Dirsekli.SIKISMA_GECIKMESI; }
  private static readonly SIKISMA_GECIKMESI = 0.35;

  /** Kilidin eşiği (s). Salınım tepesi bundan kısa, gerçek aşırı yük değil. */
  private static readonly KILIT_GECIKMESI = 0.6;

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
      blockRadiusIncrease: this.asiriSn >= Dirsekli.KILIT_GECIKMESI,
    };
  }

  /** Tablo dışı mı — uç makinenin erişemeyeceği kadar uzakta. */
  get tabloDisi(): boolean { return this.radiusM > S.maxYaricapM; }

  /**
   * Dünyadaki bir noktayı geometri modülünün çerçevesine taşır.
   *
   * `yereldenDunyaya`nın tersi ve onun ikizi olarak duruyor: aynayı ve şasi
   * eğimini geri alıyor. Ters kinematik hedefini bu çerçevede istiyor —
   * otopilot da, ileride bir yardım oku da dünyada düşünüp burada çözecek.
   */
  dunyadanYerele(p: { x: number; y: number }): { x: number; y: number } {
    const taban = this.chassis.getWorldPoint(DIRSEKLI.pivot);
    const aci = this.chassis.getAngle();
    const wx = p.x - taban.x;
    const wy = p.y - taban.y;
    // Şasi dönüşünü geri al.
    const rx = wx * Math.cos(-aci) - wy * Math.sin(-aci);
    const ry = wx * Math.sin(-aci) + wy * Math.cos(-aci);
    return { x: rx * DIRSEKLI.yon, y: ry + S.pivotHeightM };
  }

  /** Ucun dünyadaki yeri, geometri modülünün beklediği yerel biçimde. */
  get ucYerel(): { x: number; y: number } { return ucNoktasi(this.durum); }
}
