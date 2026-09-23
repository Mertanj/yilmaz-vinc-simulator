import { araclar, bolumAdi, type AracTanimi } from '../game/araclar';
import { acikBolumSayisi, bolumAnahtari } from '../game/ilerleme';
import { enIyiOku, turEnIyiOku } from '../game/enIyi';
import { sureyiYaz } from './sure';
import { DILLER, M, dilSec, sozluk, type Dil } from './dil';
import { KIPLER, kipOku, kipYaz, type SimKipi } from '../sim/kip';
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

/** Oyuncunun açılışta verdiği karar: bir makinenin bir bölümü ya da Tam Tur. */
export type Secim =
  | { tur: false; arac: AracTanimi; bolumIndeksi: number }
  | { tur: true };

/** Kartları basar ve oyuncu birine basana kadar bekler. */
export function aracSec(host: HTMLElement): Promise<Secim> {
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
      for (const el of Array.from(host.querySelectorAll<HTMLButtonElement>('button.kip'))) {
        el.addEventListener('click', () => {
          const k = el.dataset['kip'];
          if (k !== 'temel' && k !== 'tam') return;
          kipYaz(k);
          ciz();
        });
      }
      // Kart da bölüm çipi de aynı şeyi yapıyor: bir makinenin bir bölümünü
      // başlatmak. Kart EN SON açık bölümü, çip kendi bölümünü başlatıyor.
      const sec = (el: HTMLButtonElement): void => {
        const secilen = araclar().find((a) => a.id === el.dataset['id']);
        if (!secilen?.hazir) return;
        const toplam = secilen.bolumler.length;
        const acik = acikBolumSayisi(secilen.id, secilen.bolumler.map((b) => b.id));
        const istenen = Number(el.dataset['bolum'] ?? acik - 1);
        // Kilitli bölüm düğmesi zaten `disabled`; yine de burada da sınır
        // var — el ile kurcalanmış bir DOM oyuncuyu kilidin arkasına geçirmesin.
        const bolumIndeksi = Number.isInteger(istenen)
          ? Math.max(0, Math.min(istenen, acik - 1, toplam - 1)) : acik - 1;
        secimiYaz(secilen.id);
        host.hidden = true;
        cozumle({ tur: false, arac: secilen, bolumIndeksi });
      };
      for (const el of Array.from(
        host.querySelectorAll<HTMLButtonElement>('button.kart, button.bolum'))) {
        el.addEventListener('click', () => { sec(el); });
      }
      host.querySelector<HTMLButtonElement>('button.tam-tur')
        ?.addEventListener('click', () => {
          host.hidden = true;
          cozumle({ tur: true });
        });
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
      <div class="kartlar">${araclar().map((a) => kartKabi(a, a.id === onceki)).join('')}</div>
      ${tamTurSeridi()}
      ${kipSecimi()}
      <footer>${M.secim.altBilgi}</footer>
    </div>`;
}

/**
 * Tam Tur şeridi — kartların ALTINDA, makine kartlarının bir alternatifi.
 *
 * Kart olarak değil şerit olarak duruyor ve bu bilerek: Tam Tur dördüncü bir
 * makine değil, üçünün birden oynandığı bir KİP. Kart yapmak onu makineyle
 * aynı hizaya koyar ve "hangi makine" sorusunu bulandırırdı.
 *
 * Yeni oyuncunun önce tek bir makineyle tanışması gerekiyor, o yüzden şerit
 * kartların altında; ama rekor satırı hep görünüyor, çünkü speedrun'ı
 * kovalayan oyuncunun ilk baktığı yer orası.
 */
function tamTurSeridi(): string {
  const r = turEnIyiOku();
  const k = M.tur;
  // İki kategori yan yana: hızlı koşmak isabetten puan kaybettiriyor, temiz
  // koşmak süre kaybettiriyor. Tek satır oyuncuyu ikisinden birini seçmeye
  // zorlardı; ikisi de görünüyor ki ikisi de kovalanabilsin.
  // **İki kategori İKİ SATIR.** Tek satırda birleştirilince puan rekorunun
  // notu hiçbir yerde görünmüyordu ve satırın rengi hız rekorunun notuna
  // göre çiziliyordu — yani iki ayrı turun rozeti tek bir renge karışıyordu.
  const satir = (
    k2: typeof r.hiz, metin: string,
  ): string => (k2
    ? `<span class="tur-rekor" data-not="${k2.not}">${metin}`
      + `${k2.usta ? ' · ⨯' : ''}</span>`
    : '');
  const rekorSatiri = r.hiz || r.puan
    ? satir(r.hiz, r.hiz ? k.hizSatiri(sureyiYaz(r.hiz.sure)) : '')
      + satir(r.puan, r.puan ? k.puanSatiri(M.sonuc.puan(r.puan.puan)) : '')
    : `<span class="tur-rekor bos">${k.rekorYok}</span>`;

  return `
    <div class="tam-tur-serit">
      <div class="tur-metin">
        <span class="tur-ad">${k.ad}</span>
        <p>${k.aciklama}</p>
        ${rekorSatiri}
      </div>
      <button type="button" class="tam-tur">${k.basla}</button>
    </div>`;
}

/**
 * Kumanda kipi — kartların ALTINDA, dil düğmelerinin yanında değil.
 *
 * Dil oyuna girmeden önce okunacak ilk şey; kip ise makineyi seçtikten sonra
 * "nasıl oynayacağım" sorusu. Üste koymak ekranın ilk satırını iki karara
 * birden ayırıyor ve asıl karardan (hangi makine) dikkat çalıyordu.
 *
 * Seçili olanın açıklaması YAZILI duruyor: bu, oyuncunun bir kez okuyup karar
 * vereceği bir ayar, ve "Gelişmiş"in ne demek olduğunu denemeden anlaması
 * gerekiyor.
 */
function kipSecimi(): string {
  const secili = kipOku();
  return `
    <div class="kipler">
      <span class="kip-baslik">${M.secim.kipBaslik}</span>
      ${KIPLER.map((k) => kipDugmesi(k, k === secili)).join('')}
      <p class="kip-aciklama">${
  secili === 'temel' ? M.secim.kipTemelAciklama : M.secim.kipTamAciklama}</p>
    </div>`;
}

function kipDugmesi(k: SimKipi, secili: boolean): string {
  const ad = k === 'temel' ? M.secim.kipTemel : M.secim.kipTam;
  return `<button class="kip${secili ? ' secili' : ''}" data-kip="${k}"`
    + `${secili ? ' aria-current="true"' : ''}>${ad}</button>`;
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
function enIyiSatiri(a: AracTanimi, bolumIndeksi: number): string {
  if (!a.hazir) return '';
  const b = a.bolumler[bolumIndeksi];
  if (!b) return '';
  const k = enIyiOku(bolumAnahtari({ aracId: a.id, bolumId: b.id, indeks: bolumIndeksi }));
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

/**
 * Kart ve altındaki bölüm şeridi.
 *
 * Bölüm çipleri kartın İÇİNDE değil altında, çünkü kart kendisi bir düğme
 * ve düğmenin içine düğme konamıyor. Kart EN SON açık bölümü başlatıyor —
 * oyuncunun en sık yaptığı şey, kaldığı yerden devam etmek. Tek bölümlü
 * makinede şerit hiç çizilmiyor; seçilecek bir şey yokken seçenek göstermek
 * yalnız kalabalık.
 */
function kartKabi(a: AracTanimi, sonKullanilan: boolean): string {
  const idler = a.bolumler.map((b) => b.id);
  const acik = a.hazir ? acikBolumSayisi(a.id, idler) : 0;
  const oynanacak = Math.max(0, acik - 1);
  return `<div class="kart-kabi">${kart(a, sonKullanilan, oynanacak)}`
    + `${bolumSeridi(a, acik)}</div>`;
}

function kart(a: AracTanimi, sonKullanilan: boolean, bolumIndeksi: number): string {
  const noktalar = [1, 2, 3]
    .map((n) => `<i${n <= a.seviye ? ' class="dolu"' : ''}></i>`).join('');
  const bolum = a.bolumler[bolumIndeksi];
  const cokBolumlu = a.bolumler.length > 1;
  return `
    <button class="kart" data-id="${a.id}" data-bolum="${bolumIndeksi}"${
      a.hazir ? '' : ' disabled'}>
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
      ${cokBolumlu && bolum
        ? `<div class="oynanacak">${M.secim.oynanacak(bolumAdi(bolum))}</div>` : ''}
      ${enIyiSatiri(a, bolumIndeksi)}
    </button>`;
}

/** Makinenin bölümleri sırayla: bitti ✓, açık ▸, kilitli 🔒. */
function bolumSeridi(a: AracTanimi, acik: number): string {
  if (!a.hazir || a.bolumler.length < 2) return '';
  const cipler = a.bolumler.map((b, i) => {
    const kayit = enIyiOku(bolumAnahtari({ aracId: a.id, bolumId: b.id, indeks: i }));
    const no = M.secim.bolumNo(i + 1);
    if (i >= acik) {
      const onceki = a.bolumler[i - 1];
      const neden = onceki ? M.secim.acilma(bolumAdi(onceki)) : M.secim.kilitli;
      return `<button class="bolum kilitli" disabled title="${neden}">`
        + `<span class="isaret" aria-hidden="true">🔒</span>`
        + `<span class="no">${no}</span><span class="ad">${bolumAdi(b)}</span>`
        + `<span class="alt">${neden}</span></button>`;
    }
    const durum = kayit ? 'bitti' : 'acik';
    return `<button class="bolum ${durum}" data-id="${a.id}" data-bolum="${i}">`
      + `<span class="isaret" aria-hidden="true">${kayit ? '✓' : '▸'}</span>`
      + `<span class="no">${no}</span><span class="ad">${bolumAdi(b)}</span>`
      + (kayit
        ? `<span class="alt" data-not="${kayit.not}">${
          M.secim.enIyi(String(kayit.puan), kayit.not)}</span>`
        : '')
      + '</button>';
  }).join('');
  return `<div class="bolumler">${cipler}</div>`;
}
