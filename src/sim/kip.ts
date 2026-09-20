import { oku, yaz } from '../ui/kayit';

/**
 * Simülasyon kipi — halatı kim yönetiyor?
 *
 * **Sahadan gelen istek:** *"bu halatı salman gerektiği konusunu birçok
 * arkadaşım yapamıyor. İnsanlar vinç operatörü olmadığı için anlamaları zor."*
 *
 * Teşhis önemli: bu bir ANLAMA sorunu değil. Oyun zaten söylüyor — teleskobu
 * kilitliyken açmaya kalkınca "İKİ BLOK · halatı sal" uyarısı çıkıyor.
 * Oyuncunun yapamadığı şey iki kolu AYNI ANDA tutup dengelemek; vinç
 * operatörü olmayan biri için zor olan kısım o. Bir öğretici bunu çözmez,
 * çünkü anlattığı şeyi yine iki elle yapmak gerekir.
 *
 * **Çözüm fiziği silmek değil, makineye bir özellik vermek.** Gerçek
 * vinçlerde bunun karşılığı var: teleskop hareket ederken vinç halatı kendi
 * salıp/sarıp kanca kotunu koruyor. `temel` kipte makine bunu yapıyor.
 *
 * Fizik hiçbir yerde bozulmuyor ve bu kasıtlı:
 *
 *  - Toplam halat modeli iki kipte de aynı; `temel`de telafiyi MAKİNE yapıyor.
 *  - İki-blok hâlâ var. Halat bittiğinde ya da oyuncu kancayı kafaya doğru
 *    sardığında kilit yine çalışıyor — yani mekanik, oyuncunun KENDİ
 *    hareketinden doğduğunda hâlâ görünür.
 *  - Yük tablosuna hiç dokunulmuyor. Teleskobu açmak yarıçapı büyütüyor,
 *    kapasite düşüyor; oyunun asıl gerilimi orada ve o hiç değişmiyor.
 *    Halat sadece tesisat.
 *
 * İleride bunun bir de bölüm tasarımı karşılığı var: elle halat takibi, level
 * tasarımı raporunun aradığı türden "yeni bir ders". Bugün oyuncu kaybettiğin
 * yer, ileri bir bölümde ilerleme basamağı olabilir.
 */
export type SimKipi =
  /** Vinç teleskop hareketini halatla telafi ediyor. */
  | 'temel'
  /** Halatı oyuncu yönetiyor — gerçek makine gibi. */
  | 'tam';

export const KIPLER: readonly SimKipi[] = ['temel', 'tam'];

const ANAHTAR = 'yv.kip';

/**
 * Oyuncunun seçtiği kip; hiç seçmediyse `temel`.
 *
 * **Varsayılanın yeri burası, makinenin içi değil.** `Crane` ve `Dirsekli`
 * kendi içlerinde `tam` ile doğuyor: bir simülasyon modülünün varsayılanı
 * "yardım açık" olmamalı, yazıldığı fizik olmalı. Ürünün varsayılanı ise
 * yeni bir oyuncuya göre seçiliyor ve o karar bu satırda duruyor. Başsız
 * rigler de bu yüzden hiçbir şey seçmeden `tam` ölçüyor.
 */
export function kipOku(): SimKipi {
  return oku(ANAHTAR) === 'tam' ? 'tam' : 'temel';
}

export function kipYaz(k: SimKipi): void {
  yaz(ANAHTAR, k);
}
