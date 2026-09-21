import { GOREV_MAX, type Result } from './mission';

/**
 * **Tam Tur** — üç makine arka arkaya, tek saat.
 *
 * Sahadan gelen cümle bu oyunun kimliğini tarif ediyordu: *"oyunun güzelliği
 * hepsini arka arkaya speed run şeklinde yapabilmek."* Oyun bunu yapamıyordu:
 * üç ayrı bölüm vardı, her biri kendi saatiyle, aralarında seçim ekranı. Yani
 * kimlik tarif edilmişti ama hiçbir yerde KURULU değildi.
 *
 * Tam Tur o kurulum. Üç bölüm kesintisiz akıyor, saat hiç durmuyor, sonunda
 * tek bir toplam süre ve tek bir not çıkıyor. Bölüm başına kayıtlar yerinde
 * duruyor — biri "bu makineyi ne kadar iyi kullanıyorum", diğeri "bu oyunu ne
 * kadar hızlı bitirebiliyorum" sorusunu ölçüyor ve ikisi ayrı sorular.
 */

/**
 * Sıra SABİT ve bu bilerek: speedrun süreleri ancak aynı yolu koşanlar
 * arasında karşılaştırılabilir. Oyuncuya sıra seçtirmek her turu kendi
 * kategorisi yapardı.
 *
 * Diziliş küçükten büyüğe — forklift (depo, 2 yıldız) → dirsekli (dar sokak,
 * 2 yıldız) → vinç (sanayi sitesi, 3 yıldız). Hem zorluk hem de makinenin
 * kendisi büyüyor; aile işinin asıl makinesi finalde.
 */
export const TUR_SIRASI: readonly string[] = ['forklift', 'dirsekli', 'vinc'];

/** Bir bacağın sonucu — hangi makine, ne kadar sürdü, kaç görev. */
export interface Bacak {
  aracId: string;
  /** Bu bacağın kendi süresi (s). */
  sure: number;
  /** Bacak biterken turun toplam süresi (s) — kümülatif ara süre. */
  bitis: number;
  puan: number;
  tamamlanan: number;
  gorevSayisi: number;
  devrildi: boolean;
  carpma: number;
  kirmiziSn: number;
}

export interface TurSonucu {
  not: 'A' | 'B' | 'C' | 'D';
  /** Yüzde — toplanan puanın alınabilecek en yükseğe oranı. */
  basari: number;
  puan: number;
  sure: number;
  tamamlanan: number;
  gorevSayisi: number;
  /** Hiç devrilmeden, çarpmadan, kırmızıya girmeden ve tam kadro bitirmek. */
  usta: boolean;
  bacaklar: Bacak[];
}

/** Bir bacağın `Result`ini tur kaydına çevirir. */
export function bacakYap(
  aracId: string, r: Result, gorevSayisi: number, oncekiToplam: number,
): Bacak {
  return {
    aracId,
    sure: r.score.sure,
    bitis: oncekiToplam + r.score.sure,
    puan: r.score.puan,
    tamamlanan: r.score.sapmalar.length,
    gorevSayisi,
    devrildi: r.devrildi,
    carpma: r.score.carpma,
    kirmiziSn: r.score.kirmiziSn,
  };
}

/**
 * Turun notu.
 *
 * Bölüm notuyla AYNI ölçü: toplanan puanın alınabilecek en yükseğe oranı.
 * Başka bir formül uydurmak iki notu karşılaştırılamaz yapardı — oyuncu
 * "bölümde A alıyorum ama turda C" gördüğünde bunun sebebinin kendi oyunu mu
 * yoksa iki ayrı ölçek mi olduğunu bilemezdi.
 *
 * **Devrilme turu bitirmiyor, o bacağı bitiriyor.** Onbeş görevlik bir turda
 * tek bir hatanın on beş dakikayı silmesi speedrun'ı cezalandırmak olurdu,
 * oynamayı değil. Devrilen bacak kendi puanını zaten kaybediyor: konulmayan
 * yükün puanı yok, üstelik `Mission` o bacağın oranını %15'le sınırlıyor.
 * Tam kadro (15/15) hâlâ kovalanacak şey.
 */
export function turuDegerlendir(bacaklar: Bacak[]): TurSonucu {
  const puan = bacaklar.reduce((a, b) => a + b.puan, 0);
  const sure = bacaklar.reduce((a, b) => a + b.sure, 0);
  const tamamlanan = bacaklar.reduce((a, b) => a + b.tamamlanan, 0);
  const gorevSayisi = bacaklar.reduce((a, b) => a + b.gorevSayisi, 0);
  const enYuksek = GOREV_MAX * gorevSayisi;
  const basari = enYuksek > 0
    ? Math.max(0, Math.min(100, (puan / enYuksek) * 100)) : 0;
  const not = basari >= 85 ? 'A' : basari >= 70 ? 'B' : basari >= 55 ? 'C' : 'D';
  const usta = gorevSayisi > 0 && tamamlanan === gorevSayisi
    && bacaklar.every((b) => !b.devrildi && b.carpma === 0 && b.kirmiziSn === 0);
  return { not, basari, puan, sure, tamamlanan, gorevSayisi, usta, bacaklar };
}
