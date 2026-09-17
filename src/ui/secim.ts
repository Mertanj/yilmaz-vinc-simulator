import { araclar, type AracTanimi } from '../game/araclar';
import { enIyiOku } from '../game/enIyi';
import { DILLER, M, dilSec, sozluk, type Dil } from './dil';
import { oku, yaz } from './kayit';
import { dokunmatikVar } from './dokunmatik';

/**
 * Açılış ekranı — oyuncu önce DİLİ, sonra makineyi seçiyor.
 *
 * Sahadan gelen istek: "oyuncuların oyunun başında seçmesini istiyorum,
 * hangisiyle oynamak isterlerse." Seçim bir ayar menüsü değil, oyunun ilk
 * kararı; o yüzden tam ekran, kart hâlinde ve her kart makinenin NEYİNİN zor
 * olduğunu söylüyor. İki araç aynı oyunu oynamıyor, oyuncu bunu girmeden
 * önce bilmeli.
 *
 * Dil düğmesi burada duruyor çünkü oyun başladıktan sonra dil değişmiyor:
 * bütün metinler açılışta bir kez okunuyor. Değiştirmek sayfayı yenilemek
 * demek ve bunu yapacak tek an burası.
 *
 * Seçim `localStorage`'a yazılıyor: aynı makineyi tekrar denemek isteyen
 * oyuncu ikinci kez seçmek zorunda kalmıyor, sadece onaylıyor.
 */
const ANAHTAR = 'yv.arac';

export function sonSecim(): string | null {
  return oku(ANAHTAR);
}

export function secimiYaz(id: string): void {
  yaz(ANAHTAR, id);
}

/** Kartları basar ve oyuncu birine basana kadar bekler. */
export function aracSec(host: HTMLElement): Promise<AracTanimi> {
  host.hidden = false;
  return new Promise((cozumle) => {
    const ciz = (): void => {
      host.innerHTML = govde();
      for (const el of Array.from(host.querySelectorAll<HTMLButtonElement>('button.dil'))) {
        el.addEventListener('click', () => {
          const d = el.dataset['dil'];
          if (d !== 'tr' && d !== 'en') return;
          dilSec(d);
          ciz();
        });
      }
      for (const el of Array.from(host.querySelectorAll<HTMLButtonElement>('button.kart'))) {
        el.addEventListener('click', () => {
          const secilen = araclar().find((a) => a.id === el.dataset['id']);
          if (!secilen?.hazir) return;
          secimiYaz(secilen.id);
          host.hidden = true;
          cozumle(secilen);
        });
      }
    };
    ciz();
  });
}

function govde(): string {
  const onceki = sonSecim();
  return `
    <div class="secim-ic">
      <header>
        <div class="diller">${DILLER.map(dilDugmesi).join('')}</div>
        <h1>${M.secim.baslik}</h1>
        <p>${M.secim.soru}</p>
      </header>
      <div class="kartlar">${araclar().map((a) => kart(a, a.id === onceki)).join('')}</div>
      <footer>${M.secim.altBilgi}</footer>
    </div>`;
}

function dilDugmesi(d: Dil): string {
  const secili = d === M.kod;
  return `<button class="dil${secili ? ' secili' : ''}" data-dil="${d}"`
    + `${secili ? ' aria-current="true"' : ''}>${sozluk(d).ad}</button>`;
}

/**
 * Karttaki en iyi derece.
 *
 * Hiç oynanmamış araçta satır BASILMIYOR — "en iyi: yok" yazmak boş bir
 * vaat, üstelik kartı da uzatıyor. Satırın olmaması zaten "burayı henüz
 * denemedin" demek.
 */
function enIyiSatiri(a: AracTanimi): string {
  if (!a.hazir) return '';
  const k = enIyiOku(a.id);
  if (!k) return '';
  return `<div class="en-iyi" data-not="${k.not}">`
    + `${M.secim.enIyi(String(k.puan), k.not)}`
    + `${k.usta ? ' ★' : ''}</div>`;
}

/**
 * Telefonda ekran kumandası olmayan araç.
 *
 * Kartı kapatmıyoruz: klavyeli bir tablette ya da masaüstü modunda pekâlâ
 * oynanıyor. Ama oyuncu makineye girip kumandasız kaldığını orada keşfetmesin.
 */
function klavyeNotu(a: AracTanimi): string {
  if (!a.hazir || a.dokunmatikVar || !dokunmatikVar()) return '';
  return `<div class="klavye">⌨ ${M.secim.klavyeGerek}</div>`;
}

function kart(a: AracTanimi, sonKullanilan: boolean): string {
  const noktalar = [1, 2, 3]
    .map((n) => `<i${n <= a.seviye ? ' class="dolu"' : ''}></i>`).join('');
  return `
    <button class="kart" data-id="${a.id}"${a.hazir ? '' : ' disabled'}>
      ${a.hazir ? '' : `<span class="rozet">${M.secim.yakinda}</span>`}
      ${sonKullanilan ? `<span class="rozet son">${M.secim.sonOynadigin}</span>` : ''}
      <div class="simge">${a.simge}</div>
      <h2>${a.ad}</h2>
      <div class="sinif">${a.sinif}</div>
      ${klavyeNotu(a)}
      <p>${a.ozet}</p>
      <div class="zorluk"><span>${M.secim.zorluk}</span>
        <div class="noktalar">${noktalar}</div></div>
      <div class="ipucu">${a.zorluk}</div>
      ${enIyiSatiri(a)}
    </button>`;
}
