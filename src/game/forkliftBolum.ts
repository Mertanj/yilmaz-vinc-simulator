import type { Task } from './tasks';

/**
 * Forkliftin bir BÖLÜMÜ — makineden ayrı, sahneden ayrı.
 *
 * Dirsekli vinçte bu ayrım zaten vardı (`DirsekliBolum`) ve aynı gerekçe
 * burada da geçerli: ikinci bir depo için elde iki yol vardı — fizik ve
 * çizim kablolamasını kopyalamak ya da bölümü VERİYE çevirmek. Kopyalama bu
 * depoda bir kez denendi ve bedeli ölçüldü: görev metinleri hem `dil.ts`'te
 * hem veri dosyasında durdu, ikisi sessizce ayrıştı ve oyuncu kırma vinç
 * bölümünde forkliftin brifingini okudu.
 *
 * **Sınır tam olarak nerede:** burada bölüme AİT olan şeyler var — raflar
 * nerede, kaç kat, mal nereden geliyor, depo nerede bitiyor, hangi gözler
 * dolu. Makineye ait hiçbir şey yok: bıçak boyu, yük tablosu, kaldırma
 * hızı, palet cebi hepsi `forklift.ts`'te kalıyor. Paletin ayak yüksekliği
 * de burada değil — o paletin özelliği, deponun değil, ve her depoda aynı.
 */
export interface ForkliftBolum {
  /** En iyi derece kaydının anahtarı. Araç değil BÖLÜM başına tutuluyor. */
  readonly id: string;

  /**
   * Raf adalarının ön yüzleri (m), batıdan doğuya sıralı.
   *
   * Her adanın BATISINDA kendi koridoru var. Aralık en az 3.4 metre olmalı:
   * makinenin çatalı şasinin 2.5 metre önünde, dolayısıyla bırakma
   * noktasının 2 metre batısı boş olmak zorunda.
   */
  readonly adaX: readonly number[];
  /** Adaların adı — depo adreslerinde gerçekten harf kullanılır. */
  readonly adaAdi: readonly string[];
  /**
   * Kat kotları (m). **Sıfır bir kat DEĞİL, zemindir** — o gözün kirişi yok.
   *
   * Kotlar GÖZE GİRERKENKİ paya göre seçilmeli, oturduktan sonrakine göre
   * değil: palet göze ayaklarıyla oturuyor, yani girerken çatal `PALET_AYAK`
   * kadar yukarıda. Bir kez oturmuş palete göre seçildi ve en geniş palet
   * gözüne iki santim kirişin içinden girmek zorunda kaldı.
   */
  readonly katlar: readonly number[];

  /** Mal kabul konveyörünün x'i — paletler buraya iniyor. */
  readonly girisX: number;
  /** Paletin indiği kot (m). */
  readonly teslimKotu: number;
  /**
   * Bekleme çizgisi (m) — paletin inebilmesi için çatal ucunun batısında
   * kalması gereken x. Zeminde boyalı duruyor; göremediği bir kural, kural
   * değil.
   */
  readonly beklemeCizgisi: number;

  /** Deponun iki ucu (m) — duvarlar ve kamera sınırı buradan. */
  readonly bati: number;
  readonly dogu: number;

  readonly gorevler: readonly Task[];
  /** Bölüm başlamadan önce raflarda duran mal. Tamamen dekor. */
  readonly stok: readonly RafStogu[];

  /**
   * Hız bonusunun eşikleri (s). Bölüme ait çünkü bölümler aynı uzunlukta
   * değil — üç adaya yayılmış bir depoda en uzun görev 18 metre gidip 18
   * metre dönüyor.
   */
  readonly hizEsikleri: { tam: number; sifir: number };
  readonly kameraOlcegi: { yakin: number; uzak: number };
}

export interface RafStogu {
  hedef: number;
  kind: Task['kind'];
  halfWidth: number;
  halfHeight: number;
}

/** Bir raf adresi: hangi ada, hangi kat. */
export interface RafAdresi { ada: number; kat: number; }

/**
 * Bütün adresler, ada-önce sırayla. `Task.hedef` bunun indeksi.
 *
 * `Task` üç makinede ortak ve `hedef` orada tek bir sayı; adresi sayıya
 * çevirmek yerine üçüncü bir alan eklemek üç bölümü birden ilgilendirirdi.
 */
export function adresler(b: ForkliftBolum): RafAdresi[] {
  return b.adaX.flatMap((_, ada) => b.katlar.map((_k, kat) => ({ ada, kat })));
}

/** Adanın ve katın indeksinden `Task.hedef` değeri. */
export function adresIndeksi(b: ForkliftBolum, ada: number, kat: number): number {
  return ada * b.katlar.length + kat;
}

export function adres(b: ForkliftBolum, i: number): RafAdresi | undefined {
  const ada = Math.floor(i / b.katlar.length);
  const kat = i % b.katlar.length;
  return ada < b.adaX.length && kat >= 0 && i >= 0 ? { ada, kat } : undefined;
}

/**
 * Adresin adı — ada harfi + kat numarası.
 *
 * Zemin gözü "A0" değil "A-Z": rafta zemin gözünün numarası olmaz, çünkü o
 * bir kat değil. Oyuncunun brifingte okuduğu ad ile rafın üstünde boyalı
 * duran ad AYNI dizeden geliyor — ikisi ayrı yerde yazıldığında sessizce
 * ayrışıyor ve oyuncu yanlış gözün önünde bekliyor.
 */
export function katAdi(b: ForkliftBolum, i: number): string {
  const a = adres(b, i);
  if (!a) return '?';
  const harf = b.adaAdi[a.ada] ?? '?';
  return a.kat === 0 ? `${harf}-Z` : `${harf}${a.kat}`;
}

/** Adresin kotu (m) — zemin gözünde 0. */
export function adresKotu(b: ForkliftBolum, i: number): number | undefined {
  const a = adres(b, i);
  return a === undefined ? undefined : b.katlar[a.kat];
}

/** Adresin ada ön yüzü (m). */
export function adresX(b: ForkliftBolum, i: number): number | undefined {
  const a = adres(b, i);
  return a === undefined ? undefined : b.adaX[a.ada];
}
