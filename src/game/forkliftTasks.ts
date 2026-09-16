import type { Task } from './tasks';

/**
 * Forklift bölümü — "Depo, sevkiyat koridoru".
 *
 * Zorluk vinçtekinin aynısı değil. Vinçte sınırı YARIÇAP koyuyor; burada iki
 * şey birden: yük merkezi mesafesi (paletin ne kadar derin olduğu ve çatalın
 * ne kadar içeri girdiği) ve kaldırma yüksekliği (3.3 m üstünde kapasite
 * eriyor). Geniş bir paleti üst rafa koymak, ondan ağır ama dar bir paleti
 * aynı rafa koymaktan zordur.
 *
 * **Yük merkezi artık ÖLÇÜLÜYOR.** Çatal paletin cebine ne kadar girdiyse
 * mesafe o; yarı yamalak sokulmuş palet gerçekten daha yüksek okuyor. Bu
 * yüzden zorluk sadece hangi paleti seçtiğinde değil, onu nasıl aldığında.
 */

/**
 * **TEK RAF, ÇOK KATLI.** Vinç bölümündeki bina gibi: bir yapı, üç kat.
 *
 * Önce üç ayrı göz koridora yayılmıştı ve sahadan gelen itiraz haklıydı:
 * *"rafler yolun ortasında ama yükler sağ tarafta, yükleri alıp rack'e
 * koyarken bir önceki rack'e çarpıyorsun."* Doğru — uzaktaki göze giderken
 * çatal yukarıdaysa yük yakındaki rafın kirişine biniyordu, ve oyuncunun
 * bunu önceden görmesinin bir yolu yoktu.
 *
 * Tek raf bunu kökünden çözüyor: makine giriş alanı ile rafın önü arasında
 * gidip geliyor, arada hiçbir şey yok. Raf makinenin hep BATISINDA, paletler
 * hep DOĞUSUNDA — çatal doğuya baktığı için ikisi de doğru tarafta.
 */
export const RAF_X = 20.0;
/** Rafın derinliği (m): ön yüzü `RAF_X`, arkası `RAF_X + RAF_DERINLIK`. */
export const RAF_DERINLIK = 2.6;
/**
 * Kat kotları (m). İki sayı da ölçümden çıktı:
 *
 * **En alt kat 1.70.** Raf, makinenin iki çalışma noktası ARASINDA duruyor
 * (giriş doğuda, bırakma yeri rafın hemen batısında), dolayısıyla yüklü
 * makine her turda rafın önünden geçiyor. Taşıma kotunda paletin üstü 1.31
 * metrede kalıyor; 1.40'ta kiriş altı 1.24'tü ve palet kirişi sıyırıp çatalın
 * ucuna doğru 60 santim kayıyordu — ölçülen yük merkezi 0.63'ten 1.20'ye
 * çıkıp makineyi kendi kendine aşırı yüke sokuyordu. 1.70'te 23 cm boşluk var.
 *
 * **Aralık 1.70.** Paletin üstü bir üstteki kirişin altında kalmalı: taban
 * kirişin 0.36 m üstünde, palet en çok 0.90 m boyunda, yerleştirirken 0.12 m
 * pay, kiriş kalınlığı 0.16 — toplam 1.54, yani 16 cm boşluk. Makine yük
 * altında 1.4° öne yattığı için çatal ucunda oluşan 6 santimlik düşüşü de bu
 * pay karşılıyor.
 */
export const RAF_KATLARI = [1.70, 3.40, 5.10] as const;

/** Bir katın adı — depo raflarında gerçekten yazar. */
export function katAdi(i: number): string { return `R${i + 1}`; }

/**
 * Paletlerin geldiği yer — koridorun DOĞU ucu.
 *
 * Konum keyfi değil, makinenin kısıtından çıkıyor: forklift yan görünümde
 * dönemiyor, çatalı hep doğuya bakıyor, dolayısıyla paleti alabilmek için hep
 * onun batısında olmalı. Paletler rafın batısında olsaydı makine her turda
 * yeni paletin içinden geçmek zorunda kalırdı ve bölüm ikinci görevde
 * kilitlenirdi (ölçüldü).
 */
export const GIRIS_X = 29.0;
/** Depo duvarları — koridorun iki ucu. */
export const DEPO_BATI = -12;
export const DEPO_DOGU = 44;

/**
 * Paletin ayak yüksekliği (m): çatalın gireceği cep.
 *
 * Palet rafa AYAKLARIYLA oturuyor, tabanıyla değil — bırakma kotu bu yüzden
 * kiriş kotunun `PALET_AYAK - bıçak` kadar üstünde. 0.22 iken cep bıçağa 16
 * cm pay bırakıyordu ve yetmedi: bıçak çekilirken kirişin kenarına takılıyor,
 * makinenin burnunu kaldırıyor ve araç 39 derece şahlanıyordu.
 */
export const PALET_AYAK = 0.36;

/** Görevin gideceği katın kotu (m). */
export function katKotu(index: number): number | undefined {
  return RAF_KATLARI[index];
}

export const FORKLIFT_TASKS: readonly Task[] = [
  {
    kod: 'D1', ad: 'Çimento paleti', tonnes: 1.29,
    halfWidth: 0.58, halfHeight: 0.42, kind: 'tezgah', hedef: 0,
    brif: 'R1, 1.40 m — ısınma turu: çatalı paletin cebine dibine kadar sok',
  },
  {
    kod: 'D2', ad: 'Fayans paleti', tonnes: 1.49,
    halfWidth: 0.60, halfHeight: 0.38, kind: 'bobin', hedef: 1,
    brif: 'R2, 3.10 m — kapasite tam burada erimeye başlıyor',
  },
  {
    kod: 'D3', ad: 'Boya varilleri', tonnes: 1.23,
    halfWidth: 0.88, halfHeight: 0.45, kind: 'jenerator', hedef: 1,
    brif: 'Geniş palet — çatal az girerse yük merkezi uzar, ibre tırmanır',
  },
  {
    kod: 'D4', ad: 'Yalıtım balyası', tonnes: 1.02,
    halfWidth: 0.95, halfHeight: 0.45, kind: 'klima', hedef: 2,
    brif: 'Bölümün en hafifi ama en genişi — en üst kat, 4.80 m',
  },
  {
    kod: 'D5', ad: 'Çelik profil', tonnes: 1.62,
    halfWidth: 0.52, halfHeight: 0.30, kind: 'kompresor', hedef: 2,
    brif: 'Bölümün en ağırı, en üst kat — ibre sınıra dayanır',
  },
];
