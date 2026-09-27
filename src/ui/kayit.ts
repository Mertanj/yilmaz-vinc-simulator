import { TEST_SURUMU } from '../surum';

/**
 * `localStorage` sarmalayıcısı.
 *
 * Gizli sekmede ve site verisi kapalıyken `localStorage`'a erişmek istisna
 * fırlatıyor — okumak bile. Oyunun üç ayrı yerinde aynı try/catch kopyalanmıştı
 * (dil, seçilen araç, detay modu); en iyi skor dördüncüsü olacaktı. Tercihler
 * oyunun çalışması için gerekli değil, o yüzden hata sessizce yutuluyor:
 * kaydedilemeyen bir tercih, açılmayan bir oyundan iyidir.
 */

/**
 * Test sürümünün kayıtları ayrı önekte: oyunla aynı sitede yayınlanıyor ve
 * `localStorage` site başına ortak (bkz. `TEST_SURUMU`).
 */
const ONEK = TEST_SURUMU ? 'test.' : '';

export function oku(anahtar: string): string | null {
  try { return localStorage.getItem(ONEK + anahtar); } catch { return null; }
}

export function yaz(anahtar: string, deger: string): void {
  try { localStorage.setItem(ONEK + anahtar, deger); } catch { /* gizli sekme */ }
}

/** Bozuk/eski kayıt null döner — yarım JSON yüzünden oyun açılmasın. */
export function okuJson<T>(anahtar: string): T | null {
  const ham = oku(anahtar);
  if (ham === null) return null;
  try { return JSON.parse(ham) as T; } catch { return null; }
}

export function yazJson(anahtar: string, deger: unknown): void {
  try { yaz(anahtar, JSON.stringify(deger)); } catch { /* döngüsel nesne */ }
}
