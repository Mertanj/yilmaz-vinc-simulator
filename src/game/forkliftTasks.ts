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
 * **ÜÇ RAF ADASI, HER BİRİNİN BATISINDA KENDİ KORİDORU.**
 *
 * Önce tek bir raf vardı ve sahadan gelen itiraz haklıydı: *"level design çok
 * basit ve cheesy duruyor, harita tam net değil."* Doğruydu — depo 56 metre
 * uzunluğundaydı ve bölüm bunun 7 metresini kullanıyordu. Beş görev de aynı
 * rafın önünde geçiyordu; tek değişen kattı.
 *
 * Ondan ÖNCE de üç ayrı göz denenmişti ve o sürüm başka bir sebepten
 * bozuktu: *"rafler yolun ortasında ama yükler sağ tarafta, yükleri alıp
 * rack'e koyarken bir önceki rack'e çarpıyorsun."* O da doğruydu. Sebebi
 * raf sayısı değildi, EN ALT KİRİŞİN KOTUYDU: 1.30 metredeki kiriş, taşıma
 * kotunda giden paletin (üstü 1.41 m) tam üstüne geliyordu.
 *
 * Bu sürüm ikisini birden çözüyor:
 *
 *  - **En alt göz ZEMİN gözü — kirişi yok.** Gerçek rafta da en alttaki
 *    palet zemine konur, ilk kiriş onun üstündedir. Dolayısıyla koridorda
 *    ilerleyen paletin çarpabileceği hiçbir şey 3.00 metrenin altında yok.
 *  - **Konan palet STOK oluyor:** gözün derinliğine itiliyor ve artık hiçbir
 *    şeyle çarpışmıyor. Sahada da olan bu; koridor arkanda temiz kalıyor.
 *
 * Adalar 6.00 metre arayla: 2.60 m raf + 3.40 m koridor. Makinenin çatalı
 * şasinin 2.5 metre önünde olduğu için bırakma noktasının 2 metre batısı
 * BOŞ olmak zorunda — koridorun 3.40 metresi tam olarak bunu veriyor ve
 * `npm run sahne:forklift` her turda ölçüyor.
 */
export const ADA_X: readonly number[] = [23.0, 29.0, 35.0];
/** Bir adanın derinliği (m): ön yüzü `ADA_X[i]`, arkası + bu. */
export const RAF_DERINLIK = 2.6;
/** İlk adanın ön yüzü — eski tek-raf sabitinin karşılığı. */
export const RAF_X = ADA_X[0] ?? 23.0;
/** Adaların adı: depo adreslerinde gerçekten harf kullanılır. */
export const ADA_ADI = ['A', 'B', 'C'] as const;

/**
 * Kat kotları (m). **Sıfır bir kat DEĞİL, zemindir.**
 *
 * **Kotlar GÖZE GİRERKENKİ paya göre seçildi, oturduktan sonrakine göre
 * değil.** İlk sürümde 3.00/4.70 vardı ve oturmuş palet için hesap doğruydu
 * (28 cm boşluk) — ama palet göze AYAKLARIYLA oturuyor, yani girerken
 * çatalın `PALET_AYAK` kadar yukarıda olması gerekiyor. Ölçüldü:
 *
 *     görev  taşıma kotu  yük üstü  üstteki kiriş altı   pay
 *     D2     3.30         4.42      4.54                 12 cm
 *     D3     3.30         4.56      4.54                −2 cm
 *
 * Yani geniş varil paleti gözüne fiziken GİREMİYORDU: iki santim kirişin
 * içinde. Oyun testinde makine gözün 1.4 metre önünde durdu, altmış saniye
 * boyunca ilerleyemedi ve hiçbir uyarı çıkmadı — oyuncunun göremediği bir
 * duvar. (Başsız rig geçebiliyordu, çünkü Box2D iki santimlik girişimi
 * itiyor; oyuncu ise sıkışıyor.)
 *
 * 2.80/4.90 ile aynı hesap: D3 için 38 cm, D2 için 52 cm pay. Üst kat 20 cm
 * yükseldi, yükseklik çarpanı 0.865'ten 0.846'ya indi ve bölümün en ağır
 * paleti %92'den %94'e çıktı — sınırın altında ve zorluk eğrisi yerinde.
 */
export const RAF_KATLARI = [0.00, 2.80, 4.90] as const;

/** Bir raf adresi: hangi ada, hangi kat. */
export interface RafAdresi { ada: number; kat: number; }

/**
 * Bütün adresler, ada-önce sırayla. `Task.hedef` bunun indeksi.
 *
 * `Task` üç makinede ortak ve `hedef` orada tek bir sayı; adresi sayıya
 * çevirmek yerine üçüncü bir alan eklemek üç bölümü birden ilgilendirirdi.
 * Düz liste hem `Task`ı olduğu gibi bırakıyor hem de "kaç adres var"
 * sorusunu tek yerde cevaplıyor.
 */
export const RAF_ADRESLERI: readonly RafAdresi[] = ADA_X.flatMap(
  (_, ada) => RAF_KATLARI.map((_k, kat) => ({ ada, kat })),
);

export function adres(i: number): RafAdresi | undefined { return RAF_ADRESLERI[i]; }

/** Adresin ada indeksi ile kat indeksinden liste indeksi. */
export function adresIndeksi(ada: number, kat: number): number {
  return ada * RAF_KATLARI.length + kat;
}

/**
 * Adresin adı — depo raflarında gerçekten yazar: ada harfi + kat numarası.
 *
 * Zemin gözü "A0" değil "A-Z": rafta zemin gözünün numarası olmaz, çünkü o
 * bir kat değil. Oyuncunun brifingte okuduğu ad ile rafın üstünde boyalı
 * duran ad AYNI dizeden geliyor — ikisi ayrı yerde yazıldığında sessizce
 * ayrışıyor ve oyuncu yanlış gözün önünde bekliyor.
 */
export function katAdi(i: number): string {
  const a = adres(i);
  if (!a) return '?';
  const harf = ADA_ADI[a.ada] ?? '?';
  return a.kat === 0 ? `${harf}-Z` : `${harf}${a.kat}`;
}

/** Adresin kotu (m) — zemin gözünde 0. */
export function adresKotu(i: number): number | undefined {
  const a = adres(i);
  return a === undefined ? undefined : RAF_KATLARI[a.kat];
}

/** Adresin ada ön yüzü (m). */
export function adresX(i: number): number | undefined {
  const a = adres(i);
  return a === undefined ? undefined : ADA_X[a.ada];
}

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
/**
 * **Bekleme çizgisi** — paletin inebilmesi için çatal ucunun batısında
 * kalması gereken x.
 *
 * Eskiden bu çizgi görevin paletine göre değişiyordu (`GIRIS_X - yarıEn -
 * 0.45`) ve bu iki ayrı soruna yol açıyordu. Birincisi: zeminde çizilebilecek
 * SABİT bir çizgi yoktu, dolayısıyla oyuncuya nerede duracağı hiç
 * söylenemiyordu. İkincisi ölçümle çıktı — başsız rig paletlerin dördünü
 * ancak frenleme sırasında çizgiyi KAZARA geçtiği için alabiliyordu; dar
 * paletin (D5) geldiği turda yeterince batıya savrulmayınca palet hiç
 * inmedi ve görev "alınamadı" sayıldı.
 *
 * Şimdi tek bir çizgi ve en geniş palete göre: 0.95 m yarı genişlikteki
 * paletin batı yüzü 16.05'te, çizgi 15.75'te — 30 cm pay. Zeminde de
 * boyalı duruyor.
 */
export const BEKLEME_CIZGISI = GIRIS_X - 1.25;
/**
 * Zemin boyasının kapladığı bant (m) — y = 0'ın ALTINDA.
 *
 * Yan görünümde zemin tek bir çizgi; boya nereye gidecek? Sahnenin baştan
 * beri kullandığı sözleşme bu: sıfırın altı, izleyiciye doğru uzanan zemin
 * (beton derzleri de hep öyle çizildi). Kamera bu bandı kadrajda tutmak
 * zorunda, yoksa koridor şeritleri, yön okları ve göz ayak izleri ekranın
 * altında kalıyor — ölçüldü, boyanın tamamı görünmüyordu.
 */
export const ZEMIN_BANDI = 2.3;

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

/** Görevin gideceği gözün kotu (m). `adresKotu`nun eski adı. */
export function katKotu(index: number): number | undefined {
  return adresKotu(index);
}

/**
 * Beş görev, beş AYRI adres.
 *
 * Eski listede beşi de aynı rafa gidiyordu; tek değişen kattı ve bölüm
 * boyunca makine 7 metrelik bir şeritte gidip geliyordu. Şimdi rota da
 * görevin bir parçası: yakın ada → orta ada → uzak ada, ve arada aynı adaya
 * bir üst kat için dönülüyor.
 *
 * Zorluk eğrisi kasıtlı ve ölçülebilir:
 *
 *   D1  A-Z  zemin,  6 m  — ısınma: sadece çatalı cebe sokmayı öğretiyor
 *   D2  B1   3.00 m, 12 m — ilk yükseklik; kapasite erimeye başlıyor
 *   D3  C1   3.00 m, 18 m — en uzak ada; geniş palet, yük merkezi uzuyor
 *   D4  A2   4.70 m,  6 m — en üst kat, ama geri dönüp en yakın adada
 *   D5  C2   4.70 m, 18 m — en ağır palet, en uzak adanın en üst katı

 * Geniş varil paleti (yarı genişlik 0.88 m) bilerek 3.00 metrede kaldı:
 * 4.70'te ölçülen yük merkezi 0.95 m'ye çıkıyor, yükseklik çarpanı 0.865'e
 * iniyor ve ibre %101 okuyordu. Yani ideal bir operatör bile kırmızıya
 * giriyordu — bir bölüm oyuncudan yapılamayacak bir şey istememeli.
 *
 * Boş kalan dört adres (A1, B-Z, B2, C-Z) rastgele değil: depo dolu dursun
 * diye önceden stok konuyor. Oyuncunun hedefi olan gözler ise BOŞ — dolu
 * bir gözü hedef göstermek, sahada olmayan bir şey.
 */
export const FORKLIFT_TASKS: readonly Task[] = [
  {
    kod: 'D1', ad: 'Çimento paleti', tonnes: 1.29,
    halfWidth: 0.58, halfHeight: 0.42, kind: 'cimento',
    hedef: adresIndeksi(0, 0),
    brif: 'A-Z, zemin gözü — ısınma turu: çatalı paletin cebine dibine kadar sok',
  },
  {
    kod: 'D2', ad: 'Fayans paleti', tonnes: 1.45,
    halfWidth: 0.60, halfHeight: 0.38, kind: 'fayans',
    hedef: adresIndeksi(1, 1),
    brif: 'B1, 3.00 m — ikinci ada: kapasite tam burada erimeye başlıyor',
  },
  {
    kod: 'D3', ad: 'Boya varilleri', tonnes: 1.20,
    halfWidth: 0.88, halfHeight: 0.45, kind: 'varil',
    hedef: adresIndeksi(2, 1),
    brif: 'C1, 3.00 m — geniş palet: çatal az girerse yük merkezi uzar, ibre tırmanır',
  },
  {
    kod: 'D4', ad: 'Yalıtım balyası', tonnes: 1.02,
    halfWidth: 0.95, halfHeight: 0.45, kind: 'balya',
    hedef: adresIndeksi(0, 2),
    brif: 'A2, 4.70 m — bölümün en hafifi ama en genişi: ilk adaya geri dön',
  },
  {
    kod: 'D5', ad: 'Çelik profil', tonnes: 1.70,
    halfWidth: 0.52, halfHeight: 0.30, kind: 'profil',
    hedef: adresIndeksi(2, 2),
    brif: 'C2, 4.70 m — bölümün en ağırı, en uzak adanın en üst katı',
  },
];

/**
 * Önceden konmuş stok: hangi adres dolu, ne var içinde.
 *
 * Tamamen DEKOR — fizik gövdesi yok. Sebebi geometrik: bu paletler gözün
 * derinliğinde duruyor, makinenin geçtiği koridorda değil. Çizimde de öyle
 * gösteriliyorlar (derinliğe kaydırılmış, biraz küçük ve loş), dolayısıyla
 * makinenin önlerinden geçmesi doğru görünüyor.
 */
export const RAF_STOGU: ReadonlyArray<{ hedef: number; kind: Task['kind'];
  halfWidth: number; halfHeight: number }> = [
  { hedef: adresIndeksi(0, 1), kind: 'fayans', halfWidth: 0.62, halfHeight: 0.40 },
  { hedef: adresIndeksi(1, 0), kind: 'cimento', halfWidth: 0.70, halfHeight: 0.44 },
  { hedef: adresIndeksi(1, 2), kind: 'balya', halfWidth: 0.90, halfHeight: 0.42 },
  { hedef: adresIndeksi(2, 0), kind: 'briket', halfWidth: 0.66, halfHeight: 0.46 },
];
