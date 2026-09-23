import type { OyunSahnesi } from '../sim/sahne';
import { Scene } from '../sim/scene';
import { ForkliftSahnesi } from '../sim/forkliftSahne';
import {
  SahneGorunumu, VincGorunumu, ForkliftGorunumu, DirsekliGorunumu,
} from '../render/gorunum';
import { DirsekliSahne } from '../sim/dirsekliSahne';
import { DAR_SOKAK } from '../sim/avlu';
import { FORKLIFT_BOLUMLERI } from './forkliftTasks';
import type { ForkliftBolum } from './forkliftBolum';
import { M } from '../ui/dil';
import type { DokunmatikDuzeni, PadKaynagi } from '../ui/dokunmatik';
import { OutriggerState } from '../sim/loadChart';

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
  /**
   * Ekran üstü kumandanın düzeni — yoksa o araç telefonda oynanamıyor.
   *
   * Vinçte beş eksen ve üç anahtar var; hepsini bir telefon ekranına sığdırmak
   * kendi turu. Düzeni olmayan araç, dokunmatik cihazda kartında "klavye
   * gerekir" notuyla duruyor: kartı kapatmak yerine dürüstçe söylüyoruz,
   * çünkü klavyeli bir tablette pekâlâ oynanıyor.
   */
  dokunmatikVar?: boolean;
  hazir: boolean;
  /**
   * Makinenin bölümleri, AÇILMA SIRASIYLA. Boşsa araç oynanamaz.
   *
   * Sahadan gelen karar: *"sırayla açılsın."* Birinci bölümü bitiren
   * ikinciyi açıyor (bkz. `acikBolumSayisi`).
   */
  bolumler: readonly BolumTanimi[];
}

/** Bir makinenin bir bölümü: kimliği, adı ve sahneyi kuran fonksiyon. */
export interface BolumTanimi {
  /**
   * Kalıcı kimlik — rekor anahtarında geçiyor, DEĞİŞTİRİLMEMELİ.
   * Değiştirmek o bölümün bütün rekorlarını sessizce düşürür.
   */
  id: string;
  /**
   * Padin kaynağı `kur()` ile birlikte dönüyor, tanımda durmuyor: düğme
   * etiketleri makinenin O ANKİ durumundan besleniyor ("4 kat yap"), yani
   * pade sahnenin kendisi lazım. Seçim ekranının ihtiyacı olan tek şey
   * padin VAR OLUP OLMADIĞI, o da `dokunmatikVar` bayrağında.
   */
  kur: () => { sahne: OyunSahnesi; gorunum: SahneGorunumu; pad?: PadKaynagi };
}

/** Bölümün ekranda görünen adı — dil dosyasından, kimlikle. */
export function bolumAdi(b: BolumTanimi): string {
  return M.bolumAdi[b.id] ?? b.id;
}

/**
 * Forklift bölümü → seçim ekranının bölüm tanımı.
 *
 * İki depo aynı makineyi, aynı padi kullanıyor; farklı olan yalnız veri.
 */
function forkliftBolumu(b: ForkliftBolum): BolumTanimi {
  return {
    id: b.id,
    kur: () => {
      const sahne = new ForkliftSahnesi(b);
      return {
        sahne,
        gorunum: new ForkliftGorunumu(sahne),
        // Forklift fazsız ve düğmeleri sabit: sabit anahtar, hiç yeniden
        // çizilmiyor.
        pad: { anahtar: () => 'sabit', duzen: forkliftPadi },
      };
    },
  };
}

/**
 * Araç listesi bir FONKSİYON, sabit değil: metinler seçilen dile göre
 * okunuyor ve dil, oyun açılmadan hemen önce seçiliyor. Modül düzeyinde bir
 * sabit olsaydı sözlük değişmeden önce dondurulurdu.
 */
/**
 * Forkliftin ekran kumandası.
 *
 * Sol başparmak sürüyor, sağ başparmak çatalı işletiyor — gerçek makinedeki
 * el dağılımının aynısı: solda direksiyon ve pedal, sağda kollar. Direk eğimi
 * kaldırmanın yanında ama daha küçük; turda iki kez kullanılıyor, kaldırma ise
 * sürekli.
 */
function forkliftPadi(): DokunmatikDuzeni {
  const d = M.dokunma;
  return {
    sol: [
      { komut: 'geri', isaret: '◀', ad: d.geri },
      { komut: 'ileri', isaret: '▶', ad: d.ileri },
      { komut: 'fren', isaret: '■', ad: d.fren },
    ],
    sag: [
      { komut: 'yatGeri', isaret: '↰', ad: d.yatGeri },
      { komut: 'yatOn', isaret: '↱', ad: d.yatOn },
      { komut: 'indir', isaret: '▼', ad: d.indir },
      { komut: 'kaldir', isaret: '▲', ad: d.kaldir },
    ],
    yardimci: [
      { tetik: 'sifirla', isaret: '⟲', ad: d.sifirla },
      { tetik: 'cikis', isaret: '⊞', ad: d.makineler },
    ],
  };
}

/**
 * Vincin ekran kumandası — FAZA GÖRE.
 *
 * Makine zaten iki fazda çalışıyor: ayaklar toplu iken sürülüyor, yere
 * değince vinç oluyor. Klavyede bu zaten var — boşluk tuşu sürerken el freni,
 * ayaklar açıkken kanca. Pad de aynı ayrımı kullanıyor, çünkü on bir düğmeyi
 * aynı anda göstermek telefonu kokpit paneline çevirirdi ve yarısı o an işe
 * yaramayan düğme olurdu.
 *
 * `ayaklar` iki fazda da duruyor: fazı değiştiren düğme o, gizlemek oyuncuyu
 * kapatırdı.
 */
function vincPadi(sahne: Scene): DokunmatikDuzeni {
  const d = M.dokunma;
  // Sırayla gezen iki düğme: etiketleri BİR SONRAKİ durumu yazıyor, yani
  // basınca ne olacağını.
  const ayakAdi = {
    [OutriggerState.Stowed]: d.ayakYariAc,
    [OutriggerState.Half]: d.ayakTamAc,
    [OutriggerState.Full]: d.ayakTopla,
  }[sahne.outriggers.state];
  const ayak = { tetik: 'ayaklar' as const, isaret: ayakSimgesi(), ad: ayakAdi };
  const yardimci = [
    { tetik: 'sifirla' as const, isaret: '⟲', ad: d.sifirla },
    { tetik: 'cikis' as const, isaret: '⊞', ad: d.makineler },
  ];
  if (!sahne.calismaModunda) {
    return {
      sol: [
        { komut: 'geri', isaret: '◀', ad: d.geri },
        { komut: 'ileri', isaret: '▶', ad: d.ileri },
        { komut: 'fren', isaret: '■', ad: d.fren },
      ],
      // Tek düğme ama sağ başparmağın altındaki DOĞRU düğme: bu fazda
      // oyuncunun yapacağı tek iş ayakları açmak.
      sag: [ayak],
      yardimci,
    };
  }
  return {
    sol: [
      { komut: 'bomIndir', isaret: '▼', ad: d.bomIndir },
      { komut: 'bomKaldir', isaret: '▲', ad: d.bomKaldir },
      { komut: 'teleskopKis', isaret: '↙', ad: d.teleskopKis },
      { komut: 'teleskopUzat', isaret: '↗', ad: d.teleskopUzat },
    ],
    sag: [
      { komut: 'kancaAsagi', isaret: '↓', ad: d.kancaAsagi },
      { komut: 'kancaYukari', isaret: '↑', ad: d.kancaYukari },
      { tetik: 'kanca', isaret: kancaSimgesi(), ad: d.kanca },
      ayak,
    ],
    yardimci,
  };
}

/**
 * Dirsekli bomun ekran kumandası — vincinkiyle aynı desende, FAZA GÖRE.
 *
 * Eksen sayısı aynı (ana bom, kırma, kanca) ve ayrım da aynı: ayaklar toplu
 * iken sürülüyor, yere değince vinç oluyor. Tek fark sürüş fazının etiketi —
 * bu makine çalışma alanına GERİ GERİ yanaşıyor, o yüzden geri düğmesi önce
 * geliyor ve "yanaş" diye okunuyor.
 */
function dirsekliPadi(sahne: DirsekliSahne): DokunmatikDuzeni {
  const d = M.dokunma;
  const ayakAdi = {
    [OutriggerState.Stowed]: d.ayakYariAc,
    [OutriggerState.Half]: d.ayakTamAc,
    [OutriggerState.Full]: d.ayakTopla,
  }[sahne.outriggers.state];
  const ayak = { tetik: 'ayaklar' as const, isaret: ayakSimgesi(), ad: ayakAdi };
  const yardimci = [
    { tetik: 'sifirla' as const, isaret: '⟲', ad: d.sifirla },
    { tetik: 'cikis' as const, isaret: '⊞', ad: d.makineler },
  ];
  if (!sahne.calismaModunda) {
    return {
      sol: [
        { komut: 'geri', isaret: '◀', ad: d.geri },
        { komut: 'ileri', isaret: '▶', ad: d.ileri },
        { komut: 'fren', isaret: '■', ad: d.fren },
      ],
      sag: [ayak],
      yardimci,
    };
  }
  // Sol sutun ALTI dugme: uc eksen, her biri bir cift. Vincte dort vardi;
  // buradaki ucuncu eksen (teleskop) makinenin karakteri, gizlenemez.
  return {
    sol: [
      { komut: 'bomIndir', isaret: '▼', ad: d.bomIndir },
      { komut: 'bomKaldir', isaret: '▲', ad: d.bomKaldir },
      { komut: 'teleskopKis', isaret: '↙', ad: d.kirmaKatla },
      { komut: 'teleskopUzat', isaret: '↗', ad: d.kirmaAc },
      { komut: 'uzamaKis', isaret: '⇤', ad: d.uzamaKis },
      { komut: 'uzamaAc', isaret: '⇥', ad: d.uzamaAc },
    ],
    sag: [
      { komut: 'kancaAsagi', isaret: '↓', ad: d.kancaAsagi },
      { komut: 'kancaYukari', isaret: '↑', ad: d.kancaYukari },
      { tetik: 'kanca', isaret: kancaSimgesi(), ad: d.kanca },
      ayak,
    ],
    yardimci,
  };
}

/**
 * İki simge Unicode değil ÇİZİM.
 *
 * Ayak ve kanca için elverişli bir karakter yok; denenenler telefonun
 * fontunda bulunmayınca boş kutu olarak çıkıyor (bir kez "telefonu çevir"
 * ekranında tam da o oldu). Ok ve üçgenler her fontta var, bunlar yok.
 */
function ayakSimgesi(): string {
  return '<svg viewBox="0 0 24 20" fill="none" stroke="currentColor"'
    + ' stroke-width="2.2" stroke-linecap="round">'
    + '<path d="M3 5h18"/><path d="M6 5l-3 12"/><path d="M18 5l3 12"/></svg>';
}
function kancaSimgesi(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="2.2" stroke-linecap="round">'
    + '<path d="M12 3v9"/><path d="M12 12a4 4 0 1 0 4 4"/></svg>';
}

export function araclar(): readonly AracTanimi[] {
  return [
  {
    id: 'forklift',
    ad: M.forklift.ad,
    sinif: M.forklift.sinif,
    ozet: M.forklift.ozet,
    zorluk: M.forklift.zorluk,
    seviye: 2,
    simge: forkliftSimgesi(),
    tuslar: M.forklift.tuslar,
    dokunmatikVar: true,
    hazir: true,
    bolumler: FORKLIFT_BOLUMLERI.map(forkliftBolumu),
  },
  {
    id: 'vinc',
    ad: M.vinc.ad,
    sinif: M.vinc.sinif,
    ozet: M.vinc.ozet,
    zorluk: M.vinc.zorluk,
    seviye: 3,
    simge: vincSimgesi(),
    tuslar: M.vinc.tuslar,
    dokunmatikVar: true,
    hazir: true,
    bolumler: [{
      id: 'sanayi',
      kur: () => {
        const sahne = new Scene();
        return {
          sahne,
          gorunum: new VincGorunumu(sahne),
          pad: {
            anahtar: () => `${sahne.calismaModunda}|${sahne.outriggers.state}`,
            duzen: () => vincPadi(sahne),
          },
        };
      },
    }],
  },
  {
    id: 'dirsekli',
    ad: M.dirsekli.ad,
    sinif: M.dirsekli.sinif,
    ozet: M.dirsekli.ozet,
    zorluk: M.dirsekli.zorluk,
    // Vinçten bir kademe kolay: yarıçap küçük, salınım kısa halatla
    // sönüyor ve devrilme diye bir mesele yok — sınırı moment koyuyor.
    seviye: 2,
    simge: dirsekliSimgesi(),
    tuslar: M.dirsekli.tuslar,
    dokunmatikVar: true,
    hazir: true,
    bolumler: [{
      id: DAR_SOKAK.id,
      kur: () => {
        const sahne = new DirsekliSahne(DAR_SOKAK);
        return {
          sahne,
          gorunum: new DirsekliGorunumu(sahne),
          pad: {
            anahtar: () => `${sahne.calismaModunda}|${sahne.outriggers.state}`,
            duzen: () => dirsekliPadi(sahne),
          },
        };
      },
    }],
  },
  ];
}

export function aracBul(id: string | null): AracTanimi {
  const liste = araclar();
  const oynanir = (a: AracTanimi): boolean => a.hazir && a.bolumler.length > 0;
  const bulunan = liste.find((a) => a.id === id && oynanir(a));
  const ilk = liste.find(oynanir);
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
