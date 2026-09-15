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

/** Yükün nasıl çizileceği. */
export type LoadKind = 'bobin' | 'tezgah' | 'jenerator' | 'klima';

export interface Task {
  kod: string;
  ad: string;
  tonnes: number;
  halfWidth: number;
  halfHeight: number;
  kind: LoadKind;
  /** factoryTerraces() indeksi: 0 = 1. kat, 1 = 2. kat, 2 = çatı. */
  hedef: number;
  /** Oyuncuya görevin ne olduğunu söyleyen tek cümle. */
  brif: string;
}

export const TASKS: readonly Task[] = [
  {
    kod: 'T1', ad: 'Sac bobin', tonnes: 2.3,
    halfWidth: 0.85, halfHeight: 0.72, kind: 'bobin', hedef: 0,
    brif: '1250 mm galvaniz bobin — 1. kat terasına',
  },
  {
    kod: 'T2', ad: 'CNC torna', tonnes: 3.1,
    halfWidth: 1.5, halfHeight: 0.95, kind: 'tezgah', hedef: 0,
    brif: 'Ağır CNC tezgâhı — aynı terasa, ama 800 kilo daha ağır',
  },
  {
    kod: 'T3', ad: 'Jeneratör', tonnes: 1.8,
    halfWidth: 1.6, halfHeight: 0.8, kind: 'jenerator', hedef: 1,
    brif: '100 kVA kabinli jeneratör — 2. kat terasına',
  },
  {
    kod: 'T4', ad: 'Klima santrali', tonnes: 1.25,
    halfWidth: 1.3, halfHeight: 0.75, kind: 'klima', hedef: 2,
    brif: 'Çatı klima santrali — en uzak nokta, ibre %94',
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
