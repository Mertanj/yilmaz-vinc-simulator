import type { Komut, Kumanda, Tetik } from '../input/kumanda';

/**
 * Ekran üstü kumanda.
 *
 * Telefonda klavye yok; oyun da klavyesiz oynanamıyordu. Pad, makinenin
 * fonksiyonlarını parmakla basılabilir düğmelere çeviriyor ve `Kumanda`'ya
 * NİYET gönderiyor (`kaldir`, `yatGeri`) — hangi tuşun neye karşılık geldiğini
 * bilmesi gerekmiyor.
 *
 * Düzen araca göre: her makinenin kendi fonksiyonları var ve hepsini tek bir
 * genel pade sığdırmak, iki makineyi de yanlış anlatırdı. Düzeni olmayan araçta
 * pad hiç açılmıyor — boş düğmeler göstermektense yokluğu dürüst.
 */
export interface DokunmatikDugme {
  /** Basılı tutulan komut. `tetik` ile birlikte verilmez. */
  komut?: Komut;
  /** Bir karelik tetik. `komut` ile birlikte verilmez. */
  tetik?: Tetik;
  /** Düğmenin üstündeki işaret. */
  isaret: string;
  /** İşaretin altındaki kısa ad. */
  ad: string;
}

export interface DokunmatikDuzeni {
  /** Sol başparmak — sürüş. */
  sol: DokunmatikDugme[];
  /** Sağ başparmak — makinenin iş fonksiyonu. */
  sag: DokunmatikDugme[];
  /** Köşedeki küçük yardımcı düğmeler (sıfırla, makine değiştir). */
  yardimci: DokunmatikDugme[];
}

/**
 * Cihazın BİRİNCİL işaretçisi parmak mı?
 *
 * `maxTouchPoints > 0` yanlış cevap veriyor: dokunmatik ekranlı bir dizüstünde
 * de sıfırdan büyük, oysa kullanıcı klavye ve fare kullanıyor ve ekranın
 * yarısını kaplayan bir pad orada sadece engel. `pointer: coarse` tam olarak
 * "birincil işaretçi kaba", yani parmak demek.
 */
export function dokunmatikVar(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/** Padi kurar; dönen fonksiyon söküyor. */
export function dokunmatikKur(
  host: HTMLElement, duzen: DokunmatikDuzeni, kumanda: Kumanda,
): () => void {
  host.innerHTML = [
    `<div class="pad sol">${duzen.sol.map(dugme).join('')}</div>`,
    `<div class="pad sag">${duzen.sag.map(dugme).join('')}</div>`,
    `<div class="pad yardimci">${duzen.yardimci.map(dugme).join('')}</div>`,
  ].join('');
  host.hidden = false;
  // Pad açıkken klavye tuş listesi anlamsız: geniş bir tablette ikisi de
  // sığıyor ama biri yalan söylüyor.
  document.body.classList.add('dokunmatik');

  const sokucular: Array<() => void> = [];
  const dugmeler = Array.from(host.querySelectorAll<HTMLButtonElement>('button'));
  for (const el of dugmeler) {
    const komut = el.dataset['komut'] as Komut | undefined;
    const tetik = el.dataset['tetik'] as Tetik | undefined;

    if (tetik) {
      // Tetikler `click` ile: sıfırlamak ve makine değiştirmek turu bitiren
      // işler, yanlışlıkla sürtünen bir parmağa feda edilmesinler.
      const f = (): void => kumanda.tetikle(tetik);
      el.addEventListener('click', f);
      sokucular.push(() => el.removeEventListener('click', f));
      continue;
    }
    if (!komut) continue;

    const bas = (e: PointerEvent): void => {
      e.preventDefault();
      // İşaretçiyi yakala: parmak düğmeden kayıp çıksa bile `pointerup` yine
      // buraya geliyor. Yakalamazsak parmak kayınca komut basılı kalır ve
      // makine kendi kendine gaza yapışır.
      //
      // Yakalama BAŞARISIZ olabilir (işaretçi artık etkin değilse tarayıcı
      // istisna fırlatıyor) ve bu komutu yutmamalı: yakalama bir kolaylık,
      // düğmenin çalışması ona bağlı değil.
      try { el.setPointerCapture(e.pointerId); } catch { /* yakalama şart değil */ }
      el.classList.add('basili');
      kumanda.komutBas(komut);
    };
    const birak = (): void => {
      el.classList.remove('basili');
      kumanda.komutBirak(komut);
    };
    el.addEventListener('pointerdown', bas);
    el.addEventListener('pointerup', birak);
    el.addEventListener('pointercancel', birak);
    // Sistem dokunuşu (bildirim çekmecesi, arama) yakalamayı elimizden alırsa
    // `pointerup` hiç gelmiyor; bırakmanın son güvencesi bu.
    el.addEventListener('lostpointercapture', birak);
    sokucular.push(() => {
      el.removeEventListener('pointerdown', bas);
      el.removeEventListener('pointerup', birak);
      el.removeEventListener('pointercancel', birak);
      el.removeEventListener('lostpointercapture', birak);
    });
  }

  return () => {
    for (const s of sokucular) s();
    host.innerHTML = '';
    host.hidden = true;
    document.body.classList.remove('dokunmatik');
  };
}

function dugme(d: DokunmatikDugme): string {
  const nitelik = d.komut ? `data-komut="${d.komut}"`
    : d.tetik ? `data-tetik="${d.tetik}"` : '';
  const sinif = d.tetik ? ' class="tetik"' : '';
  return `<button type="button"${sinif} ${nitelik} aria-label="${d.ad}">`
    + `<span class="isaret" aria-hidden="true">${d.isaret}</span>`
    + `<span class="ad">${d.ad}</span></button>`;
}
