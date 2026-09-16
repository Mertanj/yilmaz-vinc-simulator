import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { worldText } from './text';
import { RAF_GOZLERI, RAF_YARI, GIRIS_X, PALET_AYAK } from '../game/forkliftTasks';

/**
 * Depo dekoru.
 *
 * Vinç sahnesinde mekân bir sanayi avlusuydu; burada kapalı bir depo. Fark
 * kozmetik değil: forkliftin bütün zorluğu YATAY mesafede (yük merkezi) ve
 * DÜŞEY kotta (raf katı) olduğu için dekorun da bu iki ekseni okunur kılması
 * gerekiyor. Raf katlarının kotu fizikten okunuyor, tekrar yazılmıyor.
 */

/** Rafın çizimi — fizikteki kirişlerle aynı gözlerde ve aynı kotlarda. */
export function drawRaf(): Container {
  const c = new Container();
  const g = new Graphics();

  for (const goz of RAF_GOZLERI) {
    const ust = goz.kot + 0.9;
    // Gözün iki yanındaki dikmeler — delikli çelik profil
    for (const x of [goz.x - RAF_YARI - 0.09, goz.x + RAF_YARI + 0.09]) {
      g.rect(x - 0.09, 0, 0.18, ust).fill(C.rack);
      g.rect(x - 0.09, 0, 0.06, ust).fill({ color: C.rackLight, alpha: 0.8 });
      for (let y = 0.25; y < ust; y += 0.3) {
        g.rect(x - 0.03, y, 0.06, 0.1).fill({ color: C.rackDark, alpha: 0.85 });
      }
      g.rect(x - 0.17, 0, 0.34, 0.08).fill(C.rackDark);
    }
    // Gözün arkasındaki çaprazlar — derinlik hissi
    for (let y = 0.4; y < ust - 0.7; y += 1.0) {
      g.moveTo(goz.x - RAF_YARI, y).lineTo(goz.x + RAF_YARI, y + 0.6)
        .stroke({ width: 0.05, color: C.rackDark, alpha: 0.4 });
    }
    // Kat kirişi
    g.rect(goz.x - RAF_YARI, goz.kot - 0.16, RAF_YARI * 2, 0.16).fill(C.rack);
    g.rect(goz.x - RAF_YARI, goz.kot - 0.16, RAF_YARI * 2, 0.05)
      .fill({ color: C.rackLight, alpha: 0.9 });
    g.rect(goz.x - RAF_YARI, goz.kot - 0.04, RAF_YARI * 2, 0.04).fill(C.rackDark);
    // Arka dayanak
    g.rect(goz.x + RAF_YARI - 0.07, goz.kot, 0.14, 0.52).fill(C.rackDark);

    // Göz adresi ve kotu: depo raflarında gerçekten yazar
    const et = worldText(`${goz.ad} · ${goz.kot.toFixed(2)} m`, 0.26, { fill: 0xD6E2EA });
    et.position.set(goz.x - RAF_YARI + 0.12, goz.kot - 0.58);
    c.addChild(et);
  }

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
  // Giriş (mal kabul) kutusu: paletler buraya geliyor
  g.rect(GIRIS_X - 2.2, 0.01, 4.4, 0.07).fill({ color: C.hazardY, alpha: 0.9 });
  g.rect(GIRIS_X - 2.2, 0.01, 0.07, 1.1).fill({ color: C.hazardY, alpha: 0.9 });
  g.rect(GIRIS_X + 2.13, 0.01, 0.07, 1.1).fill({ color: C.hazardY, alpha: 0.9 });
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
