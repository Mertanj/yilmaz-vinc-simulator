import { M } from './dil';
import { sureyiYaz, farkiYaz } from './sure';
import type { TurSonucu } from '../game/tamTur';
import type { TurRekorlari } from '../game/enIyi';

/**
 * Tam Tur sonuç ekranının gövdesi — **saf fonksiyon.**
 *
 * `main.ts` içinde bir `innerHTML` bloğuydu ve tam olarak bu yüzden hiç
 * test edilememişti: oyun testinde forklift ayağı iki kez bitirildi, el
 * değiştirme kartı ve ayaklar arası geçiş doğrulandı, ama üç ayağı birden
 * bitirecek bir otopilot yazılamadığı için bu ekranı hiç kimse görmedi.
 * Ekranın kendisi DOM'a değil VERİYE bağlı; ayırınca `npm run skor` onu
 * doğrudan sınayabiliyor ve geriye yalnızca `innerHTML = ...` satırı
 * kalıyor.
 *
 * Bölüm sonucundan farklı olarak SÜRE başrolde: bir speedrun turunun tek
 * anlamlı ölçüsü bitirme süresi. Not ve görev sayısı onun altında, ayak
 * dökümü ise rekor tura karşı nerede kazanıp nerede kaybettiğini gösteriyor.
 */
export function turSonucuHtml(
  s: TurSonucu,
  kirilan: { hizRekoru: boolean; puanRekoru: boolean },
  /** Kayıttan ÖNCEKİ rekorlar — tur kendisiyle yarışmasın. */
  onceki: TurRekorlari,
  /** Araç kimliğini ekranda görünecek ada çeviren eşleme. */
  aracAdi: (id: string) => string,
): string {
  const k = M.tur;
  const n = M.sonuc;
  // Ara süreler HIZ rekoruna karşı koşuyor: ara süre zaten bir zaman ölçüsü.
  const hedef = onceki.hiz;
  const tamKadro = s.gorevSayisi > 0 && s.tamamlanan === s.gorevSayisi;

  const satirlar = s.bacaklar.map((b, i) => {
    const rekorBitis = hedef?.bitisler[i];
    const fark = rekorBitis === undefined ? '<td></td>' : (() => {
      const f = farkiYaz(b.bitis - rekorBitis);
      return `<td data-iyi="${f.iyi === null ? 'esit' : f.iyi ? 'evet' : 'hayir'}">`
        + `${f.metin}</td>`;
    })();
    return `<tr><td>${aracAdi(b.aracId)}</td><td>${sureyiYaz(b.sure)}</td>`
      + `<td>${sureyiYaz(b.bitis)}</td>${fark}</tr>`;
  }).join('');

  return [
    `<div class="not" data-not="${s.not}">${s.not}</div>`,
    `<h2>${tamKadro ? k.bitti : k.terkEdildi}</h2>`,
    s.usta ? `<p class="rozet">${n.usta}</p>` : '',
    `<p class="toplam">${sureyiYaz(s.sure)}</p>`,
    kirilan.hizRekoru ? `<p class="rekor">${k.hizRekoru}</p>` : '',
    kirilan.puanRekoru ? `<p class="rekor">${k.puanRekoru}</p>` : '',
    !kirilan.hizRekoru && onceki.hiz
      ? `<p class="onceki">${k.oncekiHiz(sureyiYaz(onceki.hiz.sure))}</p>` : '',
    !kirilan.puanRekoru && onceki.puan
      ? `<p class="onceki">${k.oncekiPuan(n.puan(onceki.puan.puan))}</p>` : '',
    '<table>',
    `<tr><td>${k.gorevler}</td><td>${s.tamamlanan} / ${s.gorevSayisi}</td></tr>`,
    `<tr><td>${k.toplamSure}</td><td>${sureyiYaz(s.sure)}</td></tr>`,
    '</table>',
    `<div class="ara-sureler"><h3>${k.ayakDokumu}</h3><table>${satirlar}</table>`
      + (hedef ? '' : `<p class="ilk">${k.ilkTur}</p>`) + '</div>',
    `<p class="puan">${n.puan(s.puan)} · ${n.basari(s.basari.toFixed(0))}</p>`,
    `<p class="note">${k.devam}</p>`,
  ].join('');
}
