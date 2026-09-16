import type { Task } from './tasks';

/**
 * Forklift bölümü — "Depo, sevkiyat rampası".
 *
 * Yükler raflara gidiyor. Zorluk vinçtekinin AYNISI değil, çünkü forkliftte
 * sınırı koyan iki şey var ve ikisi de yatay: yük merkezi mesafesi (yük ne
 * kadar geniş) ve kaldırma yüksekliği (3.3 m üstünde kapasite eriyor). Geniş
 * bir yükü yukarı çıkarmak, dar bir yükü aynı rafa koymaktan çok daha zor.
 *
 * Devrilme burada GERÇEKTEN olabilir: makine lastik üstünde, devrilme ekseni
 * ön aks ve ayak yok. Vinçte erişilemeyen tehlike forkliftte oyunun merkezinde.
 */
export const RAF_X = 26.0;
/**
 * Rafın yarı derinliği (m) — yani ÖN YÜZÜ `RAF_X - RAF_YARI` noktasında.
 *
 * Bu sayı keyfi değil, makinenin ölçüsünden çıkıyor: forklift rafın önünde
 * durur, yükü çatalıyla içeri uzatır. Çatal topuğu şasi merkezinden
 * `mastX` (1.45 m) ileride, dolayısıyla makine ön yüzü rafın ön yüzünden
 * 10 cm geride kalıyor. Raf daha derin olsaydı yükü ortasına koymak için
 * makineyi rafın içine sürmek gerekirdi — gerçekte de olmayan bir şey.
 */
export const RAF_YARI = 1.15;
/**
 * Raf katlarının kotu (m) — çatal buraya çıkacak.
 *
 * **En alt kat şasinin ÜSTÜNDE.** Sebebi oynanışın kendisi: forklift yan
 * görünümde dönemiyor, dolayısıyla paleti almak için hep onun BATISINDA
 * olmalı. Paletler rafın doğusunda bekliyorsa makine her turda rafın önünden
 * geçmek zorunda — geçemezse ikinci paleti hiç alamıyor (ölçüldü: bölüm
 * D2'de kilitlendi). Kiriş altı 1.62 m, şasi tavanı 1.48 m: 14 cm boşlukla
 * geçiyor. Kafes ve direk çarpışmıyor, çünkü yan görünümde raf dikmeleri
 * koridorun ARKASINDA — çizim de onları aktörlerin arkasına koyuyor.
 */
export const RAF_KATLARI = [1.80, 3.20, 4.60] as const;
/** Rafın ön yüzü: yük buraya dayanacak. */
export const RAF_ON = RAF_X - RAF_YARI;
/** Malzeme alanı: paletler rafın DOĞUSUNDA bekliyor. */
export const FORKLIFT_MALZEME_X = 31.0;
/** Depo duvarları — koridorun iki ucu. */
export const DEPO_BATI = -12;
export const DEPO_DOGU = 44;

export const FORKLIFT_TASKS: readonly Task[] = [
  {
    kod: 'D1', ad: 'Çimento paleti', tonnes: 1.35,
    halfWidth: 0.6, halfHeight: 0.55, kind: 'tezgah', hedef: 0,
    brif: '48 torba çimento — alt rafa, dar palet',
  },
  {
    kod: 'D2', ad: 'Fayans paleti', tonnes: 1.55,
    halfWidth: 0.62, halfHeight: 0.42, kind: 'bobin', hedef: 1,
    brif: 'Seramik karo — orta rafa',
  },
  {
    kod: 'D3', ad: 'Boya varilleri', tonnes: 1.32,
    halfWidth: 0.85, halfHeight: 0.5, kind: 'jenerator', hedef: 1,
    brif: 'Dört varil — geniş palet, yük merkezi uzuyor',
  },
  {
    kod: 'D4', ad: 'Yalıtım balyası', tonnes: 0.90,
    halfWidth: 1.05, halfHeight: 0.62, kind: 'klima', hedef: 2,
    brif: 'Hafif ama çok geniş — üst rafa, ibre yine de tırmanır',
  },
  {
    kod: 'D5', ad: 'Çelik profil', tonnes: 1.72,
    halfWidth: 0.55, halfHeight: 0.35, kind: 'kompresor', hedef: 2,
    brif: 'Bölümün en ağırı — dar palet, ama en üst rafta ibre sınıra dayanır',
  },
];
