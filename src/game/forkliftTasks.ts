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
 * Raf gözleri — her gözün TEK katı var ve katlar kademeli yükseliyor.
 *
 * Çok katlı raf denendi ve 2B'de kendi kuyruğunu yakaladı: yükü bir gözün alt
 * katına koymak için paleti iki kirişin arasından geçirmek gerekiyor, makine
 * ise yük altında öne yatıyor. Ölçümde palet her seferinde üstteki kirişin
 * kenarına takıldı ve makine tam gazda ilerleyemedi (temas 21.29 , 1.85).
 * Yandan bakan bir oyunda bu, oyuncunun göremediği bir hassasiyet.
 *
 * Kademeli raf aynı beceriyi daha okunur biçimde istiyor: hedefin üstü açık,
 * zorluk YÜKSEKLİKTE ve MESAFEDE. Girişe en yakın göz en alçak; en uzak göz
 * en yüksek, yani kapasitenin en çok eridiği yer.
 */
export interface RafGozu { x: number; kot: number; ad: string; }

export const RAF_GOZLERI: readonly RafGozu[] = [
  { x: 11.5, kot: 4.75, ad: 'A' },
  { x: 17.0, kot: 3.30, ad: 'B' },
  { x: 22.5, kot: 1.85, ad: 'C' },
];

/** Bir gözün yarı derinliği (m). Yük buraya sığmak zorunda. */
export const RAF_YARI = 1.2;

/**
 * Paletlerin geldiği yer — koridorun DOĞU ucu.
 *
 * Konum keyfi değil, makinenin kısıtından çıkıyor: forklift yan görünümde
 * dönemiyor, çatalı hep doğuya bakıyor, dolayısıyla paleti alabilmek için hep
 * onun batısında olmalı. Paletler rafların batısında olsaydı makine her turda
 * yeni paletin içinden geçmek zorunda kalırdı ve bölüm ikinci görevde
 * kilitlenirdi (ölçüldü). Paletler doğuda, hedefler batıda: makine yüklü
 * batıya gidiyor, boş doğuya dönüyor, hiçbir turda önünü kesen şey olmuyor.
 */
export const GIRIS_X = 29.0;
/** Depo duvarları — koridorun iki ucu. */
export const DEPO_BATI = -12;
export const DEPO_DOGU = 44;

/**
 * Paletin ayak yüksekliği (m): çatalın gireceği cep.
 *
 * Palet rafa AYAKLARIYLA oturuyor, tabanıyla değil — bırakma kotu bu yüzden
 * kiriş kotunun `PALET_AYAK - bıçak` kadar üstünde.
 *
 * 0.22 iken cep bıçağa 16 cm pay bırakıyordu ve bu yetmedi: makine yük
 * altında 1.4° öne yatıyor, bu da çatal ucunda 6 santim düşüş demek.
 * Bıçak çekilirken kirişin kenarına takılıyor, makinenin burnunu kaldırıyor
 * ve araç 39 derece şahlanıyordu. 0.30 cep, iki yana da 12 santim pay
 * bırakıyor.
 */
export const PALET_AYAK = 0.36;

/** Görevin gideceği göz. */
export function rafGozu(index: number): RafGozu | undefined {
  return RAF_GOZLERI[index];
}

export const FORKLIFT_TASKS: readonly Task[] = [
  {
    kod: 'D1', ad: 'Çimento paleti', tonnes: 1.30,
    halfWidth: 0.58, halfHeight: 0.45, kind: 'tezgah', hedef: 2,
    brif: 'C gözü, 1.85 m — ısınma turu: çatalı cebe düzgün sok',
  },
  {
    kod: 'D2', ad: 'Fayans paleti', tonnes: 1.47,
    halfWidth: 0.60, halfHeight: 0.40, kind: 'bobin', hedef: 1,
    brif: 'B gözü, 3.30 m — kapasite burada erimeye başlıyor',
  },
  {
    kod: 'D3', ad: 'Boya varilleri', tonnes: 1.20,
    halfWidth: 0.88, halfHeight: 0.48, kind: 'jenerator', hedef: 1,
    brif: 'Geniş palet — çatalı dibine kadar sok, yoksa yük merkezi uzar',
  },
  {
    kod: 'D4', ad: 'Yalıtım balyası', tonnes: 1.00,
    halfWidth: 0.95, halfHeight: 0.55, kind: 'klima', hedef: 0,
    brif: 'Bölümün en hafifi ama en genişi — A gözü, 4.75 m',
  },
  {
    kod: 'D5', ad: 'Çelik profil', tonnes: 1.74,
    halfWidth: 0.52, halfHeight: 0.32, kind: 'kompresor', hedef: 0,
    brif: 'Bölümün en ağırı, en uzak ve en yüksek göz — ibre sınıra dayanır',
  },
];
