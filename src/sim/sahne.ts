import type { Body, World } from 'planck';
import type { Snapshotter } from './world';
import type { Grabbable } from './crane';
import type { LmiReading } from './loadChart';
import type { Task } from '../game/tasks';
import type { SceneInput } from './scene';
import type { AttachReason } from './kanca';
import type { SimKipi } from './kip';
import { M } from '../ui/dil';

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
   * Hedef işaretinin ÇİZİLECEĞİ nokta; yoksa `hedefNoktasi` kullanılıyor.
   *
   * İkisi aynı olmak zorunda değil: forkliftte mantıksal hedef paletin
   * tabanı (raf kirişinin 36 cm üstü), oysa işaret kirişin kendisinde
   * durmalı — yoksa rafın ortasında havada asılı duruyor.
   */
  isaretNoktasi?(t: Task): { x: number; y: number } | null;
  /**
   * Makine kurtarılamayacak şekilde devrildi mi?
   *
   * Eşik makineye ait, çünkü aynı açı iki araçta aynı şeyi anlatmıyor:
   * vinçte 8° zaten kaza, forklift ise aşırı yükte burnunu çatalına dayayıp
   * 2° eğik duruyor ve oradan geri gelebiliyor.
   */
  readonly devrildiMi: boolean;

  /**
   * Simülasyon kipini uygular — halatı kim yönetiyor (bkz. `kip.ts`).
   *
   * İSTEĞE BAĞLI, çünkü her makinenin halatı yok: forkliftte yük çatalın
   * üstünde duruyor, telafi edilecek bir şey de yok. Arayüzü zorunlu yapmak
   * forklifte boş bir gövde yazdırırdı.
   */
  kipiSec?(k: SimKipi): void;

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
  /**
   * Sadece DETAY modunda görünsün mü?
   *
   * Sahadan gelen geri bildirim: *"şu an çok detaylı, oyuncular için fazla
   * olabilir."* Panel sekiz satırdı ve bir operatör panosu gibi duruyordu.
   * Oyuncunun anlık kararı için üç satır yetiyor: çatalda/kancada ne var,
   * sınır ne, ve payın ne kadar kaldı. Kot, eğim, hız, bom boyu — bunlar
   * makineyi zaten bilen birine hitap ediyor, `I` ile açılıyor.
   */
  detay?: boolean;
}

/**
 * İşaretli derece: `+3°`, `-2.6°`, `0°`.
 *
 * `toFixed` sıfıra yuvarlanan negatif sayılarda "-0" üretiyor. Panelde
 * "direk eğimi -0°" yazması, direğin öne yattığını — yani yükü düşürebilecek
 * bir durumu — söylüyor gibi duruyordu; oysa değer sıfır.
 */
export function imzaliDerece(deg: number, basamak = 0): string {
  const y = Number(deg.toFixed(basamak));
  return `${y > 0 ? '+' : ''}${y.toFixed(basamak)}°`;
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
  /**
   * Bu bir REDDİN cevabı mı, yoksa süregelen bir durum mu?
   *
   * Şerit ikisini de sarı gösteriyor ve göstermeli: oyuncu için ikisi de
   * "dikkat". Ses için ise aynı değiller — ret bir OLAY ve bir kez ötmesi
   * gerekiyor, yük momentinin sarıya girmesi ise bir DURUM ve kendi tekrarlı
   * uyarı tonu zaten var. Ayırmadan ikisi üst üste biniyordu.
   */
  ret?: boolean;
}


/**
 * Alma safhasının ipucu satırı — kategori yerine YÖN ve MESAFE.
 *
 * Oyun testinin en ağır bulgusu buydu: ilk yükü kancaya takmak 18 dakika
 * sürdü. Sebep fizik değildi — test eden kişi sonunda detay panelinden bom
 * boyunu ve açıyı okuyup kancanın kotunu ELDE hesapladı ve ikinci almayı
 * 15 saniyede yaptı. Yani beceri öğrenilebilir; öğrenmesi imkânsız olan şey
 * HANGİ YÖNE ne kadar gidileceğiydi. `baglanmaDenetimi` bunu zaten
 * hesaplıyordu ve atıyordu.
 *
 * **Sıra kasıtlı: önce yatay, sonra düşey.** `reason` zaten hangi eksenin
 * toleransı aştığını söylüyor, çünkü toleransları o biliyor; ikinci bir eşik
 * koymak aynı kararı iki yerde tutmak olurdu. `uzak` (ikisi de dışarıda) yatay
 * gösteriyor: önce yükün üstüne gelinir, sonra inilir — sapancının yaptığı da
 * bu.
 */
/**
 * Makinenin uzanabileceği en büyük yatay mesafe (m) için üst sınır.
 *
 * Bundan uzaktaki bir sapmayı metre metre bildirmek yalan söylemek oluyor:
 * oyun testinde dirsekli vinç, park cebi yerine yanlış yere sürüldüğünde
 * *"kancayı 89.8 m sola getir"* diyordu — 9 tonmetrelik, en fazla 8 metre
 * yarıçaplı bir makine için fiziksel olarak imkânsız bir talimat. Sapma bu
 * sınırın ötesindeyse söylenecek doğru şey yön değil, "önce doğru yere
 * yanaş"tır.
 */
const ERISIM_SINIRI_M = 26;

export function almaSatiri(
  reason: AttachReason,
  sapma: { dx: number; dy: number } | null,
  varsayilan: string,
  cokUzak?: string,
): string {
  if (!sapma) return varsayilan;
  const i = M.vinc.ipucu;
  if (cokUzak && Math.abs(sapma.dx) > ERISIM_SINIRI_M) return cokUzak;
  if (reason === 'ortala' || reason === 'uzak') {
    return i.sapmaYatay(Math.abs(sapma.dx).toFixed(1), sapma.dx > 0);
  }
  if (reason === 'yukseklik') {
    return i.sapmaDusey(Math.abs(sapma.dy).toFixed(1), sapma.dy > 0);
  }
  return varsayilan;
}

/**
 * Taşıma safhasının ipucu satırı — hedefe kalan yön ve mesafe.
 *
 * Almanın aynadaki hâli: yük bağlıyken satır bütün uçuş boyunca tek bir sabit
 * cümleydi ("yük bağlı · bırak"). Oyuncu hedef işaretini gözle kollamak
 * zorundaydı ve iki kez yükü salınırken bıraktı.
 *
 * Aşamalı: önce yatay, hedefin üstüne gelince kalan iniş, tolerans içinde ise
 * null (çağıran kendi "bırak" satırını gösteriyor).
 */
export function tasimaSatiri(
  yuk: { x: number; y: number },
  hedef: { x: number; y: number },
  tol: { x: number; y: number },
): string | null {
  const i = M.vinc.ipucu;
  const dx = hedef.x - yuk.x;
  if (Math.abs(dx) > tol.x) return i.hedefeYatay(Math.abs(dx).toFixed(1), dx > 0);
  const dy = yuk.y - hedef.y;
  if (dy > tol.y) return i.hedefeIndir(dy.toFixed(1));
  return null;
}
