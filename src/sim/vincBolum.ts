import type { World } from 'planck';
import type { Task } from '../game/tasks';

/**
 * Teleskopik vincin bir BÖLÜMÜ — makineden ayrı, sahneden ayrı.
 *
 * Forkliftte (`ForkliftBolum`) ve dirsekli vinçte (`DirsekliBolum`) bu ayrım
 * zaten vardı ve gerekçe burada da aynı: ikinci bir şantiye için ya 570
 * satırlık sahne sınıfını kopyalayacaktık ya da bölümü VERİYE çevirecektik.
 * Kopyalamanın bedeli bu depoda bir kez ölçüldü (görev metinleri iki yerde
 * durdu ve sessizce ayrıştı); fizik kablolamasında aynı hata çok daha pahalı
 * olurdu.
 *
 * **Sınır tam olarak nerede:** burada bölüme AİT olan şeyler var — nerede
 * park edildiği, yükün nereden gelip nereye gittiği, neyin aşılacağı. Makineye
 * ait hiçbir şey yok: bom, yük tablosu, halat, kanca, ayaklar `crane.ts` ve
 * `outriggers.ts`'te kalıyor.
 */
export interface VincBolum {
  /** En iyi derece kaydının anahtarı. Araç değil BÖLÜM başına tutuluyor. */
  readonly id: string;

  /** Bölümün statik gövdeleri — zemin, vinç kamyonu ve takoz dışında her şey. */
  kur(world: World): void;

  /** Takozun x'i: vinç kamyonunu park yerinde durduran beton blok. */
  readonly kerbX: number;
  /** Kurulum alanının merkezi ve yarı eni — çizim de ipucu da buradan okuyor. */
  readonly setupX: number;
  readonly setupYariEn: number;

  readonly gorevler: readonly Task[];

  /** Görevin yükünün DOĞDUĞU yer (gövde merkezi). */
  yukYeri(t: Task): { x: number; y: number };

  /**
   * Konan yük sahnede KALIYOR mu, ve sırası gelmemiş yükler baştan beri
   * fizikte mi?
   *
   * Sanayi sitesinde hayır: yükler malzeme alanına tek tek geliyor ve iki
   * görev AYNI terasa gidiyor — ilk yük orada kalsa ikincinin yerini
   * kapatırdı. Şantiyede evet: kamyon beş yükle geliyor, her biri kasada
   * kendi yerinde duruyor ve sahaya inen yük orada kalıyor; bir sonraki
   * yük onun üstüne istifleniyor.
   */
  readonly kalici: boolean;

  /**
   * Görevin bırakma noktası (yükün TABANI).
   *
   * `konanlar` daha önce konmuş yüklerin GERÇEK yerleri (görev kodu → gövde).
   * İstif hedefi alttaki yükün hayal edilen değil, bırakıldığı yerden
   * hesaplanıyor — forklift dorsesindeki sıkı yüklemenin aynı kuralı.
   */
  hedefNoktasi(t: Task, konanlar: ReadonlyMap<string, KonanYuk>):
    { x: number; y: number } | null;
  yerlestirmeToleransi(t: Task): { x: number; y: number };

  /**
   * Bölüme özgü TAŞIMA ipucu — aşılacak engel gibi. `null` dönerse sahne
   * kendi genel yön satırını veriyor.
   */
  tasimaIpucu?(yuk: { x: number; y: number; yariEn: number; yariBoy: number }): string | null;

  /** Hız bonusunun eşikleri (s) — bölümler aynı uzunlukta değil. */
  readonly hizEsikleri: { tam: number; sifir: number };
  /** Kameranın en yakın ve en uzak ölçeği (piksel/metre). */
  readonly kameraOlcegi: { yakin: number; uzak: number };
}

/** Yerine konmuş bir yük: merkez ve yarı ölçüler. */
export interface KonanYuk {
  x: number;
  y: number;
  hw: number;
  hh: number;
}
