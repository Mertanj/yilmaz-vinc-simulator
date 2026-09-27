/**
 * Hangi sürüm derleniyor: oyuncunun oynadığı mı, test sayfası mı?
 *
 * Test sürümü `VITE_TEST=1` ile derleniyor: bütün bölümler açık (bkz.
 * `acikBolumSayisi`) ve kayıtları ayrı bir önekte (bkz. `kayit.ts`). Oyunla
 * AYNI sitede, `/test/` alt adresinde yayınlanıyor — hesap istemeyen,
 * mesajla gönderilebilen bir link. Aynı site aynı `localStorage` demek;
 * önek olmasa test sayfasında bitirilen bölüm oyunda da kilit açardı.
 *
 * `import.meta.env` Vite'ın; başsız testlerde (esbuild) tanımsız, `?.` ondan.
 */
export const TEST_SURUMU = import.meta.env?.VITE_TEST === '1';
