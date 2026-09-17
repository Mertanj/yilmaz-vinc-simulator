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
  /**
   * Arayüz eylemi — makineye hiç gitmiyor.
   *
   * `tetik` makineye bir komut yolluyor (sıfırla, kanca, ayaklar); `eylem` ise
   * ekranın kendi işi (ekranı çevir). İkisini ayrı tutmak `Kumanda`'yı
   * yerleşim kararlarından uzak tutuyor.
   */
  eylem?: () => void;
  /** Düğmenin üstündeki işaret. */
  isaret: string;
  /** İşaretin altındaki kısa ad. */
  ad: string;
}

/**
 * Düzeni ÜRETEN fonksiyon — makinenin fazına göre.
 *
 * Vinçte tek bir pad olmuyor: sürerken gaz/fren/ayaklar, ayaklar yerdeyken
 * bom/teleskop/kanca. Hepsini aynı anda göstermek telefonu kokpit paneline
 * çevirir ve yarısı o an işe yaramayan düğme olur. Faz makinenin kendi
 * gerçeği (`calismaModunda`), pad onu takip ediyor. Forklift fazsız: aynı
 * düzeni döndürüyor ve hiç yeniden çizilmiyor.
 */
export type DuzenUretici = (calismaModunda: boolean) => DokunmatikDuzeni;

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

export interface Pad {
  /**
   * Fazı bildirir. Faz değişmediyse hiçbir şey yapmıyor, o yüzden her kare
   * çağrılabilir. Yeniden çizdiyse `true` döner — çağıran taraf ancak o zaman
   * yeniden ölçüm yapsın: `offsetWidth` okumak yerleşimi zorluyor ve bunu her
   * karede yapmak kare hızını yer.
   */
  guncelle(calismaModunda: boolean): boolean;
  sok(): void;
}

/** Padi kurar. */
export function dokunmatikKur(
  host: HTMLElement, uret: DuzenUretici, kumanda: Kumanda,
): Pad {
  let cizili: boolean | null = null;
  let sokucular: Array<() => void> = [];

  const guncelle = (calismaModunda: boolean): boolean => {
    if (cizili === calismaModunda) return false;
    cizili = calismaModunda;
    for (const s of sokucular) s();
    sokucular = ciz(host, uret(calismaModunda), kumanda);
    return true;
  };

  guncelle(false);
  host.hidden = false;
  // Pad açıkken klavye tuş listesi anlamsız: geniş bir tablette ikisi de
  // sığıyor ama biri yalan söylüyor.
  document.body.classList.add('dokunmatik');

  return {
    guncelle,
    sok: () => {
      for (const s of sokucular) s();
      sokucular = [];
      host.innerHTML = '';
      host.hidden = true;
      document.body.classList.remove('dokunmatik');
    },
  };
}

/** Düzeni basar ve bağlar; dönen sökücüler dinleyicileri kaldırıyor. */
function ciz(
  host: HTMLElement, duzen: DokunmatikDuzeni, kumanda: Kumanda,
): Array<() => void> {
  // Düğmeler tanımlarıyla SIRAYLA eşleşiyor: DOM'dan geri okumak (etikete ya
  // da veri niteliğine bakmak) aynı bilgiyi iki kez kodlamak olurdu.
  const kumeler: Array<[string, DokunmatikDugme[]]> = [
    ['sol', duzen.sol], ['sag', duzen.sag], ['yardimci', duzen.yardimci],
  ];
  host.innerHTML = kumeler
    .map(([ad, ds]) => `<div class="pad ${ad}">${ds.map(dugme).join('')}</div>`)
    .join('');
  const sokucular: Array<() => void> = [];
  for (const [ad, tanimlar] of kumeler) {
    const el = host.querySelector(`.pad.${ad}`);
    if (!el) continue;
    const dugmeler = Array.from(el.querySelectorAll('button'));
    dugmeler.forEach((b, i) => {
      const t = tanimlar[i];
      if (t) sokucular.push(bagla(b, t, kumanda));
    });
  }

  return sokucular;
}

/** Tek düğmeyi bağlar; dönen fonksiyon dinleyicileri söküyor. */
function bagla(
  el: HTMLButtonElement, t: DokunmatikDugme, kumanda: Kumanda,
): () => void {
  // Tek basışlık işler `click` ile: sıfırlamak, makine değiştirmek ve ekranı
  // çevirmek turu kesen işler, yanlışlıkla sürtünen bir parmağa feda
  // edilmesinler.
  const tekBasis = t.eylem ?? (t.tetik ? () => kumanda.tetikle(t.tetik!) : null);
  if (tekBasis) {
    el.addEventListener('click', tekBasis);
    return () => el.removeEventListener('click', tekBasis);
  }
  const komut = t.komut;
  if (!komut) return () => { /* bağlanacak bir şey yok */ };

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
  return () => {
    el.removeEventListener('pointerdown', bas);
    el.removeEventListener('pointerup', birak);
    el.removeEventListener('pointercancel', birak);
    el.removeEventListener('lostpointercapture', birak);
    // Sökerken KOMUTU DA BIRAK. Faz değişimi padi yeniden çiziyor; o an
    // basılı tutulan bir düğme (ayaklar açılırken basılı duran gaz gibi)
    // yok edilince `pointerup` hiç gelmez ve komut sonsuza kadar basılı
    // kalırdı.
    kumanda.komutBirak(komut);
  };
}

function dugme(d: DokunmatikDugme): string {
  const sinif = d.tetik || d.eylem ? ' class="tetik"' : '';
  return `<button type="button"${sinif} aria-label="${d.ad}">`
    + `<span class="isaret" aria-hidden="true">${d.isaret}</span>`
    + `<span class="ad">${d.ad}</span></button>`;
}
