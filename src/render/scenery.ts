import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { worldText } from './text';

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
 * Hedef bina — çok katlı atölye.
 *
 * Kat yükseklikleri level tasarımıyla uyumlu: her katın önünde yükleme açıklığı
 * var, vinç yükü buralara bırakacak.
 */
export function drawFactory(x0: number): Container {
  const c = new Container();
  const g = new Graphics();
  const w = 34;
  const floorH = 5;
  const floors = 3;
  const h = floorH * floors;

  // Gövde
  g.rect(x0, 0, w, h).fill(C.wall);
  g.rect(x0, 0, w * 0.18, h).fill({ color: C.wallShade, alpha: 0.55 });
  // Oluklu sac dokusu
  for (let x = x0 + 0.6; x < x0 + w; x += 0.85) {
    g.moveTo(x, 0.2).lineTo(x, h - 0.2)
      .stroke({ width: 0.07, color: C.wallShade, alpha: 0.45 });
  }
  // Kat döşemeleri
  for (let f = 1; f <= floors; f++) {
    g.rect(x0 - 0.35, f * floorH - 0.34, w + 0.7, 0.34).fill(C.concreteD);
    g.rect(x0 - 0.35, f * floorH - 0.34, w + 0.7, 0.1).fill({ color: C.concrete, alpha: 0.8 });
  }
  // Yükleme açıklıkları — vincin hedefleri
  for (let f = 1; f < floors; f++) {
    const y = f * floorH;
    g.rect(x0 + 2.2, y, 5.2, floorH - 0.9).fill(C.frameDark);
    g.rect(x0 + 2.2, y, 5.2, 0.28).fill({ color: C.hazardY, alpha: 0.85 });
    // Korkuluk
    for (let i = 0; i <= 5; i++) {
      g.moveTo(x0 + 2.2 + i, y).lineTo(x0 + 2.2 + i, y + 1.1)
        .stroke({ width: 0.08, color: C.chrome, alpha: 0.8 });
    }
    g.moveTo(x0 + 2.2, y + 1.1).lineTo(x0 + 7.4, y + 1.1)
      .stroke({ width: 0.1, color: C.chrome, alpha: 0.8 });
  }
  // Zemin kat kepengi
  g.rect(x0 + 2.2, 0.1, 6.5, floorH - 1.2).fill(C.frameLight);
  for (let y = 0.4; y < floorH - 1.2; y += 0.45) {
    g.moveTo(x0 + 2.3, y).lineTo(x0 + 8.6, y)
      .stroke({ width: 0.12, color: C.frameDark, alpha: 0.5 });
  }
  // Pencereler
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < 4; i++) {
      g.rect(x0 + 12 + i * 4.6, f * floorH + 1.6, 2.6, 2.2)
        .fill({ color: C.glass, alpha: 0.85 });
      g.rect(x0 + 12 + i * 4.6, f * floorH + 1.6, 2.6, 0.7)
        .fill({ color: C.glassLight, alpha: 0.4 });
    }
  }
  // Çatı
  g.rect(x0 - 0.6, h, w + 1.2, 0.55).fill(C.roof);
  g.rect(x0 - 0.6, h + 0.55, w + 1.2, 0.18).fill(C.frameDark);

  c.addChild(g);

  const sign = worldText('SANAYİ SİTESİ · 3. BLOK', 0.85, { fill: C.frameDark });
  sign.position.set(x0 + w / 2, h + 1.5);
  c.addChild(sign);
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
