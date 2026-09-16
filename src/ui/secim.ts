import { ARACLAR, type AracTanimi } from '../game/araclar';

/**
 * Açılış ekranı — oyuncu hangi makineyle oynayacağını seçiyor.
 *
 * Sahadan gelen istek: "oyuncuların oyunun başında seçmesini istiyorum,
 * hangisiyle oynamak isterlerse." Seçim bir ayar menüsü değil, oyunun ilk
 * kararı; o yüzden tam ekran, kart hâlinde ve her kart makinenin NEYİNİN zor
 * olduğunu söylüyor. İki araç aynı oyunu oynamıyor, oyuncu bunu girmeden
 * önce bilmeli.
 *
 * Seçim `localStorage`'a yazılıyor: aynı makineyi tekrar denemek isteyen
 * oyuncu ikinci kez seçmek zorunda kalmıyor, sadece onaylıyor.
 */
const ANAHTAR = 'yv.arac';

export function sonSecim(): string | null {
  try { return localStorage.getItem(ANAHTAR); } catch { return null; }
}

export function secimiYaz(id: string): void {
  try { localStorage.setItem(ANAHTAR, id); } catch { /* gizli sekme */ }
}

/** Kartları basar ve oyuncu birine basana kadar bekler. */
export function aracSec(host: HTMLElement): Promise<AracTanimi> {
  const onceki = sonSecim();
  host.innerHTML = `
    <div class="secim-ic">
      <header>
        <h1>YILMAZ VİNÇ</h1>
        <p>Hangi makineyle çalışacaksın?</p>
      </header>
      <div class="kartlar">${ARACLAR.map((a) => kart(a, a.id === onceki)).join('')}</div>
      <footer>Her makinenin kendi bölümü, kendi yük tablosu ve kendi tehlikesi var.
        İstediğin zaman <kbd>R</kbd> ile sıfırlayabilirsin.</footer>
    </div>`;
  host.hidden = false;

  return new Promise((cozumle) => {
    for (const el of Array.from(host.querySelectorAll<HTMLButtonElement>('button.kart'))) {
      el.addEventListener('click', () => {
        const secilen = ARACLAR.find((a) => a.id === el.dataset['id']);
        if (!secilen?.hazir) return;
        secimiYaz(secilen.id);
        host.hidden = true;
        cozumle(secilen);
      });
    }
  });
}

function kart(a: AracTanimi, sonKullanilan: boolean): string {
  const noktalar = [1, 2, 3]
    .map((n) => `<i${n <= a.seviye ? ' class="dolu"' : ''}></i>`).join('');
  return `
    <button class="kart" data-id="${a.id}"${a.hazir ? '' : ' disabled'}>
      ${a.hazir ? '' : '<span class="rozet">yakında</span>'}
      ${sonKullanilan ? '<span class="rozet son">son oynadığın</span>' : ''}
      <div class="simge">${a.simge}</div>
      <h2>${a.ad}</h2>
      <div class="sinif">${a.sinif}</div>
      <p>${a.ozet}</p>
      <div class="zorluk"><span>zorluk</span><div class="noktalar">${noktalar}</div></div>
      <div class="ipucu">${a.zorluk}</div>
    </button>`;
}
