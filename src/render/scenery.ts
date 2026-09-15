import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { worldText } from './text';
import { FACTORY } from '../sim/world';

/** Gökyüzü — ekran uzayında, kameradan bağımsız. Bantlı geçiş. */
export function drawSky(width: number, height: number): Graphics {
  const g = new Graphics();
  const bands = 14;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    g.rect(0, (height * i) / bands - 1, width, height / bands + 2)
      .fill({ color: mix(C.sky, C.skyLow, t) });
  }
  return g;
}

/**
 * Uzak sanayi hattı.
 *
 * İlk sürümde 30 m genişliğinde dev bloklar çiziyordu ve gri levhalar gibi
 * duruyordu. Şimdi daha alçak, daha dar, puslu ve çatı/baca detaylı — mesafe
 * hissi renk kontrastının düşmesinden geliyor, boyuttan değil.
 */
export function drawFarSkyline(): Container {
  const c = new Container();
  const g = new Graphics();
  const seed = mulberry(11);
  let x = -80;
  while (x < 240) {
    const w = 5 + seed() * 9;
    const h = 4.5 + seed() * 7;
    // Uzaklaştıkça gökyüzüne karışır
    const haze = 0.45 + seed() * 0.12;
    const body = mix(C.roof, C.sky, haze);
    g.rect(x, 0, w, h).fill(body);
    // Testere çatı — sanayi yapısının imzası
    const teeth = Math.max(1, Math.round(w / 2.6));
    for (let i = 0; i < teeth; i++) {
      const tx = x + (i * w) / teeth;
      g.poly([tx, h, tx + w / teeth, h, tx + w / teeth, h + 0.9]).fill(body);
    }
    // Baca
    if (seed() > 0.72) {
      const cx = x + w * (0.3 + seed() * 0.4);
      const ch = 3 + seed() * 6;
      g.rect(cx, h, 0.8, ch).fill(body);
      g.rect(cx - 0.14, h + ch, 1.08, 0.35).fill(mix(body, C.frameDark, 0.25));
    }
    // Pencere sırası — sadece ipucu
    for (let wy = 1.2; wy < h - 0.8; wy += 1.8) {
      g.rect(x + 0.6, wy, w - 1.2, 0.5)
        .fill({ color: mix(body, C.frameDark, 0.22), alpha: 0.7 });
    }
    x += w + 1 + seed() * 4;
  }
  c.addChild(g);
  return c;
}

/** Beton saha zemini. */
export function drawGround(left: number, right: number): Graphics {
  const g = new Graphics();
  const w = right - left;
  g.rect(left, -14, w, 14).fill(C.ground);
  g.rect(left, -0.32, w, 0.32).fill(C.concrete);

  // Beton derzleri
  for (let x = left; x < right; x += 4) {
    g.moveTo(x, 0).lineTo(x, -0.3).stroke({ width: 0.06, color: C.groundLine, alpha: 0.75 });
  }
  // Yıpranma lekeleri — deterministik
  const seed = mulberry(23);
  for (let i = 0; i < 90; i++) {
    const x = left + seed() * w;
    const pw = 0.8 + seed() * 3.2;
    g.rect(x, -0.3, pw, 0.3).fill({ color: C.concreteD, alpha: 0.18 + seed() * 0.22 });
  }
  // Solmuş park yeri boyası — saha gerçekten kullanılıyormuş gibi dursun
  for (let i = 0; i < 7; i++) {
    const x = 16 + i * 3.6;
    g.rect(x, -0.26, 0.16, 0.26).fill({ color: C.hazardY, alpha: 0.4 });
  }
  // Vinç kurulum alanı işareti
  g.rect(34, -0.3, 0.18, 0.3).fill({ color: C.hazardY, alpha: 0.75 });
  g.rect(50, -0.3, 0.18, 0.3).fill({ color: C.hazardY, alpha: 0.75 });
  g.moveTo(left, 0).lineTo(right, 0).stroke({ width: 0.08, color: C.concreteD });
  return g;
}

/**
 * Hedef bina — kademeli çok katlı atölye.
 *
 * Her kademe 4.5 m geri çekiliyor; altındakinin çatısı üsttekinin yükleme
 * terası oluyor. Vinç yükü bu teraslara bırakıyor.
 */
export function drawFactory(x0: number): Container {
  const c = new Container();
  const g = new Graphics();
  // Ölçüler FABRİKA sabitinden okunuyor. Bir ara burada kopyaları duruyordu ve
  // bina beş kata çıkarıldığında çizim üç katta kaldı: çarpışma gövdesi ile
  // görüntü ayrı şeyler anlatıyordu.
  const { right, setback, floorHeight: floorH, floors, parapetHeight } = FACTORY;

  for (let f = floors - 1; f >= 0; f--) {
    const left = x0 + setback * f;
    const top = floorH * (f + 1);
    const w = right - left;
    const shade = f === 0 ? 1 : 0.94 + f * 0.03;

    g.rect(left, 0, w, top).fill(mix(C.wall, 0xFFFFFF, (shade - 1) * 2));
    g.rect(left, 0, 1.1, top).fill({ color: C.wallShade, alpha: 0.5 });
    // Oluklu sac
    for (let x = left + 0.7; x < right; x += 0.9) {
      g.moveTo(x, 0.2).lineTo(x, top - 0.2)
        .stroke({ width: 0.07, color: C.wallShade, alpha: 0.4 });
    }
    // Kat döşemesi / teras plakası
    g.rect(left - 0.4, top - 0.36, w + 0.8, 0.36).fill(C.concreteD);
    g.rect(left - 0.4, top - 0.36, w + 0.8, 0.1).fill({ color: C.concrete, alpha: 0.85 });

    // Terasa açılan yükleme kapısı
    if (f > 0) {
      const dx = left + 1.0;
      const dw = Math.min(4.2, right - left - 1.6);
      g.rect(dx, floorH * f, dw, floorH - 0.9).fill(C.frameDark);
      g.rect(dx, floorH * f, dw, 0.26).fill({ color: C.hazardY, alpha: 0.85 });
    }
    // Pencereler
    for (let i = 0; i < Math.floor((w - 9) / 4.6); i++) {
      g.rect(left + 7.5 + i * 4.6, floorH * f + 1.2, 2.5, floorH * 0.42)
        .fill({ color: C.glass, alpha: 0.85 });
      g.rect(left + 7.5 + i * 4.6, floorH * f + 1.2, 2.5, 0.55)
        .fill({ color: C.glassLight, alpha: 0.4 });
    }
    // Korkuluk — teras kadar uzun.
    if (f < floors - 1) {
      const px = x0 + setback * f;
      g.rect(px, top, 0.24, parapetHeight).fill(C.chrome);
      const n = Math.max(2, Math.round(setback / 0.95));
      for (let i = 1; i <= n; i++) {
        g.rect(px + (i * setback) / (n + 1), top, 0.1, parapetHeight)
          .fill({ color: C.chrome, alpha: 0.85 });
      }
      g.rect(px, top + parapetHeight - 0.08, setback, 0.12).fill(C.chrome);
    }
  }

  // Zemin kat kepengi
  g.rect(x0 + 2.2, 0.1, 6.5, floorH - 1.0).fill(C.frameLight);
  for (let y = 0.4; y < floorH - 1.0; y += 0.45) {
    g.moveTo(x0 + 2.3, y).lineTo(x0 + 8.6, y)
      .stroke({ width: 0.12, color: C.frameDark, alpha: 0.5 });
  }

  c.addChild(g);
  const sign = worldText('SANAYİ SİTESİ · C BLOK', 0.8, { fill: C.frameDark });
  sign.position.set(x0 + 16, floorH * floors + 1.4);
  c.addChild(sign);
  return c;
}

/** Beton tekerlek takozu. */
export function drawKerb(x: number): Graphics {
  const g = new Graphics();
  g.roundRect(x - 0.35, 0, 0.7, 0.68, 0.07).fill(C.concrete);
  g.rect(x - 0.35, 0, 0.7, 0.16).fill({ color: 0xA7AEB2, alpha: 0.8 });
  g.rect(x - 0.35, 0.52, 0.7, 0.16).fill({ color: C.concreteD, alpha: 0.9 });
  for (let i = 0; i < 3; i++) {
    g.rect(x - 0.3 + i * 0.22, 0.2, 0.1, 0.3).fill({ color: C.hazardY, alpha: 0.85 });
  }
  return g;
}

/**
 * Kurulum alanı işareti.
 *
 * Level tasarımında yasal park penceresi sadece 99 santim: arkadan fosseptik
 * döşemesi ayağı reddediyor, önden karşı ağırlığın kuyruğu sundurma kolonuna
 * çarpıyor. Oyuncuya pencereyi göstermek şart, yoksa bunu tahmin etmesi
 * imkânsız olurdu.
 */
export function drawSetupZone(centreX: number): Container {
  const c = new Container();
  const g = new Graphics();
  const halfW = 5.2;
  g.rect(centreX - halfW, -0.28, halfW * 2, 0.28).fill({ color: C.hazardY, alpha: 0.22 });
  // Kenar çizgileri
  for (const x of [centreX - halfW, centreX + halfW]) {
    g.rect(x - 0.09, -0.3, 0.18, 0.3).fill({ color: C.hazardY, alpha: 0.9 });
    g.rect(x - 0.09, 0, 0.18, 1.5).fill({ color: C.hazardY, alpha: 0.55 });
  }
  // Tarama
  for (let x = centreX - halfW + 0.6; x < centreX + halfW; x += 1.2) {
    g.moveTo(x, -0.26).lineTo(x + 0.5, -0.02)
      .stroke({ width: 0.09, color: C.hazardY, alpha: 0.45 });
  }
  c.addChild(g);
  // Yazı yere değil YUKARI yazılıyor: kamyon tam bu alana park ediyor, 2.1
  // metrede kalan etiketin yarısı kasanın arkasında kalıp "LANI" diye okunuyordu.
  const t = worldText('KURULUM ALANI', 0.62, { fill: C.hazardY });
  t.position.set(centreX, 6.4);
  t.alpha = 0.7;
  c.addChild(t);
  return c;
}

/** Giriş tabelası — kamyonun geldiği taraf. */
export function drawEntranceSign(x: number): Container {
  const c = new Container();
  const g = new Graphics();
  g.rect(x - 0.16, 0, 0.32, 5.2).fill(C.frameDark);
  g.roundRect(x - 4.2, 5.2, 8.4, 2.2, 0.18).fill(C.frame);
  g.roundRect(x - 4.05, 5.35, 8.1, 1.9, 0.14).fill(C.amber);
  c.addChild(g);
  const t = worldText('YILMAZ VİNÇ', 1.15, { fill: C.frameDark, letterSpacing: 3 });
  t.position.set(x, 6.3);
  c.addChild(t);
  return c;
}

export function drawPropBox(hw: number, hh: number): Graphics {
  const g = new Graphics();
  g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.06).fill(C.rust);
  g.rect(-hw, -hh, hw * 2, hh * 0.5).fill({ color: 0xA06E4A, alpha: 0.8 });
  g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.06)
    .stroke({ width: 0.04, color: C.frameDark, alpha: 0.8 });
  g.moveTo(-hw + 0.08, 0).lineTo(hw - 0.08, 0)
    .stroke({ width: 0.05, color: C.frameDark, alpha: 0.5 });
  return g;
}

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16)
    | (Math.round(ag + (bg - ag) * t) << 8)
    | Math.round(ab + (bb - ab) * t);
}

/** Deterministik sözde-rastgele; siluet her açılışta aynı olsun. */
function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
