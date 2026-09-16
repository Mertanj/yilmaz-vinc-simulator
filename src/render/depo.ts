import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { worldText } from './text';
import {
  RAF_KATLARI, RAF_X, RAF_DERINLIK, GIRIS_X, PALET_AYAK, TESLIM_KOTU, katAdi,
} from '../game/forkliftTasks';

/**
 * Depo dekoru.
 *
 * Vinç sahnesinde mekân bir sanayi avlusuydu; burada kapalı bir depo. Fark
 * kozmetik değil: forkliftin bütün zorluğu YATAY mesafede (yük merkezi) ve
 * DÜŞEY kotta (raf katı) olduğu için dekorun da bu iki ekseni okunur kılması
 * gerekiyor. Raf katlarının kotu fizikten okunuyor, tekrar yazılmıyor.
 */

/** Rafın çizimi — tek yapı, fizikteki kirişlerle aynı kotlarda. */
export function drawRaf(): Container {
  const c = new Container();
  const g = new Graphics();
  const ust = (RAF_KATLARI[RAF_KATLARI.length - 1] ?? 4.8) + 1.1;
  const on = RAF_X;
  const arka = RAF_X + RAF_DERINLIK;

  // Dikmeler — delikli çelik profil, önde ve arkada
  for (const x of [on - 0.1, arka + 0.1]) {
    g.rect(x - 0.1, 0, 0.2, ust).fill(C.rack);
    g.rect(x - 0.1, 0, 0.07, ust).fill({ color: C.rackLight, alpha: 0.85 });
    for (let y = 0.3; y < ust; y += 0.32) {
      g.rect(x - 0.035, y, 0.07, 0.11).fill({ color: C.rackDark, alpha: 0.85 });
    }
    g.rect(x - 0.19, 0, 0.38, 0.09).fill(C.rackDark);
  }
  // Çaprazlar — iki dikme arasında, derinlik hissi
  for (let y = 0.3; y < ust - 0.8; y += 1.05) {
    g.moveTo(on, y).lineTo(arka, y + 0.62)
      .stroke({ width: 0.055, color: C.rackDark, alpha: 0.42 });
    g.moveTo(arka, y).lineTo(on, y + 0.62)
      .stroke({ width: 0.055, color: C.rackDark, alpha: 0.28 });
  }

  RAF_KATLARI.forEach((kot, i) => {
    g.rect(on, kot - 0.16, RAF_DERINLIK, 0.16).fill(C.rack);
    g.rect(on, kot - 0.16, RAF_DERINLIK, 0.05).fill({ color: C.rackLight, alpha: 0.9 });
    g.rect(on, kot - 0.04, RAF_DERINLIK, 0.04).fill(C.rackDark);
    // Arka dayanak
    g.rect(arka - 0.07, kot, 0.14, 0.52).fill(C.rackDark);
    // Kat adresi ve kotu: depo raflarında gerçekten yazar
    // Etiket rafın ARKA yarısında: ön yarıda hedef işaretiyle üst üste
    // biniyordu ve ikisi de okunmuyordu.
    const et = worldText(`${katAdi(i)} · ${kot.toFixed(2)} m`, 0.26, { fill: 0xD6E2EA });
    et.position.set(on + RAF_DERINLIK - 1.25, kot - 0.58);
    c.addChild(et);
  });

  c.addChildAt(g, 0);
  return c;
}

/** Depo zemini: beton, derz çizgileri ve sarı trafik şeritleri. */
export function drawDepoZemin(left: number, right: number): Graphics {
  const g = new Graphics();
  g.rect(left, -8, right - left, 8).fill(C.depoFloor);
  g.rect(left, -0.06, right - left, 0.06).fill(C.depoFloorD);
  // Beton derzleri
  for (let x = Math.ceil(left / 4) * 4; x < right; x += 4) {
    g.moveTo(x, 0).lineTo(x, -1.6).stroke({ width: 0.04, color: C.depoFloorD, alpha: 0.7 });
  }
  // Yürüyüş yolu şeridi — depoda gerçekten çizilidir
  for (let x = left + 1; x < right; x += 0.9) {
    g.rect(x, 0.01, 0.5, 0.06).fill({ color: C.hazardY, alpha: 0.55 });
  }
  // Yükleme karesi: paletler buraya iniyor
  g.rect(GIRIS_X - 1.6, 0.01, 3.2, 0.07).fill({ color: C.hazardY, alpha: 0.9 });
  for (const x of [GIRIS_X - 1.6, GIRIS_X + 1.53]) {
    g.rect(x, 0.01, 0.07, 1.0).fill({ color: C.hazardY, alpha: 0.9 });
  }
  return g;
}

/**
 * Arka duvar, çatı makasları ve sevkiyat kapısı.
 *
 * Duvar KAMERANIN görebileceğinden yüksek: ilk sürümde 9.2 metrede bitiyordu
 * ve ekranın üst yarısı boş kalıyordu — kapalı bir mekânda bu, deponun
 * tavanının olmadığı izlenimi veriyordu.
 */
export function drawDepoIci(left: number, right: number): Container {
  const c = new Container();
  const g = new Graphics();
  const tavan = 7.4;
  const ust = 22;

  // Arka duvar — sandviç panel, tavana kadar
  g.rect(left, 0, right - left, tavan).fill(C.depoWall);
  for (let x = left; x < right; x += 1.2) {
    g.rect(x, 0, 0.05, tavan).fill({ color: C.depoWallD, alpha: 0.6 });
  }
  // Tavan boşluğu: makasların arası, yukarı doğru koyulaşıyor
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    g.rect(left, tavan + ((ust - tavan) * i) / 10, right - left, (ust - tavan) / 10 + 0.05)
      .fill(karistir(0x6F767C, 0x262D33, t));
  }
  g.rect(left, tavan - 0.34, right - left, 0.34).fill(C.depoWallD);

  // Çatı makasları
  for (let x = Math.ceil(left / 6) * 6; x < right; x += 6) {
    g.moveTo(x, tavan).lineTo(x, tavan + 2.1)
      .stroke({ width: 0.11, color: C.roof, alpha: 0.9 });
    g.moveTo(x - 3, tavan + 1.2).lineTo(x + 3, tavan + 1.2)
      .stroke({ width: 0.09, color: C.roof, alpha: 0.75 });
    // Çapraz
    g.moveTo(x - 3, tavan + 1.2).lineTo(x, tavan + 2.1)
      .stroke({ width: 0.06, color: C.roof, alpha: 0.5 });
  }
  g.rect(left, tavan + 2.1, right - left, 0.4).fill(C.roof);
  // Aydınlatma armatürleri — tavandan sarkan sıra
  for (let x = Math.ceil(left / 5) * 5; x < right; x += 5) {
    g.rect(x - 0.05, tavan + 1.5, 0.1, 0.6).fill(C.roof);
    g.roundRect(x - 0.42, tavan + 1.28, 0.84, 0.22, 0.08).fill(0xF5F0DC);
  }

  // Işıklıklar — düz duvar ölü duruyordu
  for (let x = left + 2; x < right - 2; x += 5) {
    g.rect(x, 4.5, 2.2, 1.5).fill({ color: 0xE9F1F4, alpha: 0.55 });
    g.rect(x, 4.5, 2.2, 1.5).stroke({ width: 0.05, color: C.depoWallD, alpha: 0.7 });
  }

  // Sevkiyat kapısı — soldaki giriş
  g.rect(left + 1.4, 0, 3.6, 4.2).fill(C.depoWallD);
  for (let y = 0.2; y < 4.1; y += 0.42) {
    g.rect(left + 1.5, y, 3.4, 0.34).fill({ color: 0x9AA2A7, alpha: 0.95 });
  }

  const tabela = worldText('YILMAZ LOJİSTİK · SEVKİYAT', 0.5, { fill: C.liveryRed });
  tabela.position.set(left + 6.4, 5.0);
  c.addChild(tabela);

  c.addChildAt(g, 0);
  return c;
}

/**
 * Mal kabul konveyörü — paletler buradan iniyor.
 *
 * Oyuncuya "yeni palet nereden gelecek" sorusunun cevabını veriyor. Palet
 * makine yükleme karesinin batısına geçince iniyor; ağzın altındaki sarı kare
 * de nereye ineceğini söylüyor.
 */
export function drawKonveyor(): Container {
  const c = new Container();
  const g = new Graphics();
  const y = TESLIM_KOTU + 0.5;
  // Tavandan sarkan askılar
  for (const x of [GIRIS_X - 1.5, GIRIS_X + 1.5]) {
    g.rect(x - 0.05, y + 0.3, 0.1, 2.6).fill(C.roof);
  }
  // Konveyör gövdesi ve rulolar
  g.rect(GIRIS_X - 1.7, y, 3.4, 0.34).fill(C.mast);
  g.rect(GIRIS_X - 1.7, y + 0.28, 3.4, 0.06).fill(C.mastLight);
  for (let x = GIRIS_X - 1.5; x < GIRIS_X + 1.5; x += 0.34) {
    g.circle(x, y + 0.14, 0.1).fill(C.mastLight);
    g.circle(x, y + 0.14, 0.04).fill(C.mast);
  }
  // Ağız: paletin çıktığı boşluk
  g.rect(GIRIS_X - 0.75, y - 0.12, 1.5, 0.12).fill(C.rackDark);

  const et = worldText('MAL KABUL', 0.3, { fill: C.hazardY });
  et.position.set(GIRIS_X - 1.55, y + 0.45);
  c.addChild(et);
  c.addChildAt(g, 0);
  return c;
}

/** Yükün altındaki palet — çatalın nereye gireceğini gösteriyor. */
export function drawPalet(hw: number): Graphics {
  const g = new Graphics();
  const h = PALET_AYAK;
  g.rect(-hw, -h, hw * 2, h).fill(C.pallet);
  g.rect(-hw, -h, hw * 2, 0.04).fill({ color: 0xC9A470, alpha: 0.8 });
  // Takozlar: çatal bunların ARASINDAN giriyor. Yandan bakınca bıçak
  // takozun içinden geçiyormuş gibi görünür; fizikte de ayaklar çatalla
  // çarpışmıyor, çünkü gerçekte farklı derinlikteler.
  for (const x of [-hw + 0.02, -0.16, hw - 0.34]) {
    g.rect(x, -h + 0.05, 0.32, h - 0.09).fill(C.palletDark);
  }
  g.rect(-hw, -h, hw * 2, 0.05).fill(C.palletDark);
  return g;
}

/**
 * Deponun iç hacmi — gökyüzünün kapalı mekân karşılığı.
 *
 * Vinç sahnesinde arka planda gökyüzü var; burada olamaz, çatının üstünü
 * göremeyiz. Bunun yerine yukarı doğru koyulaşan bir iç hacim: ışık aşağıda,
 * makasların arası karanlık.
 */
export function drawDepoArkaPlan(width: number, height: number): Graphics {
  const g = new Graphics();
  const bant = 26;
  for (let i = 0; i < bant; i++) {
    const t = i / (bant - 1);
    const c = karistir(0x232A30, 0x8D969C, t);
    g.rect(0, (height * i) / bant, width, height / bant + 1).fill(c);
  }
  return g;
}

function karistir(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16)
    | (Math.round(ag + (bg - ag) * t) << 8)
    | Math.round(ab + (bb - ab) * t);
}
