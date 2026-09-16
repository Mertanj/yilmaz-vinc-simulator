import { okuJson, yazJson } from '../ui/kayit';
import type { Result } from './mission';

/**
 * Araç başına en iyi derece.
 *
 * Neden araç başına ve neden puan: iki bölüm aynı oyunu oynamıyor — vinçte
 * 833 saniye iyi bir süre, forkliftte 208. Ortak bir tabloya koymak ikisini de
 * yanlış anlatırdı. Puan zaten bölümün kendi içinde normalize: her yerleştirme
 * aynı tavandan pay alıyor.
 *
 * Kayıt bölüm BİTİNCE yazılıyor, yarıda bırakılınca değil. Devrilen tur da
 * sayılıyor — o da bir sonuç, ve zaten rekor kıracak kadar yüksek çıkmıyor.
 */
export interface EnIyi {
  puan: number;
  not: Result['not'];
  /** Saniye. */
  sure: number;
  tamamlanan: number;
  usta: boolean;
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
  const yeni: EnIyi = {
    puan: sonuc.score.puan,
    not: sonuc.not,
    sure: sonuc.score.sure,
    tamamlanan: sonuc.score.sapmalar.length,
    usta: sonuc.usta,
  };
  const rekor = onceki === null || yeni.puan > onceki.puan;
  if (rekor) yazJson(ONEK + aracId, yeni);
  return { rekor, onceki };
}
