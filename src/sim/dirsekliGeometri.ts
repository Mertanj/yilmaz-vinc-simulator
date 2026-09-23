/**
 * Dirsekli (kırma bomlu) vinç: kinematik ve yük tablosu.
 *
 * Motor bağımsız saf matematik — burada hiçbir fizik kütüphanesi import
 * edilmez. Teleskopik vinçteki `craneGeometry.ts` ve `loadChart.ts` ile aynı
 * kural.
 *
 * **Bu makine neden var.** Teleskopik bomun ucu her zaman bomun doğrultusunda:
 * bir duvarın üstünden aşıp arkasına inemez, çünkü düz. Dirsekli bom iki
 * eklemli — ana bomu dikleştirip kırmayı aşağı katlayınca uç, makinenin
 * göremediği bir noktaya, engelin ARKASINA iniyor. Dar sokakta bahçeye,
 * duvarın ardındaki avluya yük indirmek bu makinenin işi.
 *
 * **Yük tablosu neden farklı.** Teleskopik vinçte yarıçap–kapasite çifti
 * tablolanıyor. Dirsekli vinçler ise MOMENT değeriyle satılır: "9 tm" demek
 * 9 ton·metre demek, yani 3 metrede 3 ton, 6 metrede 1.5 ton. Tablo da
 * doğrudan bu: kapasite = moment / yarıçap, kancanın kendi sınırıyla
 * tavanlanmış. Uydurma değil, bu sınıf makinenin gerçek ilan biçimi.
 */

/** YV-9 dirsekli bom — kamyon üstü, 9 tm. */
export const DIRSEKLI_SPEC = {
  /** Döner tabla merkezinden bomun ayağına yatay ofset (m). */
  pivotOffsetM: 0.35,
  /**
   * Bom ayağının yerden yüksekliği (m), AYAKLAR AÇIKKEN.
   *
   * Kolon kasanın en arkasında, arka ayakların tam üstünde — bu makine
   * kuyruğunun üstünden çalışıyor (aşağıda `yon` notu). 2.35 yazıyordu ve
   * ölçüm 2.65 gösterdi: ayaklar aracı 21 cm kaldırıyor. Fark duvar
   * payını hesaplayan `npm run zarf` için önemli, çünkü o bu sayıyı
   * doğrudan kullanıyor.
   */
  pivotHeightM: 2.6,

  /**
   * Ana bom (birinci kol) boyu (m) — sabit.
   *
   * Kırmadan uzun ve bu ölçümle seçildi. Önce 4.2 / 4.4 idi (neredeyse eşit)
   * ve zarfın SINIRLARI iyi görünüyordu: en uzak 8.95 m, en yüksek 10.76 m.
   * Sınırlar yanılttı; zarfın İÇİNİN haritası çizilince ortaya bir DELİK
   * çıktı — R 4.5'te uç ya 2 metrenin altında ya 9.5'in üstünde olabiliyor,
   * arası hiç erişilmiyordu. Ölçülen (çalışma bandı R 3–8.5 m, kot 2–7 m):
   *
   *   4.2 / 4.4  ana ≤ 78   erişilen %66      5.2 / 3.4  ana ≤ 78   %86
   *   4.2 / 4.4  ana ≤ 85   erişilen %74      5.2 / 3.4  ana ≤ 85   %91
   */
  anaBoomM: 5.2,

  /**
   * Kırma kolu: TOPLU boy ve hidrolik uzama (m).
   *
   * **Üçüncü eksen.** Gerçek kırma bomlu vinçlerin hepsinde kırmanın içinde
   * hidrolik uzatma kolları vardır; makinenin "aynı yarıçapta ucu yukarı da
   * aşağı da götürebilme" kabiliyetini asıl veren şey odur. Bizde önce yoktu
   * ve zarf haritası bunun bedelini gösterdi: iki sabit kollu bir zincirin
   * erişebildiği yer bir ALAN değil, ince bir kabuk. Kol oranını değiştirmek
   * kabuğu kalınlaştırdı ama delik kapanmadı; kapatan şey teleskop.
   *
   * Matematiği tek satırda: ucun gittiği yer `ana = hedefin yükselişi +
   * kolların açtığı açı` kuralına bağlı ve o ikinci terim kırmanın BOYUYLA
   * büyüyor. Boy değişebiliyorsa aynı noktaya farklı ana bom açılarıyla
   * gidilebiliyor, yani zarf doluyor.
   *
   * **2.8 metre eğrinin dirseği, ve bu tarandı.** Üç bant ölçüldü: zarf
   * kutusu, avlu işinin bandı (R 3–8.5, kot 2–7) ve yapı üstüne/altına
   * koyma bandı (R 4–10, kot 4–9):
   *
   *   uzama      en uzak   en yüksek   kutu   avlu   yapı
   *   yok        8.95 m    11.17 m     %51    %91    %61
   *   +1.1      10.05      12.26       %72    %94    %81
   *   +2.1      11.05      13.26       %81    %94    %94
   *   +2.8      11.75      13.96       %83    %94    %98   ← seçilen
   *   +3.6      12.55      14.75       %84    %94    %98
   *   +4.6      13.55      15.75       %84    %94    %98
   *
   * 2.8'den sonrası menzil satın alıyor, zarf satın almıyor. Daha uzun bir
   * teleskop bölümü de zorlaştırmıyor — yalnızca makineyi sınıfının dışına
   * çıkarırdı.
   */
  kirmaTabanM: 3.4,
  kirmaUzamaM: 2.8,

  /**
   * Ana bom açısı: yataydan yukarı, derece.
   *
   * 85, 78 değil: gerçek kırma bomlu vinçlerin ana bomu düşeye bu kadar
   * yaklaşır ve yukarıdaki tabloda tek başına %8 kazandırıyor.
   */
  anaMinDeg: -5,
  anaMaxDeg: 85,
  /**
   * Kırma açısı: ana bomun DOĞRULTUSUNDAN sapma, derece.
   *
   * 0 = düz devam (tek uzun bom gibi). Büyüdükçe kırma aşağı katlanıyor.
   *
   * **178, 165 değil.** 165 ihtiyattan seçilmişti ve yol konumunu bozuyordu:
   * katlanan uç kolonun 1.45 m ötesinde, yani kuyruğun 85 cm ARKASINDA
   * kalıyordu. Gerçek kırma bomlu vinçte nakliye hâli tam da budur —
   * kırma ana bomun üstüne YATAR. 178'de uç kolonun 46 cm berisine,
   * kasanın üstüne geliyor.
   */
  kirmaMinDeg: 0,
  kirmaMaxDeg: 178,

  /**
   * Nakliye (yol) konumu — eklemlerin ucuna dayanmak DEĞİL, kendi duruşu.
   *
   * Sınırların ucunu (78 / 178) kullanmak denendi ve katlanan uç şasi
   * kutusunun içine, kuyruğun 14 cm berisine düşüyordu. Ölçüyle seçildi:
   * 170'te uç kolonun 1.07 m ötesinde, yani arka tamponun 47 cm ARKASINDA
   * ve kasanın üstünde kalıyor. Gerçek makinede de nakliye hâli ayrı bir
   * duruştur, "her kolu sonuna kadar it" değil.
   */
  yolAnaDeg: 78,
  yolKirmaDeg: 170,

  /** Eklem hızları (derece/s). Kırma daha çevik: kısa ve hafif. */
  anaHizDegPerSec: 5.0,
  kirmaHizDegPerSec: 7.0,
  /** Teleskop hızı (m/s). Eklemlerden yavaş: uzatma kolları ağır çalışır. */
  uzamaHizMps: 0.55,
  /**
   * Kumandanın sıfırdan tam hıza çıkma süresi (s) — dört kolun hepsinde.
   *
   * Vinçte 0.6 (bom) ve 0.45 (vinç); bu makine daha çevik ve kısa bir rampa
   * yetiyor: uç en hızlı ~1.1 m/s'yle gidiyor, 0.3 saniyelik rampada ivmesi
   * 3.7 m/s² — yerçekiminin altında, yani aşağı kalkan ucu yük halat
   * gevşemeden izleyebiliyor.
   */
  rampaSn: 0.3,

  /** Moment sınırı (ton·metre) — makinenin ilan değeri. */
  momentTm: 9.0,
  /** Kancanın kendi sınırı (t): kısa yarıçapta moment değil bu bağlıyor. */
  maxKancaTon: 3.2,
  /**
   * Tablonun bittiği yarıçap (m). Ötesinde çalışma yok.
   *
   * **Bomun bittiği yerden ÖNCE bitiyor, ve bu kasıtlı.** 11.9 yazıyordu,
   * makinenin geometrik menzili ise 11.75 — yani "yarıçap tablo dışı" durumu
   * hiç oluşamıyordu. Panelde o satır, göstergedeki durum ve uyarı şeridi
   * ölü koddu. Gerçek yük tablosu da bomun ucundan önce biter; son yarım
   * metre kâğıt üstünde yoktur. 11.0'da kapasite 0.82 t ve ötesi sıfır.
   */
  maxYaricapM: 11.0,
  /** Tablonun başladığı yarıçap (m) — daha yakını zaten makinenin üstü. */
  minYaricapM: 1.6,

  hookBlockTonnes: 0.12,
  machineTonnes: 11,
  winchSpeedMps: 1.0,
} as const;

const rad = (d: number): number => (d * Math.PI) / 180;

export interface DirsekliDurum {
  /** Ana bom açısı (derece, yataydan). */
  anaDeg: number;
  /** Kırma açısı (derece, ana bomun doğrultusundan sapma). */
  kirmaDeg: number;
  /** Kırmanın hidrolik uzaması (m), 0..kirmaUzamaM. */
  uzamaM: number;
}

/** Kırmanın o andaki toplam boyu (m). */
export function kirmaBoyu(d: DirsekliDurum): number {
  const s = DIRSEKLI_SPEC;
  return s.kirmaTabanM + Math.max(0, Math.min(s.kirmaUzamaM, d.uzamaM));
}

/** Kırmanın dünya doğrultusu (derece, yataydan). */
export function kirmaYonuDeg(d: DirsekliDurum): number {
  return d.anaDeg - d.kirmaDeg;
}

/** Dirseğin (iki kolun birleştiği nokta) konumu, tabla merkezine göre. */
export function dirsekNoktasi(d: DirsekliDurum): { x: number; y: number } {
  const s = DIRSEKLI_SPEC;
  return {
    x: s.pivotOffsetM + s.anaBoomM * Math.cos(rad(d.anaDeg)),
    y: s.pivotHeightM + s.anaBoomM * Math.sin(rad(d.anaDeg)),
  };
}

/** Bomun ucu (kancanın asıldığı yer), tabla merkezine göre. */
export function ucNoktasi(d: DirsekliDurum): { x: number; y: number } {
  const dirsek = dirsekNoktasi(d);
  const yon = rad(kirmaYonuDeg(d));
  const L2 = kirmaBoyu(d);
  return {
    x: dirsek.x + L2 * Math.cos(yon),
    y: dirsek.y + L2 * Math.sin(yon),
  };
}

/** Çalışma yarıçapı: ucun tabla merkezine yatay uzaklığı. */
export function calismaYaricapi(d: DirsekliDurum): number {
  return ucNoktasi(d).x;
}

/**
 * Verilen yarıçapta kapasite (ton).
 *
 * Moment sabit: kapasite = moment / yarıçap. Kısa yarıçapta kancanın kendi
 * sınırı bağlıyor, tablo dışında sıfır.
 */
export function dirsekliKapasitesi(yaricapM: number): number {
  const s = DIRSEKLI_SPEC;
  if (yaricapM > s.maxYaricapM) return 0;
  const r = Math.max(yaricapM, s.minYaricapM);
  return Math.min(s.maxKancaTon, s.momentTm / r);
}

/**
 * Ters kinematik: ucu verilen noktaya götüren eklem konumu.
 *
 * **Neden gerekli.** Tek eksenli kovalama bu makinede kendi kuyruğunu
 * yakalıyor: ana bomu indirmek ucu uzaklaştırırken ALÇALTIYOR, kırmayı açmak
 * ise uzaklaştırırken YÜKSELTİYOR. İki eksen birbirinin hatasını besliyor.
 * Teleskopik vinçte aynı tuzağa düşülmüş ve çözüm de aynı olmuştu: hedef uç
 * konumundan açıları ANALİTİK çöz, sonra her ekseni hedefine sür.
 *
 * **Üçüncü eksen çözümü ÇOĞULLAŞTIRIYOR.** İki kollu bir zincirde bir nokta
 * için en fazla iki çözüm var; teleskop girince sonsuz tane oluyor (aynı
 * noktaya kırmayı uzatıp ana bomu dikleştirerek de, kırmayı toplayıp ana
 * bomu yatırarak da gidilebiliyor). Seçimi bir kurala bağlamak şart, yoksa
 * çözüm karedən kareye zıplar.
 *
 * **Kural: EN AZ UZAMA.** Sahadaki kuralın ta kendisi — uzatma kolları
 * yarıçapı büyütür, yarıçap kapasiteyi düşürür, o yüzden operatör işi en
 * toplu konfigürasyonla yapar. Ayrıca kırma kısaldıkça `gamma` küçülüyor ve
 * ana bomun üst sınırına çarpma ihtimali azalıyor, yani aynı kural zarfın
 * deliğinden de kaçınıyor.
 *
 * Erişilemeyen nokta için `null` döner — uydurulmuş bir açı sessizce yanlış
 * yere sürerdi.
 */
export function dirsekliCozum(hedef: { x: number; y: number }): DirsekliDurum | null {
  const s = DIRSEKLI_SPEC;
  // Uzamayı 5 cm adımlarla tarıyoruz. Analitik bir kapalı form var ama eklem
  // sınırlarıyla birlikte üç ayrı kök aralığına ayrılıyor; tarama hem kısa
  // hem de sınırları kendiliğinden kapsıyor (57 deneme, karede bir kez).
  for (let u = 0; u <= s.kirmaUzamaM + 1e-9; u += 0.05) {
    const c = ikSabitBoy(hedef, s.kirmaTabanM + u);
    if (c) return { ...c, uzamaM: u };
  }
  return null;
}

/** Verilen SABİT kırma boyu için iki kollu çözüm; sınır dışıysa null. */
function ikSabitBoy(
  hedef: { x: number; y: number }, L2: number,
): { anaDeg: number; kirmaDeg: number } | null {
  const s = DIRSEKLI_SPEC;
  const dx = hedef.x - s.pivotOffsetM;
  const dy = hedef.y - s.pivotHeightM;
  const d = Math.hypot(dx, dy);
  const L1 = s.anaBoomM;
  if (d > L1 + L2 || d < Math.abs(L1 - L2)) return null;

  // Dirsekteki iç açı: kosinüs teoremi. `kirmaDeg` düzlükten SAPMA olduğu
  // için 180'den çıkarıyoruz.
  const cosBeta = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2);
  const beta = Math.acos(Math.max(-1, Math.min(1, cosBeta)));
  const kirmaDeg = 180 - (beta * 180) / Math.PI;

  // Ana bomun, hedefe giden doğrudan sapması. Kırma yalnızca AŞAĞI
  // katlandığı için tek geçerli kök kalıyor: ana bom doğrunun ÜSTÜNDE.
  const cosGamma = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const gamma = Math.acos(Math.max(-1, Math.min(1, cosGamma)));
  const anaDeg = ((Math.atan2(dy, dx) + gamma) * 180) / Math.PI;

  if (anaDeg < s.anaMinDeg || anaDeg > s.anaMaxDeg) return null;
  if (kirmaDeg < s.kirmaMinDeg || kirmaDeg > s.kirmaMaxDeg) return null;
  return { anaDeg, kirmaDeg };
}
