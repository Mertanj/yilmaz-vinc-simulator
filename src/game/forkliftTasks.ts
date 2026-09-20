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
export const RAF_X = 24.0;
/** Rafın derinliği (m): ön yüzü `RAF_X`, arkası `RAF_X + RAF_DERINLIK`. */
export const RAF_DERINLIK = 2.6;
/**
 * Kat kotları (m).
 *
 * **En alt kat artık alçak olabiliyor.** Önceki yerleşimde raf makinenin iki
 * çalışma noktası ARASINDAYDI, dolayısıyla yüklü makine her turda rafın
 * önünden geçiyordu ve en alt kirişin taşınan paleti sıyırmaması gerekiyordu.
 * Yeni düzende makine rafın batısında kalıyor, hiç geçmiyor.
 *
 * **Aralık 1.70.** Paletin üstü bir üstteki kirişin altında kalmalı: taban
 * kirişin 0.36 m üstünde, palet en çok 0.90 m boyunda, yerleştirirken 0.12 m
 * pay, kiriş kalınlığı 0.16 — toplam 1.54, yani 16 cm boşluk. Makine yük
 * altında 1.4° öne yattığı için çatal ucunda oluşan 6 santimlik düşüşü de bu
 * pay karşılıyor.
 */
export const RAF_KATLARI = [1.30, 3.00, 4.70] as const;

/** Bir katın adı — depo raflarında gerçekten yazar. */
export function katAdi(i: number): string { return `R${i + 1}`; }

/**
 * Paletlerin geldiği yer — koridorun DOĞU ucu.
 *
 * Sıra artık sahadan gelen tarife göre: **makine → palet → raf.** Çatal doğuya
 * baktığı için hedefin de doğuda olması gerekiyor; önceki yerleşimde raf
 * makinenin batısında kalıyordu ve oyuncu rafa koymak için onun ÖNÜNDEN GEÇİP
 * arkasına dolanmak zorundaydı. Şimdi raf hep ileride: paleti al, aynı yöne
 * devam et, rafa koy.
 */
export const GIRIS_X = 17.0;
/**
 * Paletin teslim edildiği kot (m) — mal kabul konveyörünün ağzı.
 *
 * Palet oraya asılı duruyor ve makine yükleme karesinin BATISINA geçtiği an
 * iniyor. Sebebi makinenin kısıtı: forklift dönemediği için paleti alabilmek
 * hep onun batısında olmak zorunda, ama önceki paleti rafa bıraktığında
 * doğuda kalıyor. Palet önceden yerde duruyorsa makine batıya dönerken onu
 * önüne katıyor. Konveyör bunu çözüyor ve sahada da olan bir şey: mal kabul
 * paleti sen yerine geçtikten sonra indirir.
 */
export const TESLIM_KOTU = 3.6;
export const TESLIM_HIZI = 1.4;
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
    halfWidth: 0.58, halfHeight: 0.42, kind: 'cimento', hedef: 0,
    brif: 'R1, 1.30 m — ısınma turu: çatalı paletin cebine dibine kadar sok',
  },
  {
    kod: 'D2', ad: 'Fayans paleti', tonnes: 1.45,
    halfWidth: 0.60, halfHeight: 0.38, kind: 'fayans', hedef: 1,
    brif: 'R2, 3.00 m — kapasite tam burada erimeye başlıyor',
  },
  {
    kod: 'D3', ad: 'Boya varilleri', tonnes: 1.20,
    halfWidth: 0.88, halfHeight: 0.45, kind: 'varil', hedef: 1,
    brif: 'Geniş palet — çatal az girerse yük merkezi uzar, ibre tırmanır',
  },
  {
    kod: 'D4', ad: 'Yalıtım balyası', tonnes: 1.02,
    halfWidth: 0.95, halfHeight: 0.45, kind: 'balya', hedef: 2,
    brif: 'Bölümün en hafifi ama en genişi — en üst kat, 4.70 m',
  },
  {
    kod: 'D5', ad: 'Çelik profil', tonnes: 1.78,
    halfWidth: 0.52, halfHeight: 0.30, kind: 'profil', hedef: 2,
    brif: 'Bölümün en ağırı, en üst kat — ibre sınıra dayanır',
  },
];
