/**
 * Reddedilen bir komutun kısa ömürlü cevabı.
 *
 * Uyarı şeridi süregelen DURUMLARI anlatıyor: yük ağır, yarıçap uzun, kanca
 * kafaya dayandı. Ret ise bir OLAY — oyuncu düğmeye bastı ve makine yapmadı.
 * İkisi aynı yerde görünüyor ama aynı ömre sahip değiller; olayın kendisi bir
 * kare sürüyor, cevabının ise okunacak kadar durması gerekiyor. Kendi sayacı
 * olmasaydı cevap basıldığı karede kaybolurdu.
 *
 * Sebep: sahadan gelen *"halat katı düğmesini anlamadım"* geri bildirimi.
 * Makine haklı olarak reddediyordu, gerekçeyi de hesaplıyordu — ve gerekçe
 * hiçbir yerde okunmadan çöpe gidiyordu. Oyuncunun gördüğü tek şey hiçbir şey
 * olmamasıydı, o da bunu "düğme bozuk" diye okudu.
 */
export interface RetMesaji {
  bas: string;
  govde: string;
  cozum: string;
}

export class Ret {
  /** Saniye — okunacak kadar uzun, asıl uyarının önünü kesecek kadar değil. */
  static readonly SURE = 3.5;

  private kalan = 0;
  private mesaj: RetMesaji | null = null;

  /** Komut reddedildi; gerekçeyi şerit için sakla. */
  yaz(mesaj: RetMesaji): void {
    this.mesaj = mesaj;
    this.kalan = Ret.SURE;
  }

  /** Komut kabul edildi; duran cevap varsa kaldır. */
  temizle(): void {
    this.mesaj = null;
    this.kalan = 0;
  }

  /** Her fizik adımında bir kez. */
  azalt(dt: number): void {
    if (this.kalan <= 0) return;
    this.kalan -= dt;
    if (this.kalan <= 0) this.temizle();
  }

  /** Gösterilecek cevap; yoksa null. */
  get aktif(): RetMesaji | null { return this.kalan > 0 ? this.mesaj : null; }
}
