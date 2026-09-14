import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { worldText } from './text';
import { BoomView } from './boomView';

/**
 * YV-25'in görünümü — tamamı prosedürel vektör.
 *
 * Piksel sprite yerine kodla çizmenin üç somut kazancı var: çözünürlükten
 * bağımsız (her zumda net), renk anında değişir, ve giydirme gerçek yazı
 * tipiyle basılabilir — 41×8 piksellik okunabilirlik kısıtı ortadan kalkar.
 */
export const RIG = {
  halfLength: 4.8,
  halfHeight: 0.42,
  cabFront: 4.8,
  cabBack: 2.2,
  cabTop: 2.52,
  /** Bom ayağı pimi, şasi merkezine göre. */
  boomFoot: { x: -0.8, y: 2.42 },
  stowedAngleDeg: 11,
  deckTop: 0.42,
} as const;

export class TruckView extends Container {
  /** Slew yapan üst yapı: tabla, karşı ağırlık ve bom birlikte döner. */
  readonly superstructure = new Container();
  readonly boom = new BoomView();

  constructor() {
    super();

    this.addChild(drawChassis(), drawCab(), drawOutriggersStowed());

    this.superstructure.position.set(RIG.boomFoot.x, RIG.deckTop);
    this.superstructure.addChild(drawSuperstructure());

    this.boom.position.set(0, RIG.boomFoot.y - RIG.deckTop);
    this.boom.setPose(RIG.stowedAngleDeg, 0);
    this.superstructure.addChild(this.boom);

    this.addChild(this.superstructure);
  }
}

function drawChassis(): Graphics {
  const g = new Graphics();
  const { halfLength: L, halfHeight: H } = RIG;

  // Ana şasi kirişi
  g.rect(-L, -H, L * 2, H * 2).fill(C.frame);
  g.rect(-L, -H, L * 2, H * 0.42).fill({ color: C.frameLight, alpha: 0.9 });
  g.rect(-L, H - H * 0.35, L * 2, H * 0.35).fill({ color: C.frameDark, alpha: 0.9 });

  // Güverte plakası
  g.rect(-L, H, L * 2 - 2.6, 0.16).fill(C.frameLight);
  for (let x = -L + 0.5; x < L - 2.8; x += 0.62) {
    g.moveTo(x, H + 0.02).lineTo(x + 0.3, H + 0.14)
      .stroke({ width: 0.05, color: C.frameDark, alpha: 0.5 });
  }

  // Yan etek paneli — ana giydirme yüzeyi. Teleskop yapmadığı için yazı burada
  // güvenle durabilir.
  g.roundRect(-3.2, -H + 0.06, 5.1, H * 2 - 0.12, 0.06).fill(C.frameDark);
  g.roundRect(-3.2, -H + 0.06, 5.1, H * 2 - 0.12, 0.06)
    .stroke({ width: 0.035, color: C.frameLight, alpha: 0.6 });

  // Çamurluklar
  for (const x of [-2.2, -3.5]) {
    g.roundRect(x - 0.78, -H - 0.05, 1.56, 0.3, 0.1).fill(C.frameDark);
  }
  g.roundRect(3.4 - 0.78, -H - 0.05, 1.56, 0.3, 0.1).fill(C.frameDark);

  // Tehlike şeridi — arka tampon
  for (let i = 0; i < 5; i++) {
    g.rect(-L - 0.18, -H + i * 0.17, 0.18, 0.085).fill(C.hazardY);
    g.rect(-L - 0.18, -H + i * 0.17 + 0.085, 0.18, 0.085).fill(C.hazardK);
  }

  // Giydirme: tek satır, gerçek yazı tipi, Türkçe karakterler dahil
  const logo = worldText('YILMAZ VİNÇ', 0.44, { fill: C.hazardY, letterSpacing: 2 });
  logo.position.set(-0.65, 0);
  g.addChild(logo);

  return g;
}

function drawCab(): Graphics {
  const g = new Graphics();
  const { cabFront: F, cabBack: B, cabTop: T, halfHeight: H } = RIG;

  // Gövde
  g.moveTo(B, H)
    .lineTo(B, T)
    .lineTo(F - 0.55, T)
    .lineTo(F, T - 0.85)
    .lineTo(F, H)
    .closePath()
    .fill(C.cab);
  // Alt gölge
  g.rect(B, H, F - B, 0.34).fill(C.cabShade);
  // Kontur
  g.moveTo(B, H).lineTo(B, T).lineTo(F - 0.55, T).lineTo(F, T - 0.85).lineTo(F, H)
    .closePath().stroke({ width: 0.045, color: C.cabLine, alpha: 0.9 });

  // Ön cam — üstte açık, altta koyu
  g.moveTo(F - 0.5, T - 0.16)
    .lineTo(F - 0.14, T - 0.82)
    .lineTo(F - 0.14, 1.42)
    .lineTo(F - 1.5, 1.42)
    .lineTo(F - 1.5, T - 0.16)
    .closePath()
    .fill(C.glass);
  g.moveTo(F - 1.5, T - 0.16).lineTo(F - 0.5, T - 0.16).lineTo(F - 0.32, T - 0.5)
    .lineTo(F - 1.5, T - 0.5).closePath().fill({ color: C.glassLight, alpha: 0.55 });

  // Kapı camı ve kapı hattı
  g.roundRect(B + 0.28, 1.5, 1.05, T - 1.72, 0.05).fill(C.glass);
  g.moveTo(B + 0.16, H + 0.1).lineTo(B + 0.16, T - 0.1)
    .stroke({ width: 0.04, color: C.cabLine });
  g.moveTo(B + 1.5, H + 0.1).lineTo(B + 1.5, T - 0.1)
    .stroke({ width: 0.04, color: C.cabLine });
  g.circle(B + 1.3, 1.28, 0.08).fill(C.chrome);

  // Ayna ve far
  g.rect(F - 0.06, T - 1.15, 0.26, 0.06).fill(C.frameDark);
  g.roundRect(F + 0.18, T - 1.35, 0.1, 0.3, 0.04).fill(C.frameDark);
  g.roundRect(F - 0.12, H + 0.14, 0.14, 0.26, 0.05).fill(0xFFE9A8);

  // Kapıdaki küçük logo
  const door = worldText('YILMAZ VİNÇ', 0.2, { fill: C.frame, letterSpacing: 1 });
  door.position.set(B + 0.83, 1.05);
  g.addChild(door);

  // Kabin üstü bom yatağı
  g.roundRect(F - 1.9, T, 0.5, 0.66, 0.06).fill(C.frameDark);

  return g;
}

function drawSuperstructure(): Graphics {
  const g = new Graphics();
  // Konum: bom ayağının altı. Yerel (0,0) = güverte üstü, bom pimi hizası.
  const top = RIG.boomFoot.y - RIG.deckTop;

  // Döner tabla plakası
  g.roundRect(-1.9, -0.12, 3.3, 0.3, 0.08).fill(C.frameLight);
  g.circle(0, 0, 0.42).fill(C.frame);
  g.circle(0, 0, 0.2).fill(C.frameDark);

  // Üst yapı gövdesi (motor/vinç mahfazası)
  g.roundRect(-1.85, 0.14, 2.2, top - 0.05, 0.12).fill(C.amber);
  g.rect(-1.85, 0.14, 2.2, (top - 0.05) * 0.22).fill({ color: C.amberDark, alpha: 0.7 });
  g.rect(-1.85, top - 0.35, 2.2, 0.16).fill({ color: C.amberLight, alpha: 0.6 });
  g.roundRect(-1.85, 0.14, 2.2, top - 0.05, 0.12)
    .stroke({ width: 0.045, color: C.frameDark, alpha: 0.8 });

  // Vinç tamburu
  g.circle(-0.85, top * 0.62, 0.38).fill(C.frameDark);
  g.circle(-0.85, top * 0.62, 0.24).fill(C.chrome);

  // Karşı ağırlık
  g.roundRect(-4.05, 0.1, 2.0, top + 0.2, 0.08).fill(C.amberDark);
  for (let i = 0; i < 4; i++) {
    g.moveTo(-3.95 + i * 0.46, 0.2).lineTo(-3.95 + i * 0.46, top + 0.2)
      .stroke({ width: 0.06, color: C.frameDark, alpha: 0.45 });
  }
  g.roundRect(-4.05, 0.1, 2.0, top + 0.2, 0.08)
    .stroke({ width: 0.045, color: C.frameDark, alpha: 0.8 });

  const cw = worldText('YILMAZ VİNÇ', 0.26, { fill: C.hazardY, letterSpacing: 1 });
  cw.position.set(-3.05, top * 0.62);
  g.addChild(cw);

  // Operatör kabini (üst yapıda, bomun sağında)
  g.roundRect(0.45, 0.14, 1.0, top * 0.92, 0.1).fill(C.cab);
  g.roundRect(0.56, 0.34, 0.78, top * 0.56, 0.06).fill(C.glass);
  g.roundRect(0.45, 0.14, 1.0, top * 0.92, 0.1)
    .stroke({ width: 0.04, color: C.cabLine, alpha: 0.9 });

  return g;
}

/** Toplu haldeki outrigger kutuları. Sprint 2'de açılır hale gelecek. */
function drawOutriggersStowed(): Graphics {
  const g = new Graphics();
  for (const x of [-4.3, 1.35]) {
    g.roundRect(x - 0.5, -0.34, 1.0, 0.62, 0.06).fill(C.frameDark);
    g.rect(x - 0.42, -0.26, 0.84, 0.12).fill({ color: C.frameLight, alpha: 0.7 });
    // Pabuç
    g.roundRect(x - 0.34, 0.2, 0.68, 0.14, 0.04).fill(C.hazardY);
  }
  return g;
}

export function drawWheel(radius: number): Graphics {
  const g = new Graphics();
  g.circle(0, 0, radius).fill(C.tyre);
  g.circle(0, 0, radius).stroke({ width: 0.05, color: C.frameDark });
  // Diş izi
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.moveTo(Math.cos(a) * radius * 0.86, Math.sin(a) * radius * 0.86)
      .lineTo(Math.cos(a) * radius * 0.99, Math.sin(a) * radius * 0.99)
      .stroke({ width: 0.09, color: C.tyreLight });
  }
  g.circle(0, 0, radius * 0.56).fill(C.rim);
  g.circle(0, 0, radius * 0.56).stroke({ width: 0.04, color: C.frameDark, alpha: 0.7 });
  // Bijon çemberi — dönüşü görünür kılan şey bu
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.circle(Math.cos(a) * radius * 0.36, Math.sin(a) * radius * 0.36, radius * 0.07)
      .fill(C.frameDark);
  }
  g.circle(0, 0, radius * 0.17).fill(C.frameDark);
  return g;
}

/** Zeminle temas gölgesi — aracı yere oturtan detay. */
export function drawContactShadow(halfWidth: number): Graphics {
  const g = new Graphics();
  g.ellipse(0, 0, halfWidth, 0.22).fill({ color: C.shadow, alpha: 0.38 });
  g.ellipse(0, 0, halfWidth * 0.7, 0.14).fill({ color: C.shadow, alpha: 0.3 });
  return g;
}
