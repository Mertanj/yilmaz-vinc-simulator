import type { Body, World } from 'planck';
import type { Task } from '../game/tasks';

/**
 * Dirsekli vincin bir BÖLÜMÜ — makineden ayrı, sahneden ayrı.
 *
 * `DirsekliSahne` bugüne kadar tek bir bölümü (`avlu.ts`, "Dar Sokak") sabit
 * import ediyordu: dünya gövdeleri, kamyonun doğduğu yer, malzeme alanı, görev
 * listesi, hedefler, kamera ölçeği ve o bölüme özgü ipuçları hepsi sınıfın
 * içine gömülüydü. İkinci bölüm için elde iki yol vardı: 397 satırlık fizik
 * sınıfını kopyalamak ya da bölümü VERİYE çevirmek.
 *
 * Kopyalama bu depoda bir kez denendi ve bedeli ölçüldü — görev metinleri hem
 * `dil.ts`'te hem veri dosyasında duruyordu, ikisi sessizce ayrıştı ve oyuncu
 * kırma vinç bölümünde forkliftin brifingini okudu. Aynı hatayı fizik
 * kablolamasında tekrarlamak çok daha pahalı olurdu.
 *
 * **Sınır tam olarak nerede:** burada bölüme AİT olan şeyler var — nerede
 * çalışıldığı, neyin taşındığı, neyin aşılacağı. Makineye ait olan hiçbir şey
 * yok: eklem sınırları, moment tablosu, kanca, teleskop hepsi `dirsekli.ts`'te
 * kalıyor. `OyunSahnesi` arayüzü de değişmiyor; `Mission` bu dosyayı hiç
 * görmüyor.
 */
export interface DirsekliBolum {
  /** En iyi derece kaydının anahtarı. Araç değil BÖLÜM başına tutuluyor. */
  readonly id: string;

  /** Bölümün fizik gövdeleri — zemin ve kamyon dışında her şey. */
  kur(world: World): void;

  /** Kamyonun doğduğu x. */
  readonly spawnX: number;
  /** Her görevin yükünün doğduğu x. */
  readonly malzemeX: number;

  readonly gorevler: readonly Task[];
  /**
   * Görevin bırakma noktası (yükün TABANI).
   *
   * `baglam` kasa bölümünde gerekiyor: hedef kamyonun ÜSTÜNDE, yani şasiyle
   * birlikte duruyor, ve her yük bir öncekinin GERÇEK yerine dayanıyor.
   */
  hedefNoktasi(t: Task, baglam?: DirsekliBaglam): { x: number; y: number } | null;

  /**
   * Kolonun şasi yerel x'i. Yoksa kasanın en arkası (`DIRSEKLI.pivot`).
   *
   * Kasa yükleme bölümünde kolon KABİNİN ARKASINDA: bom yalnız kuyruğa doğru
   * çalışıyor (döner tabla yok) ve arkaya monteli bir kolon kendi kasasına
   * hiç erişemiyor — kasa onun öbür tarafında kalıyor.
   */
  readonly montajX?: number;
  /**
   * Yüklenecek kasa, şasi yerel x'inde: ön duvarın yüzü ve kuyruk. Varsa
   * sahne kasa tabanını ve ön duvarı şasiye ekliyor.
   */
  readonly kasa?: { on: number; arka: number };
  /**
   * Malzemenin KAMYONA göre yeri (şasi yerel x). Varsa yük, makine ayaklarını
   * açınca buraya konuyor — depo forklifti paleti vincin erişeceği yere
   * bırakıyor. Sabit bir yer park hassasiyetini cezalandırırdı: fiziksel
   * takoz yok (bkz. `AVLU.parkX`), yarım metre fazla geri giden kamyonun arka
   * pabucu paletin yerine basardı.
   */
  readonly malzemeYerel?: number;
  /** Konan yük sahnede kalıyor mu — kasa bölümünde şasiye kaynıyor. */
  readonly kalici?: boolean;
  /**
   * Park cebi (şasi merkezi x'i ve payı). Varsa forklift paleti ANCAK kamyon
   * bunun içindeyken getiriyor: cebin beş metre gerisine kurulan kamyonun
   * paleti deponun bekleme sırasının içine düşüyordu.
   */
  readonly park?: { x: number; payM: number };
  /** Sırası gelmemiş yüklerin depodaki yeri (dünya x) — yalnız çizim. */
  bekleyenX?(sira: number): number;
  /**
   * Yükün "kondu" sayılması için hedefe ne kadar yakın olması gerektiği (m).
   *
   * Bölüme ait, makineye değil: dar bir avluda 2 metrelik bir pencere bütün
   * sahneyi kaplardı, geniş bir şantiyede ise 1.1 metre fazla cömert olurdu.
   */
  yerlestirmeToleransi(t: Task): { x: number; y: number };

  /**
   * Hız bonusunun eşikleri (s). Bölüme ait çünkü bölümler aynı uzunlukta
   * değil — yük 7.2 metre tırmanıyorsa bir görev 90–321 saniye sürüyor.
   */
  readonly hizEsikleri: { tam: number; sifir: number };
  /** Kameranın en yakın ve en uzak ölçeği (piksel/metre). */
  readonly kameraOlcegi: { yakin: number; uzak: number };

  /**
   * Bölüme özgü SÜRÜŞ ipucu — park penceresi gibi. null dönerse sahne kendi
   * genel ipucunu veriyor.
   */
  surusIpucu?(sasiX: number): BolumIpucu | null;
  /**
   * Bölüme özgü TAŞIMA ipucu — aşılacak engel gibi. null dönerse sahne kendi
   * genel ipucunu veriyor.
   */
  tasimaIpucu?(yuk: { x: number; y: number; yariBoy: number }): BolumIpucu | null;
}

/**
 * Kasa tahtasının kalınlığı (m) — şasi kutusunun üstünde. Çizimdeki
 * `deckShade` bandıyla aynı: yük tahtanın içine gömülü görünmesin.
 */
export const KASA_TABANI = 0.14;
/** Kasanın ön duvarının kasa tabanından yüksekliği (m). */
export const KASA_ON_DUVAR = 1.0;

/** Kasa hedefinin bağlamı: kamyonun şasisi ve konmuş yüklerin gerçek yerleri. */
export interface DirsekliBaglam {
  sasi: Body;
  konanlar: ReadonlyMap<string, { x: number; y: number; hw: number; hh: number }>;
}

export interface BolumIpucu {
  metin: string;
  mod: 'drive' | 'crane' | 'ready';
}
