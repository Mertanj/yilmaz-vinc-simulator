/**
 * Bölüm 1 — "Sanayi Sitesi, C Blok" görev listesi.
 *
 * Ağırlıklar keyfi değil: park edilen yerden ÖLÇÜLEN kapasiteye göre seçildi.
 * `npm run sahne` zarf tablosu üç hedef için R ve kapasiteyi veriyor —
 *
 *   P1 (1. kat terası)  R 13.1 m   kapasite 4.54 t
 *   P2 (2. kat terası)  R 17.6 m   kapasite 2.64 t
 *   P3 (çatı)           R 21.1 m   kapasite 1.81 t
 *
 * — ve yükler hedeflenen LMI eğrisini (%61 → %79 → %86 → %94) verecek şekilde
 * geriye doğru hesaplandı; kanca 0.45 t brüte dahil. Zorluk yükün kendisinden
 * değil, yükün YARIÇAPTAKİ ağırlığından geliyor: T1 ve T2 aynı terasa gidiyor,
 * tek değişen ağırlık. Oyuncunun tabloyu kendi üstünde keşfetmesinin en ucuz
 * yolu bu.
 *
 * Boyutlar gerçek katalog ölçülerinden (yan görünüm, yarı-boyut olarak).
 */

/**
 * Yükün nasıl çizileceği.
 *
 * İlk beşi sanayi sitesi (vinç ve forklift), son beşi bahçe inşaatı
 * (dirsekli bom). Ayrı bir tip yapmadık: `Task` üç bölümde de aynı ve
 * çizim tarafı zaten tek bir `switch` ile karşılıyor.
 */
/**
 * Yük türü — ÇİZİM buna bakıyor, ada değil.
 *
 * Üç makinenin üç ayrı kümesi var ve karışmamaları şart. Bir kez karıştı:
 * forkliftin beş görevi de vincin türlerini kullanıyordu, yani "Çimento
 * paleti" ekranda bir CNC TEZGÂHI olarak çiziliyordu. Ad veri dosyasında,
 * çizim `missionView.ts`'te; ikisi ayrı yerde durduğu için kayma sessiz
 * kaldı. `drawLoad` artık tüketicilik denetimli — yeni bir tür eklenip
 * çizimi unutulursa derlenmiyor.
 */
export type LoadKind =
  // Vinç — sanayi sitesi: fabrikadan çıkan makine ve malzeme.
  | 'bobin' | 'tezgah' | 'jenerator' | 'kompresor' | 'klima'
  // Dirsekli — kaba inşaat: şantiyeye çıkan malzeme.
  | 'briket' | 'donati' | 'kum' | 'kalip' | 'kova'
  // Forklift — depo: paletli ticari mal.
  | 'cimento' | 'fayans' | 'varil' | 'balya' | 'profil';

export interface Task {
  kod: string;
  ad: string;
  tonnes: number;
  halfWidth: number;
  halfHeight: number;
  kind: LoadKind;
  /**
   * factoryTerraces() indeksi. Hedefler 0..3, yani dört teras.
   *
   * **Çatı (indeks 4) bilerek hedef DEĞİL** ve bu ölçümle karara bağlandı:
   * çatının yarıçapında (24.1 m) bom ucu en fazla 22.7 metreye çıkıyor, oysa
   * yükü bırakabilmek için 2 metrelik halat payıyla 24.4 metre gerekiyor —
   * 30 metrelik bom 31.1 metrelik bir konfigürasyon istiyor. Çatıya çıkmak
   * daha büyük bir vinç işi; YV-25'in dürüst sınırı burası.
   */
  hedef: number;
  /** Oyuncuya görevin ne olduğunu söyleyen tek cümle. */
  brif: string;
}

/**
 * Beş görev, beş katlı bina, dört teras.
 *
 * Ağırlıklar yine geriye doğru: her hedefin ölçülen kapasitesinden hedeflenen
 * LMI'ye bölünüp kanca (0.45 t) düşülerek. Eğri %60 → %78 → %83 → %87 → %90 →
 * %94; yani her kat bir öncekinden gergin ve yük yukarı çıktıkça hafifliyor —
 * sahadaki kuralın ta kendisi.
 *
 * İlk iki görev aynı terasa gidiyor ve tek değişen ağırlık. Tekrar değil,
 * kontrollü deney: oyuncu tablonun *yer* değil *yarıçaptaki yük* ile ilgili
 * olduğunu kendi üstünde görüyor.
 *
 * **Genişlik sınırı 2.4 m** (yarı genişlik 1.2): teras derinliği kademeye eşit
 * ve kademe 3.0 m. Daha geniş bir yük terasa sığmıyor.
 */
export const TASKS: readonly Task[] = [
  {
    kod: 'T1', ad: 'Sac bobin', tonnes: 2.3,
    halfWidth: 0.85, halfHeight: 0.72, kind: 'bobin', hedef: 0,
    brif: '1250 mm galvaniz bobin — 1. kat terasına',
  },
  {
    kod: 'T2', ad: 'CNC torna', tonnes: 3.1,
    halfWidth: 1.2, halfHeight: 0.95, kind: 'tezgah', hedef: 0,
    brif: 'Ağır CNC tezgâhı — aynı terasa, ama 800 kilo daha ağır',
  },
  {
    kod: 'T3', ad: 'Jeneratör', tonnes: 2.2,
    halfWidth: 1.2, halfHeight: 0.8, kind: 'jenerator', hedef: 1,
    brif: '125 kVA kabinli jeneratör — 2. kat terasına',
  },
  {
    kod: 'T4', ad: 'Vidalı kompresör', tonnes: 1.5,
    halfWidth: 1.05, halfHeight: 0.85, kind: 'kompresor', hedef: 2,
    brif: 'Vidalı kompresör — 3. kat, yarıçap 19 metre',
  },
  {
    kod: 'T5', ad: 'Klima santrali', tonnes: 1.05,
    halfWidth: 1.1, halfHeight: 0.7, kind: 'klima', hedef: 3,
    brif: 'Klima santrali — en üst teras, bomun sonu, ibre %92',
  },
];

/**
 * Malzeme alanı: her görevin yükü buraya geliyor.
 *
 * Tek nokta, çünkü dördü aynı anda sahaya sığmıyor. Takozun sağ kenarı 58.25,
 * fabrika cephesi 62.0 — arada 3.75 metre var ve en geniş yük (CNC) 3 metre.
 * Dördünü yan yana dizmek 12 metre ister; o da binayı 12 metre uzağa iter ve
 * bütün bırakma yarıçapları erişilemez olur. Sahada da zaten malzeme tek tek
 * gelir. (Sprint 5 notu: yükü getiren kamyonu canlandırmak bunu gözle de
 * anlaşılır kılar.)
 */
export const MALZEME_X = 60.1;
