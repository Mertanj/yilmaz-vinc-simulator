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
   * Kolların boyu (m) — ana bom KIRMADAN UZUN, ve bu ölçümle seçildi.
   *
   * Önce 4.2 / 4.4 idi (neredeyse eşit) ve zarfın SINIRLARI iyi görünüyordu:
   * en uzak 8.95 m, en yüksek 10.76 m. Sınırlar yanılttı. Zarfın İÇİNİN
   * haritası çizilince ortaya bir DELİK çıktı: R 4.5'te uç ya 2 metrenin
   * altında ya 9.5 metrenin üstünde olabiliyor, arası hiç erişilmiyordu.
   * Bölümün bütün işi (duvarın ardına, 2–7 metre kotuna yük indirmek) tam o
   * delikte kalıyordu ve rig yükü duvarın üstünden hiç geçiremedi.
   *
   * Sebep: kırma yalnızca AŞAĞI katlanıyor, dolayısıyla ana bomun dünya açısı
   * `hedefin yükselişi + kolların açtığı açı` olmak zorunda. Uzun bir kırma
   * o ikinci terimi büyütüyor ve üst sınırı (78°) aşıyor. Gerçek kırma bomlu
   * vinçlerde bu sorunu KIRMANIN TELESKOBU çözüyor; bizde dördüncü bir eksen
   * kumandaya sığmıyor, o yüzden aynı işi kol oranı yapıyor.
   *
   * Ölçülen (çalışma bandı R 3–8.5 m, kot 2–7 m — avlu işinin geçtiği yer):
   *
   *   4.2 / 4.4  ana ≤ 78   erişilen %66   en uzak 8.95 m
   *   4.2 / 4.4  ana ≤ 85   erişilen %74   en uzak 8.95 m
   *   5.2 / 3.4  ana ≤ 78   erişilen %86   en uzak 8.95 m
   *   5.2 / 3.4  ana ≤ 85   erişilen %91   en uzak 8.95 m   ← seçilen
   *   5.8 / 2.8  ana ≤ 85   erişilen %93   en uzak 8.95 m
   *
   * 5.8 / 2.8 bir puan daha veriyor ama 2.8 metrelik bir kırma artık
   * kırılmıyor; makinenin karakterini satın alınan puana değmez.
   */
  anaBoomM: 5.2,
  kirmaBoomM: 3.4,

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

  /** Moment sınırı (ton·metre) — makinenin ilan değeri. */
  momentTm: 9.0,
  /** Kancanın kendi sınırı (t): kısa yarıçapta moment değil bu bağlıyor. */
  maxKancaTon: 3.2,
  /** Tablonun bittiği yarıçap (m). Ötesinde çalışma yok. */
  maxYaricapM: 9.2,
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
  const s = DIRSEKLI_SPEC;
  const dirsek = dirsekNoktasi(d);
  const yon = rad(kirmaYonuDeg(d));
  return {
    x: dirsek.x + s.kirmaBoomM * Math.cos(yon),
    y: dirsek.y + s.kirmaBoomM * Math.sin(yon),
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
 * Ters kinematik: ucu verilen noktaya götüren eklem açıları.
 *
 * **Neden gerekli.** Tek eksenli kovalama bu makinede kendi kuyruğunu
 * yakalıyor: ana bomu indirmek ucu uzaklaştırırken ALÇALTIYOR, kırmayı açmak
 * ise uzaklaştırırken YÜKSELTİYOR. İki eksen birbirinin hatasını besliyor.
 * Teleskopik vinçte aynı tuzağa düşülmüş ve çözüm de aynı olmuştu: hedef uç
 * konumundan açıları ANALİTİK çöz, sonra iki ekseni de hedefine sür.
 *
 * İki kollu zincirin klasik çözümü (kosinüs teoremi). İki matematiksel çözüm
 * var — dirsek yukarı ve dirsek aşağı — ama bu makinede kırma yalnızca AŞAĞI
 * katlanıyor (`kirmaMinDeg` 0), dolayısıyla tek geçerli kök kalıyor: ana bom
 * hedefe giden doğrunun ÜSTÜNDE.
 *
 * Erişilemeyen nokta için `null` döner — uydurulmuş bir açı sessizce yanlış
 * yere sürerdi.
 */
export function dirsekliCozum(hedef: { x: number; y: number }): DirsekliDurum | null {
  const s = DIRSEKLI_SPEC;
  const dx = hedef.x - s.pivotOffsetM;
  const dy = hedef.y - s.pivotHeightM;
  const d = Math.hypot(dx, dy);
  const L1 = s.anaBoomM;
  const L2 = s.kirmaBoomM;
  if (d > L1 + L2 || d < Math.abs(L1 - L2)) return null;

  // Dirsekteki iç açı: kosinüs teoremi. `kirmaDeg` düzlükten SAPMA olduğu
  // için 180'den çıkarıyoruz.
  const cosBeta = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2);
  const beta = Math.acos(Math.max(-1, Math.min(1, cosBeta)));
  const kirmaDeg = 180 - (beta * 180) / Math.PI;

  // Ana bomun, hedefe giden doğrudan sapması.
  const cosGamma = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const gamma = Math.acos(Math.max(-1, Math.min(1, cosGamma)));
  const anaDeg = ((Math.atan2(dy, dx) + gamma) * 180) / Math.PI;

  if (anaDeg < s.anaMinDeg || anaDeg > s.anaMaxDeg) return null;
  if (kirmaDeg < s.kirmaMinDeg || kirmaDeg > s.kirmaMaxDeg) return null;
  return { anaDeg, kirmaDeg };
}
