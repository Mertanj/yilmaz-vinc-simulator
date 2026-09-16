/**
 * `localStorage` sarmalayıcısı.
 *
 * Gizli sekmede ve site verisi kapalıyken `localStorage`'a erişmek istisna
 * fırlatıyor — okumak bile. Oyunun üç ayrı yerinde aynı try/catch kopyalanmıştı
 * (dil, seçilen araç, detay modu); en iyi skor dördüncüsü olacaktı. Tercihler
 * oyunun çalışması için gerekli değil, o yüzden hata sessizce yutuluyor:
 * kaydedilemeyen bir tercih, açılmayan bir oyundan iyidir.
 */
export function oku(anahtar: string): string | null {
  try { return localStorage.getItem(anahtar); } catch { return null; }
}

export function yaz(anahtar: string, deger: string): void {
  try { localStorage.setItem(anahtar, deger); } catch { /* gizli sekme */ }
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
