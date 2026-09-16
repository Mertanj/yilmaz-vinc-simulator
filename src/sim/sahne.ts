import type { Body, World } from 'planck';
import type { Snapshotter } from './world';
import type { Grabbable } from './crane';
import type { LmiReading } from './loadChart';
import type { Task } from '../game/tasks';
import type { SceneInput } from './scene';

/**
 * Bir aracın oynanabilir sahnesi.
 *
 * Vinç ve forklift aynı görev akışını, puanlamayı, kamerayı ve HUD kabuğunu
 * paylaşıyor; paylaşmadıkları şey MAKİNE. Arayüz tam olarak o sınırda duruyor:
 * `Mission` ve `main.ts` buradaki isimleri kullanıyor, makineye özgü her şey
 * (bom açısı, halat katı, direk yüksekliği, çatal eğimi) sahnenin kendi
 * `panelSatirlari()` ve `uyari()` çıktısından geçiyor.
 *
 * Böylece üçüncü aracı (dirsekli bom) eklemek `Mission`'a hiç dokunmuyor.
 */
export interface OyunSahnesi {
  readonly world: World;
  readonly snaps: Snapshotter;
  /** Malzeme alanındaki güncel yük. */
  readonly load: Body;
  readonly loadTask: Task | null;
  readonly grabbables: Grabbable[];
  /** Sert çarpışma sayısı — puanlamaya giriyor. */
  carpma: number;

  /** Kaldırma düzeneği çalışır durumda mı? Vinçte ayaklar açık demek. */
  readonly calismaModunda: boolean;
  /** Şasi eğimi (derece). Pozitif = burun aşağı. */
  readonly tiltDeg: number;
  /** Şasinin yatay hızı (m/s) — kamera buna göre öne bakıyor. */
  readonly sasiHizi: number;
  /** Kameranın en yakın ve en uzak ölçeği (piksel/metre). */
  readonly kameraOlcegi: { yakin: number; uzak: number };
  /** Yük momenti okuması — iki makinede de aynı anlamda. */
  readonly olcum: LmiReading;
  /** Yükü tutan nokta: vinçte kanca, forkliftte çatal. */
  readonly yukNoktasi: { x: number; y: number };
  /** Yük bağlı mı / çatalda mı? */
  readonly hasLoad: boolean;
  /** Salınım açısı (derece). Forkliftte sarkaç yok, sıfır döner. */
  salinimDeg(): number;

  /** Bu aracın bölümü. Görev listesi makineye ait: raf başka, teras başka. */
  readonly gorevler: readonly Task[];
  /**
   * Hız bonusunun eşikleri (s): bu süreden hızlı tam puan, bundan yavaş sıfır.
   *
   * Makineye ait, çünkü iki bölüm aynı uzunlukta değil. Vinçte bir yükü
   * yerine koymak ölçülen turda ~160 saniye; forkliftte ~30. Tek bir eşik
   * kullanınca forklift her görevde tam bonus alıyor ve puan bir şey
   * anlatmıyordu (başsız tur: 5/5, not A (99)).
   */
  readonly hizEsikleri: { tam: number; sifir: number };
  /** Görevin bırakma noktası — vinçte teras, forkliftte raf gözü. */
  hedefNoktasi(t: Task): { x: number; y: number } | null;
  /**
   * Yükün "kondu" sayılması için hedefe ne kadar yakın olması gerektiği (m).
   *
   * Makineye ait, çünkü hedefler aynı şey değil: teras geniş bir düzlem,
   * raf gözü ise paletten birkaç on santim büyük bir kutu.
   */
  yerlestirmeToleransi(t: Task): { x: number; y: number };
  /**
   * Makine kurtarılamayacak şekilde devrildi mi?
   *
   * Eşik makineye ait, çünkü aynı açı iki araçta aynı şeyi anlatmıyor:
   * vinçte 8° zaten kaza, forklift ise aşırı yükte burnunu çatalına dayayıp
   * 2° eğik duruyor ve oradan geri gelebiliyor.
   */
  readonly devrildiMi: boolean;

  step(input: SceneInput, dt: number): void;
  spawnLoad(spec: Task | null): void;

  /** HUD panelindeki etiket–değer satırları. */
  panelSatirlari(): PanelSatiri[];
  /** Panelin gösterge bloğu: yüzde, durum, çubuk. */
  gosterge(): Gosterge;
  /** Fizik sınırına dayanınca çıkacak uyarı; yoksa null. */
  uyari(): Uyari | null;
  /** Bir sonraki adımı söyleyen ipucu. */
  ipucu(): { metin: string; mod: 'drive' | 'crane' | 'ready' };
  /** Kameranın kadrajlaması gereken noktalar. */
  odakNoktalari(): Array<{ x: number; y: number }>;
}

export interface PanelSatiri {
  etiket: string;
  deger: string;
  /** Değeri renklendirir. */
  vurgu?: 'iyi' | 'uyari' | 'kotu';
}

export interface Gosterge {
  /** Panelin başlığı — makineye göre değişiyor. */
  baslik: string;
  /** Yüzde, ya da ölçülemiyorsa null. */
  yuzde: number | null;
  /** Tek kelimelik durum. */
  durum: string;
  zone: 'green' | 'amber' | 'red';
  /** Çubuğun dolan oranı, 0–1. */
  dolu: number;
  /** Panelin altındaki iki serbest satır. */
  altSatirlar: string[];
}

export interface Uyari {
  zone: 'red' | 'amber';
  bas: string;
  govde: string;
  cozum: string;
  /** Oyuncu şu an kilitli bir kola basıyor mu — şerit yanıp sönsün. */
  carpiyor: boolean;
}
