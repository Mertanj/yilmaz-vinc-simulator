/**
 * Süre biçimlendirme — tek yerde, çünkü ikisi de bir kez yanlış yazıldı.
 *
 * `sureyiYaz` bir kez "17:60" üretti: `(sn % 60).toFixed(0)` yukarı yuvarlıyor
 * ve dakikayı `Math.floor` verdiği için taşıma yok. Saat hiçbir zaman 60'ı
 * göstermemeli.
 *
 * `farkiYaz`ın işareti ise speedrun geleneğine bağlı ve tersine çevirmesi çok
 * kolay: EKSİ İYİ (rekordan öndesin). Ekranda yeşil/kırmızı olarak da
 * görünüyor, yani ters çevrilmesi sessiz değil ama oyuncuyu doğrudan yanıltan
 * bir hata olurdu.
 */

/** mm:ss. Saniye AŞAĞI yuvarlanıyor. */
export function sureyiYaz(sn: number): string {
  const t = Math.max(0, Math.floor(sn));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Fark satırı: metin ve "iyi mi" — `null` eşit demek. */
export interface Fark {
  metin: string;
  iyi: boolean | null;
}

/**
 * Rekora göre fark: `−0:12` öndesin, `+0:08` geridesin.
 *
 * Yarım saniyenin altı "eşit" sayılıyor: bir karelik gürültüyü fark diye
 * göstermek sayıya olan güveni bozar.
 */
export function farkiYaz(sn: number): Fark {
  if (!Number.isFinite(sn) || Math.abs(sn) < 0.5) return { metin: '±0:00', iyi: null };
  return { metin: `${sn < 0 ? '−' : '+'}${sureyiYaz(Math.abs(sn))}`, iyi: sn < 0 };
}
