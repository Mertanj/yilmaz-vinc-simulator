import { Box, type World } from 'planck';
import type { KonanYuk, VincBolum } from './vincBolum';
import type { Task } from '../game/tasks';
import { SANAYI } from './sanayi';
import { M } from '../ui/dil';

/**
 * Bölüm 2 — "Şantiye teslimatı": çitin ardındaki kamyonu boşalt.
 *
 * **Birinci bölümün tersi.** Orada yük hep yakında, malzeme alanında
 * doğuyor ve zorluk BIRAKIRKEN geliyordu: teraslar uzaklaştıkça yarıçap
 * büyüyordu. Burada kamyon sokakta, şantiye çitinin ötesinde duruyor ve
 * yük kasanın neresindeyse oradan ALINIYOR — kasanın ucundaki yük bomun
 * en uzağında. Yani bu bölümde kritik kaldırma yükü kaldırdığın an; sahaya
 * inen yük ise vince yaklaşıyor ve rahatlıyor.
 *
 * İki yeni ders:
 *
 *  - **Kanca bloğu da yük.** En uçtaki hafif yük iki kat halatla ibreyi
 *    %94'e dayıyor, tek katla %75'te kalıyor: blok 450 kilodan 220 kiloya
 *    iniyor ve o yarıçapta bu fark az değil. **Zorunlu DEĞİL, bilerek:**
 *    halat katı düğmesi sahadan gelen kararla telefon kumandasından
 *    kaldırıldı (*"o butona gerek yok"*), yani katı değiştirmeyi şart koşan
 *    bir görev telefonda bitirilemezdi. Klavyede K'yı bilen oyuncu ödülünü
 *    alıyor; uyarı satırı da ona söylüyor.
 *  - **İstif.** Üç yük aynı yere, üst üste: ağır olan alta. Üstteki yükün
 *    hedefi alttakinin GERÇEK yerinden hesaplanıyor; yamuk konan alt yük
 *    bir sonrakinin zeminini yamuk yapıyor.
 *
 * **Yerleşim 2B'nin sınırından çıktı.** Vinç bomunu yalnız önüne uzatabiliyor
 * ve kullanılabilir yarıçap 7.7 ile ~25 metre arası; kasa, çit ve stok sahası
 * bu 17 metreye sığmak zorunda. Kamyon bu yüzden tır değil, 10 metre kasalı
 * dört akslı bir kamyon — ve kabini uzak uçta, çünkü kabin bomun erişemediği
 * yerde durmalı.
 */
export const SANTIYE = {
  /**
   * Vinç birinci bölümle AYNI yere park ediyor: yaklaşma, takoz ve kurulum
   * alanı ölçülmüş ve oturmuş durumda. Değişen, takozun ötesi.
   */
  kerbX: SANAYI.kerbX,
  setupX: SANAYI.setupX,
  setupYariEn: SANAYI.setupYariEn,

  /**
   * İstif yeri: iki kalas takozun üstü.
   *
   * Saha sırası batıdan doğuya istif · kaide · kulübe, ve aralar ölçüldü:
   * kulübe tabanı önce çitin 30 santim içindeydi ve rig kulübeyi indirirken
   * sallanan yük ÇİTİN TEPESİNE oturdu. Oyuncu da aynı tuzağa düşerdi —
   * kabul penceresi (50 cm) kulübeyi çitin içine kadar taşıyabiliyordu.
   * Şimdi kulübe ile çit arası 70, kulübe ile jeneratör arası 55 santim.
   */
  istifX: 59.6,
  takozlar: [58.9, 60.3],
  takozEn: 0.3,
  takozY: 0.15,

  /** Jeneratör kaidesi — beton, zeminden 15 cm yüksek. */
  kaideSol: 61.2,
  kaideSag: 63.4,
  kaideY: 0.15,

  /** Bekçi kulübesinin beton tabanı — çitin hemen içinde, kapının yanında. */
  kulubeSol: 64.0,
  kulubeSag: 65.2,
  kulubeY: 0.1,

  /** Şantiye çiti: yük bunun üstünden aşıyor. */
  citX: 66.0,
  citKalinlik: 0.12,
  citY: 2.4,

  /**
   * Kamyon kasası. **Tabanı 1.30 m** — kasalı kamyonun gerçek taban
   * yüksekliği. Kabin kasanın ÖNÜNDE, uzak uçta: bomun erişemediği yerde.
   */
  kasaArka: 66.6,
  kasaOn: 77.0,
  kasaY: 1.3,
  kasaKalinlik: 0.2,
  kabinSol: 77.1,
  kabinSag: 79.7,
  kabinY: 3.3,

  /** Kasadaki iki yük arasındaki boşluk (m). */
  kasaAraligi: 0.15,
} as const;

/** Görevin şantiyedeki hâli: kasadaki yeri ve varışı. */
export interface SantiyeGorevi extends Task {
  /** Yükün kasadaki yeri (merkez x). Kasa sırası görev sırası. */
  kasaX: number;
  /** Sabit bir nokta ya da daha önce konmuş bir yükün üstü. */
  varis: { tur: 'nokta'; x: number; y: number } | { tur: 'ustune'; kod: string };
  /**
   * Kabul penceresinin yarı eni (m).
   *
   * İstifte DAR (40 cm): yük alttakinin üstünde kenarı taşmadan durmalı.
   * Birinci bölümün terasındaki iki metre burada istif değil yığın olurdu.
   */
  pencere: number;
}

type Taslak = Omit<SantiyeGorevi, 'kasaX'>;

/**
 * Beş yük, kasada arkadan öne — yani vince en yakından en uzağa.
 *
 *   K1  Jeneratör      2.25 t  R 16.5  → kaide       (iki kat ŞART: tek kat 2 t)
 *   K2  Demir demeti   1.60 t  R 18.7  → istifin altı
 *   K3  Kalıp paketi   1.20 t  R 20.8  → demirin üstü
 *   K4  İskele paketi  0.85 t  R 23.0  → kalıbın üstü
 *   K5  Bekçi kulübesi 0.65 t  R 25.1  → kapının yanı (tek katla %75)
 *
 * Yarıçaplar kasadaki yerden; ağırlıklar o yarıçapın kapasitesinden geriye
 * doğru. Ölçülmüş değerler `npm run sahne:vinc` zarf tablosunda.
 */
const TASLAK: readonly Taslak[] = [
  {
    kod: 'K1', ad: 'Jeneratör', tonnes: 2.25, pencere: 0.5,
    halfWidth: 1.05, halfHeight: 0.75, kind: 'jenerator', hedef: 0,
    varis: { tur: 'nokta', x: (SANTIYE.kaideSol + SANTIYE.kaideSag) / 2, y: SANTIYE.kaideY },
    brif: 'Kasanın arkası → kaide: en ağır yük, ama vince en yakın olan',
  },
  {
    kod: 'K2', ad: 'İnşaat demiri', tonnes: 1.6, pencere: 0.4,
    halfWidth: 1.0, halfHeight: 0.28, kind: 'donati', hedef: 1,
    varis: { tur: 'nokta', x: SANTIYE.istifX, y: SANTIYE.takozY },
    brif: 'İstifin tabanı — iki kalasın üstüne, ağır olan alta',
  },
  {
    kod: 'K3', ad: 'Kalıp paketi', tonnes: 1.2, pencere: 0.4,
    halfWidth: 1.0, halfHeight: 0.4, kind: 'kalip', hedef: 2,
    varis: { tur: 'ustune', kod: 'K2' },
    brif: 'Demirin üstüne: alttaki nasıl durduysa sen de öyle otur',
  },
  {
    kod: 'K4', ad: 'İskele paketi', tonnes: 0.85, pencere: 0.4,
    halfWidth: 1.0, halfHeight: 0.35, kind: 'iskele', hedef: 3,
    varis: { tur: 'ustune', kod: 'K3' },
    brif: 'İstifin tepesi — kasanın dördüncü sırası, yarıçap 23 metre',
  },
  {
    kod: 'K5', ad: 'Bekçi kulübesi', tonnes: 0.65, pencere: 0.5,
    halfWidth: 0.7, halfHeight: 1.2, kind: 'kulube', hedef: 4,
    varis: { tur: 'nokta', x: (SANTIYE.kulubeSol + SANTIYE.kulubeSag) / 2, y: SANTIYE.kulubeY },
    brif: 'Kasanın ucu, 25 metre: ibre %94\'e dayanır — kasadan yavaş kopar',
  },
];

/** Kasadaki yerler görev sırasıyla, arkadan öne, aralarında `kasaAraligi`. */
export const SANTIYE_GOREVLERI: readonly SantiyeGorevi[] = (() => {
  let imlec = SANTIYE.kasaArka + SANTIYE.kasaAraligi;
  return TASLAK.map((t) => {
    const kasaX = imlec + t.halfWidth;
    imlec = kasaX + t.halfWidth + SANTIYE.kasaAraligi;
    return { ...t, kasaX };
  });
})();

/** Çit, kasa, kabin, kalaslar, kaide — tek statik gövde. */
export function createSantiye(world: World): void {
  const body = world.createBody();
  const kutu = (sol: number, sag: number, alt: number, ust: number, surtunme = 0.8): void => {
    const hw = (sag - sol) / 2;
    const hh = (ust - alt) / 2;
    body.createFixture(new Box(hw, hh, { x: sol + hw, y: alt + hh }, 0), { friction: surtunme });
  };
  const s = SANTIYE;
  for (const x of s.takozlar) kutu(x - s.takozEn / 2, x + s.takozEn / 2, 0, s.takozY, 0.9);
  kutu(s.kaideSol, s.kaideSag, 0, s.kaideY);
  kutu(s.kulubeSol, s.kulubeSag, 0, s.kulubeY);
  kutu(s.citX, s.citX + s.citKalinlik, 0, s.citY, 0.6);
  kutu(s.kasaArka, s.kasaOn, s.kasaY - s.kasaKalinlik, s.kasaY, 0.85);
  kutu(s.kabinSol, s.kabinSag, 0, s.kabinY, 0.6);
}

const gorev = (t: Task): SantiyeGorevi | undefined =>
  SANTIYE_GOREVLERI.find((g) => g.kod === t.kod);

export const SANTIYE_TESLIMATI: VincBolum = {
  id: 'santiye',
  kur: createSantiye,
  kerbX: SANTIYE.kerbX,
  setupX: SANTIYE.setupX,
  setupYariEn: SANTIYE.setupYariEn,
  gorevler: SANTIYE_GOREVLERI,
  yukYeri: (t) => ({ x: gorev(t)?.kasaX ?? SANTIYE.kasaArka + 1, y: SANTIYE.kasaY + t.halfHeight }),
  kalici: true,
  hedefNoktasi(t, konanlar: ReadonlyMap<string, KonanYuk>) {
    const v = gorev(t)?.varis;
    if (!v) return null;
    if (v.tur === 'nokta') return { x: v.x, y: v.y };
    const alt = konanlar.get(v.kod);
    // Alttaki yük henüz konmadıysa (olmamalı) istifin tabanı.
    return alt ? { x: alt.x, y: alt.y + alt.hh } : { x: SANTIYE.istifX, y: SANTIYE.takozY };
  },
  yerlestirmeToleransi: (t) => ({ x: gorev(t)?.pencere ?? 0.5, y: 0.3 }),
  /**
   * **Çit uyarısı.** Yük çitin hizasına yaklaşırken tabanı çitin üstünde
   * değilse söyle: kasadan kalkan yükü doğrudan sahaya çekmek onu çitin
   * yüzüne sürtüyor. Dirsekli bölümdeki bahçe duvarı uyarısıyla aynı ders.
   */
  tasimaIpucu(yuk) {
    const s = SANTIYE;
    const yakin = yuk.x - yuk.yariEn < s.citX + s.citKalinlik + 0.6
      && yuk.x + yuk.yariEn > s.citX - 0.6;
    return yakin && yuk.y - yuk.yariBoy < s.citY + 0.3 ? M.vinc.ipucu.citiAs : null;
  },
  hizEsikleri: { tam: 90, sifir: 240 },
  kameraOlcegi: { yakin: 30, uzak: 15 },
};
