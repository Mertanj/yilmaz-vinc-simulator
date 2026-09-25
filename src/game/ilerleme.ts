import { enIyiOku } from './enIyi';

/**
 * Bölüm ilerlemesi — hangi bölüm açık, hangi rekor hangi anahtarda.
 *
 * Sahadan gelen karar: *"sırayla açılsın."* Birinci bölümü bitiren ikinciyi
 * açıyor. Yeni oyuncu önce kolay olanla tanışıyor, zor bölümde takılıp oyunu
 * bırakmıyor.
 */

/** Rekor anahtarı için gereken en az bilgi. */
export interface BolumKimligi { aracId: string; bolumId: string; indeks: number }

/**
 * Bölümün rekor anahtarı.
 *
 * **İlk bölüm eski, araç başına anahtarı AYNEN kullanıyor.** Bölümler
 * gelmeden önce kayıt makine başınaydı ve oyuncuların (yerelde) duran
 * rekorları o anahtarda. Onları taşımak yerine ilk bölüme ait saymak hem
 * taşıma kodu gerektirmiyor hem de hiçbir kaydı riske atmıyor: o rekorlar
 * zaten ilk bölümde koşulmuştu. Sonraki bölümler kendi anahtarını alıyor.
 */
export function bolumAnahtari(k: BolumKimligi): string {
  return k.indeks === 0 ? k.aracId : `${k.aracId}.${k.bolumId}`;
}

/**
 * Test sürümü: `VITE_TEST=1` ile derlenen AYRI sayfa, bütün bölümler açık.
 *
 * Sahadan gelen istek: *"birinci bölümü oynamadan 2. bölümleri
 * deneyebileyim."* Oyuncunun oynadığı sürümde kilit duruyor — sıralı açılma
 * bir oyun kararı — ama yeni bölümü deneyen kişi her seferinde birinciyi
 * bitirmek zorunda kalmasın. Ayrı derleme, ayrı adres: oyundaki kilide bir
 * arka kapı açılmıyor. Kartlar zaten EN SON açık bölümü başlattığı için test
 * sayfasında kart ikinci bölüme, Tam Tur da üç ikinci bölüme gidiyor.
 *
 * `import.meta.env` Vite'ın; başsız testlerde (esbuild) tanımsız, `?.` ondan.
 */
export const TEST_SURUMU = import.meta.env?.VITE_TEST === '1';

/**
 * Makinenin kaç bölümü açık — **rekorlardan TÜRETİLİYOR, ayrıca saklanmıyor.**
 *
 * Rekor yalnız bitirilmiş, devrilmemiş turda yazılıyor (`enIyiKaydet`) ve
 * bir bölümün ilk bitirilişi her zaman rekordur. Yani "bu bölümün rekoru
 * var" ile "bu bölüm bitirildi" aynı şey. Ayrı bir açılma kaydı tutmak iki
 * kaynağı birbirinden koparabilirdi; türetince kopamıyor. Bir yan faydası
 * da var: bölümler gelmeden önce birinci bölümü bitirmiş oyuncuda ikinci
 * bölüm kendiliğinden açık geliyor.
 */
export function acikBolumSayisi(
  aracId: string, bolumIdleri: readonly string[], hepsiAcik = TEST_SURUMU,
): number {
  if (hepsiAcik) return Math.max(1, bolumIdleri.length);
  let acik = 1;
  for (let i = 0; i < bolumIdleri.length - 1; i++) {
    const bolumId = bolumIdleri[i];
    if (bolumId === undefined) break;
    if (!enIyiOku(bolumAnahtari({ aracId, bolumId, indeks: i }))) break;
    acik = i + 2;
  }
  return Math.min(acik, Math.max(1, bolumIdleri.length));
}

/**
 * Tam Tur rotasının rekor anahtarı.
 *
 * Tur, her makinenin EN SON açık bölümünü koşuyor; dolayısıyla iki oyuncunun
 * turu farklı bölümlerden geçebilir ve süreleri karşılaştırılamaz. Rekor bu
 * yüzden ROTAYA bağlı. Hepsi-birinci-bölüm rotası eski anahtarları koruyor
 * (`undefined` döner) — aynı gerekçe `bolumAnahtari`ndaki.
 */
export function rotaAnahtari(ayaklar: readonly BolumKimligi[]): string | undefined {
  if (ayaklar.every((a) => a.indeks === 0)) return undefined;
  return ayaklar.map((a) => `${a.aracId}.${a.bolumId}`).join('+');
}
