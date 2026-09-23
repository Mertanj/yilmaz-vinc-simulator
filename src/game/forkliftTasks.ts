import type { ForkliftBolum, ForkliftGorevi } from './forkliftBolum';

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
/**
 * Raf derinliği (m) — ön yüzü `adaX[i]`, arkası + bu.
 *
 * Bölüme değil DÜNYAYA ait: 2.6 metre standart Euro palet rafı ve her
 * depoda aynı. Bölüme ait olan, rafların NEREDE olduğu.
 */
export const RAF_DERINLIK = 2.6;

/**
 * Paletin ayak yüksekliği (m): çatalın gireceği cep.
 *
 * Palet rafa AYAKLARIYLA oturuyor, tabanıyla değil — bırakma kotu bu yüzden
 * kiriş kotunun `PALET_AYAK - bıçak` kadar üstünde. 0.22 iken cep bıçağa 16
 * cm pay bırakıyordu ve yetmedi: bıçak çekilirken kirişin kenarına takılıyor,
 * makinenin burnunu kaldırıyor ve araç 39 derece şahlanıyordu.
 *
 * Paletin özelliği, deponun değil — o yüzden bölümde değil burada.
 */
export const PALET_AYAK = 0.36;

/** Konveyörün paleti indirme hızı (m/s) — mekanizmanın kendi ayarı. */
export const TESLIM_HIZI = 1.4;

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

// --- BÖLÜM 1: "Depo, sevkiyat koridoru" -------------------------------------

/**
 * **ÜÇ RAF ADASI, HER BİRİNİN BATISINDA KENDİ KORİDORU.**
 *
 * Önce tek bir raf vardı ve sahadan gelen itiraz haklıydı: *"level design çok
 * basit ve cheesy duruyor, harita tam net değil."* Depo 56 metre uzunluğunda
 * ve bölüm bunun 7 metresini kullanıyordu.
 *
 * Ondan ÖNCE de üç ayrı göz denenmişti ve o sürüm başka bir sebepten
 * bozuktu: *"rafler yolun ortasında ama yükler sağ tarafta, yükleri alıp
 * rack'e koyarken bir önceki rack'e çarpıyorsun."* Sebebi raf sayısı değil,
 * EN ALT KİRİŞİN KOTUYDU: 1.30 metredeki kiriş, taşıma kotunda giden
 * paletin (üstü 1.41 m) tam üstüne geliyordu. Bu yüzden en alt göz artık
 * ZEMİN gözü — kirişi yok, gerçek rafta da en alttaki palet zemine konur.
 *
 * Adalar 6.00 metre arayla: 2.60 m raf + 3.40 m koridor. Makinenin çatalı
 * şasinin 2.5 metre önünde olduğu için bırakma noktasının 2 metre batısı
 * BOŞ olmak zorunda ve `npm run sahne:forklift` bunu her turda ölçüyor.
 */
const B1_ADA_X = [23.0, 29.0, 35.0];
/**
 * Kat kotları. **GÖZE GİRERKENKİ paya göre seçildi**, oturduktan sonrakine
 * göre değil — palet göze ayaklarıyla oturuyor, girerken çatal 36 cm daha
 * yukarıda. 3.00/4.70 ile ölçüm şöyleydi:
 *
 *     görev  taşıma kotu  yük üstü  üstteki kiriş altı   pay
 *     D2     3.30         4.42      4.54                 12 cm
 *     D3     3.30         4.56      4.54                −2 cm
 *
 * Yani geniş varil paleti gözüne fiziken giremiyordu. 2.80/4.90 ile pay
 * D3'te 38 cm, D2'de 52 cm.
 */
const B1_KATLAR = [0.00, 2.80, 4.90];
const b1 = (ada: number, kat: number): number => ada * B1_KATLAR.length + kat;

/**
 * Birinci bölümün her görevi aynı yoldan geçiyor: konveyörden rafa.
 *
 * `hedef` ortak `Task` alanı ve raf adresini taşımaya devam ediyor — genel
 * `Task` okuyan kod (dil dosyası, sonuç ekranı) değişmesin diye. Forklift
 * sahnesi ise artık `varis`e bakıyor.
 */
const konveyordenRafa = (ada: number, kat: number): Pick<ForkliftGorevi,
  'hedef' | 'kaynak' | 'varis'> => ({
  hedef: b1(ada, kat),
  kaynak: { tur: 'konveyor' },
  varis: { tur: 'raf', adres: b1(ada, kat) },
});

/**
 * Mal kabul — koridorun BATI ucunda, rafların önünde.
 *
 * Sıra sahadan gelen tarife göre: **makine → palet → raf.** Çatal doğuya
 * baktığı için hedefin de doğuda olması gerekiyor; önceki yerleşimde raf
 * makinenin batısında kalıyordu ve oyuncu rafa koymak için onun ÖNÜNDEN
 * GEÇİP arkasına dolanmak zorundaydı.
 */
const B1_GIRIS_X = 17.0;

/**
 * Beş görev, beş AYRI adres.
 *
 * Zorluk eğrisi kasıtlı ve ölçülebilir:
 *
 *   D1  A-Z  zemin,  6 m  — ısınma: sadece çatalı cebe sokmayı öğretiyor
 *   D2  B1   2.80 m, 12 m — ilk yükseklik; kapasite erimeye başlıyor
 *   D3  C1   2.80 m, 18 m — en uzak ada; geniş palet, yük merkezi uzuyor
 *   D4  A2   4.90 m,  6 m — en üst kat, ama geri dönüp en yakın adada
 *   D5  C2   4.90 m, 18 m — en ağır palet, en uzak adanın en üst katı
 *
 * Geniş varil paleti (yarı genişlik 0.88 m) bilerek orta katta: üst katta
 * ölçülen yük merkezi 0.95 m'ye çıkıyor, yükseklik çarpanı düşüyor ve ibre
 * %101 okuyordu — yani ideal bir operatör bile kırmızıya giriyordu.
 */
export const FORKLIFT_TASKS: readonly ForkliftGorevi[] = [
  {
    kod: 'D1', ad: 'Çimento paleti', tonnes: 1.29,
    halfWidth: 0.58, halfHeight: 0.42, kind: 'cimento', ...konveyordenRafa(0, 0),
    brif: 'A-Z, zemin gözü — ısınma turu: çatalı paletin cebine dibine kadar sok',
  },
  {
    kod: 'D2', ad: 'Fayans paleti', tonnes: 1.45,
    halfWidth: 0.60, halfHeight: 0.38, kind: 'fayans', ...konveyordenRafa(1, 1),
    brif: 'B1 — ikinci ada: kapasite tam burada erimeye başlıyor',
  },
  {
    kod: 'D3', ad: 'Boya varilleri', tonnes: 1.20,
    halfWidth: 0.88, halfHeight: 0.45, kind: 'varil', ...konveyordenRafa(2, 1),
    brif: 'C1 — geniş palet: çatal az girerse yük merkezi uzar, ibre tırmanır',
  },
  {
    kod: 'D4', ad: 'Yalıtım balyası', tonnes: 1.02,
    halfWidth: 0.95, halfHeight: 0.45, kind: 'balya', ...konveyordenRafa(0, 2),
    brif: 'A2 — bölümün en hafifi ama en genişi: ilk adaya geri dön',
  },
  {
    kod: 'D5', ad: 'Çelik profil', tonnes: 1.70,
    halfWidth: 0.52, halfHeight: 0.30, kind: 'profil', ...konveyordenRafa(2, 2),
    brif: 'C2 — bölümün en ağırı, en uzak adanın en üst katı',
  },
];

export const SEVKIYAT_KORIDORU: ForkliftBolum = {
  id: 'depo',
  adaX: B1_ADA_X,
  adaAdi: ['A', 'B', 'C'],
  katlar: B1_KATLAR,
  girisX: B1_GIRIS_X,
  teslimKotu: 3.6,
  // En geniş paletin (yarı en 0.95) batı yüzü 16.05'te; çizgi 15.75'te,
  // 30 cm pay. Görevden göreve değişmiyor ki zeminde boyanabilsin.
  beklemeCizgisi: B1_GIRIS_X - 1.25,
  bati: -12,
  dogu: 44,
  gorevler: FORKLIFT_TASKS,
  /**
   * Boş kalan dört adres (A1, B-Z, B2, C-Z) rastgele değil: depo dolu
   * dursun diye önceden stok konuyor. Oyuncunun hedefi olan gözler ise
   * BOŞ — dolu bir gözü hedef göstermek, sahada olmayan bir şey.
   */
  stok: [
    { hedef: b1(0, 1), kind: 'fayans', halfWidth: 0.62, halfHeight: 0.40 },
    { hedef: b1(1, 0), kind: 'cimento', halfWidth: 0.70, halfHeight: 0.44 },
    { hedef: b1(1, 2), kind: 'balya', halfWidth: 0.90, halfHeight: 0.42 },
    { hedef: b1(2, 0), kind: 'briket', halfWidth: 0.66, halfHeight: 0.46 },
  ],
  /**
   * Ölçülen tur: görev başına 25–52 s. Eşik 22/70'ten 30/95'e çıktı ve
   * sebebi bölümün kendisi: depo tek rafken her görev 7 metrelik bir
   * şeritte geçiyordu, şimdi en uzun tur 18 metre gidip 18 metre dönüyor.
   */
  hizEsikleri: { tam: 30, sifir: 95 },
  /** Küçük makine, dar koridor: vinçten belirgin biçimde daha yakın. */
  kameraOlcegi: { yakin: 46, uzak: 24 },
};
