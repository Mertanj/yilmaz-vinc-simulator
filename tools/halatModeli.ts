/**
 * İKİ MAKİNE AYNI HALAT MODELİNİ KULLANIYOR MU?
 *
 * Sahadan gelen gözlem: *"normal bomlu vinçle kırmalı vincin fizik motorları
 * aynı değil gibi. Kırmalı vinçte halatı salmadan çok yukarıda bom
 * kırabiliyorken normal vinçte halat kilitlenebiliyor."*
 *
 * Ölçüldü ve haklıydı. Dirseklide `ikiBlokta` bayrağı hesaplanıyordu ama
 * HİÇBİR ŞEYİ kilitlemiyordu, üstelik teleskop halat yemiyordu: aynı pozdan
 * teleskop komutu verildiğinde vinçte uzama 0.00 m (kilit devrede),
 * dirseklide 2.80 m. Yani teleskop bedava bir hamleydi — vincin kendi kod
 * yorumunun "olmamalı" dediği şey.
 *
 * Bu dosya o ayrışmanın geri gelmesini engelliyor. Bu depoda aynı sınıftan
 * bir hata bir kez daha oldu (görev metinleri `dil.ts` ile veri dosyası
 * arasında sessizce ayrıştı ve oyuncu yanlış brifingi okudu); iki kopyanın
 * ayrışması gözle yakalanmıyor, ölçümle yakalanıyor.
 *
 * İki sav var ve ikisi de MAKİNEDEN BAĞIMSIZ ifade edilmiş — sayılar değil,
 * DAVRANIŞ karşılaştırılıyor:
 *
 *   1. İki-blok bölgesindeyken teleskobu uzatmak KİLİTLİ (ve kilitli kola
 *      basıldığı bildiriliyor, yoksa oyuncu makineyi bozuk sanıyor).
 *   2. Halat payı varken teleskobu uzatmak halat YİYOR — toplam halat sabit,
 *      tambur→uç yolu uzayınca uç→kanca parçası kısalıyor.
 */
import { Scene, IDLE, type SceneInput } from '../src/sim/scene';
import { DirsekliSahne } from '../src/sim/dirsekliSahne';

const DT = 1 / 60;
let hata = 0;

const say = (s: string): void => { console.log(s); };

function esit(ad: string, a: unknown, b: unknown): void {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  say(`${ok ? 'GECTI ' : 'KALDI '} ${ad}`
    + (ok ? '' : `  ${JSON.stringify(a)} != ${JSON.stringify(b)}`));
  if (!ok) hata = 1;
}

/** Bir makinenin halat davranışının makineden bağımsız özeti. */
interface Olcum {
  /** İki-blokta teleskobu uzatmak kilitli mi? */
  kilitliyken0Uzama: boolean;
  /** Kilitli kola basıldığı bildirildi mi? */
  kilitBildirildi: boolean;
  /** Pay varken uzama başına yenen halat (m/m). 1.0 = tam takip. */
  halatTakibi: number;
}

/** Ayakları aç ve oturmasını bekle. */
function kur(adim: (g: SceneInput) => void): void {
  adim({ ...IDLE, toggleOutriggers: true });
  adim({ ...IDLE, toggleOutriggers: true });
  for (let i = 0; i < 60 * 12; i++) adim(IDLE);
}

/** `uzat` komutunu makinenin kendi eksen adına çeviren sürücü. */
function olc(
  adim: (g: SceneInput) => void,
  uzatKomutu: (v: number) => SceneInput,
  oku: () => { halat: number; uzama: number; ikiBlok: boolean; kilitli: boolean },
  halatSal: (sn: number) => void,
): Olcum {
  kur(adim);

  // 1. İki-blok bölgesinde (kurulumda kanca kafada) teleskobu aç.
  const a0 = oku();
  for (let i = 0; i < 60 * 6; i++) adim(uzatKomutu(1));
  const a1 = oku();

  // 2. Halatı sal, sonra yeniden aç — bu sefer pay var.
  halatSal(6);
  const b0 = oku();
  for (let i = 0; i < 60 * 6; i++) adim(uzatKomutu(1));
  const b1 = oku();
  const duzama = b1.uzama - b0.uzama;

  return {
    kilitliyken0Uzama: a0.ikiBlok && Math.abs(a1.uzama - a0.uzama) < 0.01,
    kilitBildirildi: a1.kilitli,
    halatTakibi: duzama > 0.2 ? (b0.halat - b1.halat) / duzama : NaN,
  };
}

// --- VINC ---
const v = new Scene();
const vOlcum = olc(
  (g) => { v.step(g, DT); },
  (u) => ({ ...IDLE, crane: { luff: 0, telescope: u, uzat: 0, winch: 0 } }),
  () => ({
    halat: v.crane.ropeM, uzama: v.crane.extensionM,
    ikiBlok: v.crane.ikiBlokta, kilitli: v.crane.kilitliDenendi,
  }),
  (sn) => {
    for (let i = 0; i < 60 * sn; i++) {
      v.step({ ...IDLE, crane: { luff: 0, telescope: 0, uzat: 0, winch: -1 } }, DT);
    }
  },
);

// --- DIRSEKLI ---
const d = new DirsekliSahne();
const dOlcum = olc(
  (g) => { d.step(g, DT); },
  (u) => ({ ...IDLE, crane: { luff: 0, telescope: 0, uzat: u, winch: 0 } }),
  () => ({
    halat: d.bom.halatBoyuM, uzama: d.bom.uzamaBoyuM,
    ikiBlok: d.bom.ikiBlokta, kilitli: d.bom.kilitliDenendi,
  }),
  (sn) => {
    for (let i = 0; i < 60 * sn; i++) {
      d.step({ ...IDLE, crane: { luff: 0, telescope: 0, uzat: 0, winch: -1 } }, DT);
    }
  },
);

say('=== HALAT MODELI: VINC vs DIRSEKLI ===');
say('');
say('                                   vinc      dirsekli');
say(`  iki-blokta uzama kilitli      ${String(vOlcum.kilitliyken0Uzama).padStart(8)}`
  + `${String(dOlcum.kilitliyken0Uzama).padStart(14)}`);
say(`  kilitli kol bildirildi        ${String(vOlcum.kilitBildirildi).padStart(8)}`
  + `${String(dOlcum.kilitBildirildi).padStart(14)}`);
say(`  uzama basina yenen halat      ${vOlcum.halatTakibi.toFixed(2).padStart(8)}`
  + `${dOlcum.halatTakibi.toFixed(2).padStart(14)}`);
say('');

esit('iki-blokta uzatma IKI makinede de kilitli',
  [vOlcum.kilitliyken0Uzama, dOlcum.kilitliyken0Uzama], [true, true]);
esit('kilitli kola basildigi IKI makinede de bildiriliyor',
  [vOlcum.kilitBildirildi, dOlcum.kilitBildirildi], [true, true]);
// Takip 1.0 olmali: uzama d metre artinca serbest halat d metre kisaliyor.
// Tolerans, vinc komutunun LMI hiz olcegiyle carpilmasindan (ikisi ayni
// olceklemeyi kullanmiyor) ve rampalardan geliyor; model aynı ya da degil,
// onu 0.9-1.1 bandi zaten ayiriyor (bagsiz hali 0.00 okuyordu).
for (const [ad, x] of [['vinc', vOlcum.halatTakibi], ['dirsekli', dOlcum.halatTakibi]] as const) {
  const ok = Number.isFinite(x) && x > 0.9 && x < 1.1;
  say(`${ok ? 'GECTI ' : 'KALDI '} ${ad}: teleskop halat yiyor (${x.toFixed(2)})`);
  if (!ok) hata = 1;
}

process.exitCode = hata;
