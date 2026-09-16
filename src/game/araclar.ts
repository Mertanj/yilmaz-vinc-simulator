import type { OyunSahnesi } from '../sim/sahne';
import { Scene } from '../sim/scene';
import { ForkliftSahnesi } from '../sim/forkliftSahne';
import {
  SahneGorunumu, VincGorunumu, ForkliftGorunumu,
} from '../render/gorunum';

/**
 * Oynanabilir araçlar.
 *
 * Sahadan gelen istek buydu: "vinç tipini ekleyebiliriz, ama oyuncuların
 * oyunun başında seçmesini istiyorum." Dolayısıyla araç bir AYAR değil, oyunun
 * ilk kararı. Her araç kendi sahnesini, kendi görünümünü ve kendi bölümünü
 * getiriyor; ortak olan tek şey görev akışı ve puanlama.
 *
 * Üçüncü aracı (dirsekli bom) eklemek bu listeye bir satır: `Mission`,
 * kamera, HUD ve puanlama hiç değişmiyor.
 */
export interface AracTanimi {
  id: string;
  ad: string;
  sinif: string;
  /** Kart üstündeki tek cümlelik tanıtım. */
  ozet: string;
  /** Oyuncuya bu araçta neyin zor olduğunu söyleyen satır. */
  zorluk: string;
  /** 1–3 arası; kartta nokta olarak gösteriliyor. */
  seviye: number;
  /** Kartın üstündeki basit siluet (inline SVG). */
  simge: string;
  /** HUD'un tuş listesi. */
  tuslar: string;
  hazir: boolean;
  kur?: () => { sahne: OyunSahnesi; gorunum: SahneGorunumu };
}

export const ARACLAR: readonly AracTanimi[] = [
  {
    id: 'forklift',
    ad: 'YF-25 Forklift',
    sinif: '2.5 ton · karşı ağırlıklı · depo',
    ozet: 'Paletleri raflara koy. Sürüşü kolay, ama yük merkezi uzadıkça '
      + 'kapasite hızla erir ve arka teker havalanır.',
    zorluk: 'Sınırı yatay mesafe koyuyor: geniş palet = uzak yük merkezi.',
    seviye: 1,
    simge: forkliftSimgesi(),
    tuslar: '<b>sürüş</b> <kbd>→</kbd> gaz <kbd>←</kbd> geri <kbd>boşluk</kbd> el freni<br>'
      + '<b>çatal</b> <kbd>W</kbd><kbd>S</kbd> kaldır/indir '
      + '<kbd>⇧W</kbd><kbd>⇧S</kbd> direk eğimi<br>'
      + '<kbd>boşluk</kbd> yükü al/bırak <kbd>R</kbd> sıfırla',
    hazir: true,
    kur: () => {
      const sahne = new ForkliftSahnesi();
      return { sahne, gorunum: new ForkliftGorunumu(sahne) };
    },
  },
  {
    id: 'vinc',
    ad: 'YV-25 Teleskopik Vinç',
    sinif: '25 ton · 30 m bom · sanayi sitesi',
    ozet: 'Sanayi sitesinin beş katına yük çıkar. Ayakları aç, bomu kur, '
      + 'salınımı durdur ve terasa bırak.',
    zorluk: 'Sınırı yarıçap koyuyor: yük uzaklaştıkça kapasite düşer.',
    seviye: 3,
    simge: vincSimgesi(),
    tuslar: '<b>sürüş</b> <kbd>→</kbd> gaz <kbd>←</kbd> geri <kbd>boşluk</kbd> el freni<br>'
      + '<b>kurulum</b> <kbd>Q</kbd> ayak aç/kapa<br>'
      + '<b>vinç</b> <kbd>W</kbd><kbd>S</kbd> bom <kbd>⇧W</kbd><kbd>⇧S</kbd> teleskop<br>'
      + '<kbd>↑</kbd><kbd>↓</kbd> kanca <kbd>boşluk</kbd> bağla/bırak<br>'
      + '<kbd>K</kbd> halat katı <kbd>R</kbd> sıfırla',
    hazir: true,
    kur: () => {
      const sahne = new Scene();
      return { sahne, gorunum: new VincGorunumu(sahne) };
    },
  },
  {
    id: 'dirsekli',
    ad: 'Dirsekli Bom',
    sinif: '9 tm · kamyon üstü · dar alan',
    ozet: 'Katlanan bomla binaların üstünden aşıp arkaya uzanan makine. '
      + 'Dar sokağın makinesi.',
    zorluk: 'Sınırı iki eklem birden koyuyor — henüz yapım aşamasında.',
    seviye: 3,
    simge: dirsekliSimgesi(),
    tuslar: '',
    hazir: false,
  },
];

export function aracBul(id: string | null): AracTanimi {
  const bulunan = ARACLAR.find((a) => a.id === id && a.hazir);
  const ilk = ARACLAR.find((a) => a.hazir);
  if (!bulunan && !ilk) throw new Error('oynanabilir araç yok');
  return bulunan ?? (ilk as AracTanimi);
}

// --- kart siluetleri -------------------------------------------------------
// Kartta oyuncunun makineyi TANIMASI gerekiyor; isim tek başına yetmiyor.
// Basit tek renkli siluet, oyun içindeki prosedürel çizimin küçük hâli.

function forkliftSimgesi(): string {
  return svg(`
    <rect x="14" y="30" width="30" height="16" rx="3"/>
    <rect x="8" y="28" width="9" height="19" rx="2"/>
    <rect x="20" y="14" width="3" height="16"/><rect x="33" y="14" width="3" height="16"/>
    <rect x="52" y="10" width="4" height="34"/>
    <rect x="52" y="40" width="16" height="4"/>
    <rect x="47" y="24" width="6" height="18"/>
    <circle cx="46" cy="48" r="6"/><circle cx="20" cy="48" r="5"/>`);
}

function vincSimgesi(): string {
  return svg(`
    <rect x="6" y="34" width="52" height="8" rx="2"/>
    <rect x="40" y="24" width="16" height="11" rx="2"/>
    <rect x="12" y="26" width="16" height="9" rx="2"/>
    <path d="M18 27 L64 8 L68 14 L22 33 Z"/>
    <rect x="62" y="12" width="2" height="22"/>
    <rect x="58" y="32" width="10" height="6" rx="2"/>
    <circle cx="20" cy="45" r="5"/><circle cx="46" cy="45" r="5"/>`);
}

function dirsekliSimgesi(): string {
  return svg(`
    <rect x="6" y="34" width="52" height="8" rx="2"/>
    <rect x="40" y="24" width="16" height="11" rx="2"/>
    <path d="M22 30 L30 10 L36 12 L28 32 Z"/>
    <path d="M30 10 L62 18 L61 24 L29 16 Z"/>
    <rect x="58" y="20" width="2" height="16"/>
    <circle cx="20" cy="45" r="5"/><circle cx="46" cy="45" r="5"/>`);
}

function svg(ic: string): string {
  return `<svg viewBox="0 0 76 56" fill="currentColor" aria-hidden="true">${ic}</svg>`;
}
