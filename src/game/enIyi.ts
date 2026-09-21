import { okuJson, yazJson } from '../ui/kayit';
import type { Result } from './mission';
import type { TurSonucu } from './tamTur';

/**
 * Araç başına en iyi derece.
 *
 * Neden araç başına ve neden puan: iki bölüm aynı oyunu oynamıyor — vinçte
 * 833 saniye iyi bir süre, forkliftte 208. Ortak bir tabloya koymak ikisini de
 * yanlış anlatırdı. Puan zaten bölümün kendi içinde normalize: her yerleştirme
 * aynı tavandan pay alıyor.
 *
 * Kayıt bölüm BİTİNCE yazılıyor, yarıda bırakılınca değil. Devrilen tur ise
 * kayda HİÇ girmiyor — sebebi aşağıda, `enIyiKaydet` içinde.
 */
export interface EnIyi {
  puan: number;
  not: Result['not'];
  /** Saniye. */
  sure: number;
  tamamlanan: number;
  usta: boolean;
  /**
   * Rekor turun ara süreleri (s, kümülatif) — bir sonraki tur bunlara karşı
   * koşuyor. Eski kayıtlarda yok; okuyan taraf boş diziyle karşılaşabilir.
   */
  bitisler: number[];
}

const ONEK = 'yv.enIyi.';

export function enIyiOku(aracId: string): EnIyi | null {
  const k = okuJson<Partial<EnIyi>>(ONEK + aracId);
  // Elle kurcalanmış ya da eski sürümden kalmış kayıt oyunu bozmasın.
  if (!k || typeof k.puan !== 'number' || !Number.isFinite(k.puan)) return null;
  return {
    puan: k.puan,
    not: k.not ?? 'D',
    sure: typeof k.sure === 'number' ? k.sure : 0,
    tamamlanan: typeof k.tamamlanan === 'number' ? k.tamamlanan : 0,
    usta: k.usta === true,
    // Eski sürüm kayıtlarında yok; dizi olmayan her şey boş sayılıyor.
    bitisler: Array.isArray(k.bitisler) ? k.bitisler.filter(
      (x): x is number => typeof x === 'number' && Number.isFinite(x)) : [],
  };
}

/**
 * Sonucu kaydeder ve rekor kırılıp kırılmadığını söyler.
 *
 * Karşılaştırmayı ve yazmayı birlikte yapıyor çünkü ikisi arasında başka bir
 * şeyin araya girmesi anlamsız; çağıran taraf da zaten "yeni rekor mu?" diye
 * soruyor. Önceki kayıt da dönüyor, sonuç paneli "önceki en iyi" yazabilsin.
 */
export function enIyiKaydet(
  aracId: string, sonuc: Result,
): { rekor: boolean; onceki: EnIyi | null } {
  const onceki = enIyiOku(aracId);
  // **Başarısız tur rekor değildir.** Sahadan gelen hata buydu: vinç bölümünde
  // makine devrildi, puan 0, not D — ve sonuç ekranı "YENİ REKOR" yazdı. Kusur
  // karşılaştırmadaydı: önceki kayıt yoksa her sonuç rekor sayılıyordu, yani
  // oyuncunun gördüğü İLK tur ne olursa olsun kutlanıyordu. Devrilen turu
  // kaydetmiyoruz da: kaydedilseydi bir sonraki turun "önceki en iyi" satırı
  // 0 puan gösterir, yani yine yalan söylerdi.
  if (sonuc.devrildi || sonuc.score.puan <= 0) return { rekor: false, onceki };
  const yeni: EnIyi = {
    puan: sonuc.score.puan,
    not: sonuc.not,
    sure: sonuc.score.sure,
    tamamlanan: sonuc.score.sapmalar.length,
    usta: sonuc.usta,
    bitisler: [...sonuc.score.bitisler],
  };
  const rekor = onceki === null || yeni.puan > onceki.puan;
  if (rekor) yazJson(ONEK + aracId, yeni);
  return { rekor, onceki };
}

/**
 * Tam Tur rekoru.
 *
 * Araç başına kayıttan AYRI tutuluyor ve sebebi ölçü: bölüm kaydı "bu makineyi
 * ne kadar iyi kullanıyorum", tur kaydı "bu oyunu ne kadar hızlı ve ne kadar
 * temiz bitiriyorum" diye soruyor.
 *
 * **İKİ rekor var ve ikisi de tam bir tur.** Sahadan gelen istek buydu:
 * *"tur rekorunun ölçütü hem süre hem skor olsun."* Haklı, çünkü ikisi aynı
 * oyunu ödüllendirmiyor — hızlı koşmak isabetten ve kırmızıdan puan
 * kaybettiriyor, temiz koşmak süre kaybettiriyor. Tek bir rekor tutmak
 * oyuncunun iki hedeften birini seçmesini zorunlu kılardı; speedrun
 * tablolarında da bu yüzden birden fazla kategori olur.
 *
 * Ara süreler HIZ rekoruna karşı koşuyor: ara süre zaten bir zaman ölçüsü.
 */
export interface TurEnIyi {
  sure: number;
  not: TurSonucu['not'];
  puan: number;
  tamamlanan: number;
  gorevSayisi: number;
  usta: boolean;
  /** Bacakların kümülatif bitiş anları (s) — bir sonraki tur bunlara koşuyor. */
  bitisler: number[];
}

/** İki kategori: en hızlı tur ve en yüksek puanlı tur. */
export interface TurRekorlari {
  hiz: TurEnIyi | null;
  puan: TurEnIyi | null;
}

const TUR_HIZ = 'yv.enIyi.tamtur.hiz';
const TUR_PUAN = 'yv.enIyi.tamtur.puan';
/** Tek rekorlu ilk sürümün anahtarı — bir kez okunup ikisine de taşınıyor. */
const TUR_ESKI = 'yv.enIyi.tamtur';

function turOku(anahtar: string): TurEnIyi | null {
  const k = okuJson<Partial<TurEnIyi>>(anahtar);
  if (!k || typeof k.sure !== 'number' || !Number.isFinite(k.sure) || k.sure <= 0) {
    return null;
  }
  return {
    sure: k.sure,
    not: k.not ?? 'D',
    puan: typeof k.puan === 'number' ? k.puan : 0,
    tamamlanan: typeof k.tamamlanan === 'number' ? k.tamamlanan : 0,
    gorevSayisi: typeof k.gorevSayisi === 'number' ? k.gorevSayisi : 0,
    usta: k.usta === true,
    bitisler: Array.isArray(k.bitisler) ? k.bitisler.filter(
      (x): x is number => typeof x === 'number' && Number.isFinite(x)) : [],
  };
}

export function turEnIyiOku(): TurRekorlari {
  const eski = turOku(TUR_ESKI);
  // Tek rekorlu sürümden kalan kayıt iki kategoriye de tohum oluyor: oyuncunun
  // koştuğu turu silmek, kaydı şekil değiştirdi diye cezalandırmak olurdu.
  return {
    hiz: turOku(TUR_HIZ) ?? eski,
    puan: turOku(TUR_PUAN) ?? eski,
  };
}

function yaz1(anahtar: string, s: TurSonucu): void {
  yazJson(anahtar, {
    sure: s.sure, not: s.not, puan: s.puan,
    tamamlanan: s.tamamlanan, gorevSayisi: s.gorevSayisi, usta: s.usta,
    bitisler: s.bacaklar.map((b) => b.bitis),
  });
}

/**
 * Tur sonucunu kaydeder ve hangi rekorların kırıldığını söyler.
 *
 * **Yalnız TAM turlar kaydediliyor.** Devrilen tur zaten baştan başlıyor
 * (speedrun kuralı), terk edilen tur ise hiç bitmedi — ikisi de kayda
 * girmemeli, aynı gerekçeyle yarıda bırakılan bölüm de girmiyor.
 */
export function turEnIyiKaydet(
  s: TurSonucu,
): { hizRekoru: boolean; puanRekoru: boolean; onceki: TurRekorlari } {
  const onceki = turEnIyiOku();
  const tamKadro = s.gorevSayisi > 0 && s.tamamlanan === s.gorevSayisi;
  if (!tamKadro) return { hizRekoru: false, puanRekoru: false, onceki };
  const hizRekoru = onceki.hiz === null || s.sure < onceki.hiz.sure;
  const puanRekoru = onceki.puan === null || s.puan > onceki.puan.puan;
  if (hizRekoru) yaz1(TUR_HIZ, s);
  if (puanRekoru) yaz1(TUR_PUAN, s);
  return { hizRekoru, puanRekoru, onceki };
}
