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

  /**
   * @param teleskopikUstYapi Teleskopik vincin tablası ve bomu çizilsin mi?
   *
   * Dirsekli bom aynı kamyonu kullanıyor — şasi, kabin, kasa, toplu ayaklar
   * ortak — ama üst yapısı bambaşka: tabla kasanın en arkasında ve bom iki
   * eklemli. O yüzden gövde burada, kol takımı kendi dosyasında.
   */
  constructor(teleskopikUstYapi = true) {
    super();

    this.addChild(drawChassis(), drawCab(), drawOutriggersStowed());

    if (!teleskopikUstYapi) return;

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

  // Kasa (flatbed) — gerçek araçta uzun, krem-sarı, açılır yanaklı
  const bedFront = -0.2;
  g.rect(-L, H, L + bedFront, 0.14).fill(C.deckShade);
  g.rect(-L, H + 0.14, L + bedFront, 0.72).fill(C.deck);
  g.rect(-L, H + 0.14, L + bedFront, 0.16).fill({ color: 0xE6D9A4, alpha: 0.7 });
  g.rect(-L, H + 0.78, L + bedFront, 0.08).fill(C.deckShade);
  // Yanak dikmeleri
  for (let x = -L + 0.7; x < bedFront - 0.3; x += 1.25) {
    g.rect(x, H + 0.14, 0.12, 0.72).fill({ color: C.deckLine, alpha: 0.65 });
  }
  g.rect(-L, H + 0.14, L + bedFront, 0.72)
    .stroke({ width: 0.04, color: C.deckLine, alpha: 0.8 });

  // Yan etek paneli — ana giydirme yüzeyi. Teleskop yapmadığı için yazı burada
  // güvenle durabilir. Gerçek araçta sarı zemine kırmızı yazı.
  g.roundRect(-3.2, -H + 0.06, 5.1, H * 2 - 0.12, 0.05).fill(C.cab);
  g.rect(-3.2, -H + 0.06, 5.1, (H * 2 - 0.12) * 0.28).fill({ color: C.cabLight, alpha: 0.5 });
  g.roundRect(-3.2, -H + 0.06, 5.1, H * 2 - 0.12, 0.05)
    .stroke({ width: 0.035, color: C.cabLine, alpha: 0.8 });

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

  // Giydirme: tek satır, gerçek yazı tipi, Türkçe karakterler dahil.
  // Gerçek araçta sarı zemine kırmızı — fotoğraftan alındı.
  const logo = worldText('YILMAZ VİNÇ', 0.38, { fill: C.liveryRed, letterSpacing: 2 });
  logo.position.set(-1.35, 0.11);
  g.addChild(logo);

  // Telefon numarası — gerçek araçtaki en görünür ikinci giydirme.
  // Türk vinç kamyonlarında numara firma adı kadar önemli; fotoğrafta
  // kabin alnına kırmızıyla yazılmış.
  const tel = worldText('0532 242 94 47', 0.19, { fill: C.liveryRed, letterSpacing: 0.5 });
  tel.position.set(0.85, 0.11);
  g.addChild(tel);
  const tel2 = worldText('0212 549 54 03', 0.19, { fill: C.liveryRed, letterSpacing: 0.5 });
  tel2.position.set(0.85, -0.14);
  g.addChild(tel2);

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
  // Üst ışık ve alt gölge — hacim
  g.rect(B, T - 0.55, F - B - 0.3, 0.42).fill({ color: C.cabLight, alpha: 0.45 });
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

  // Türk bayrağı çıkartması — gerçek araçta kapıda
  g.rect(B + 0.32, 1.02, 0.46, 0.3).fill(0xFFFFFF);
  g.rect(B + 0.34, 1.04, 0.42, 0.26).fill(C.flagRed);
  g.circle(B + 0.5, 1.17, 0.075).fill(0xFFFFFF);
  g.circle(B + 0.53, 1.17, 0.062).fill(C.flagRed);

  // Kabin kapısı üstü küçük marka yazısı
  const door = worldText('YILMAZ', 0.17, { fill: C.liveryRed, letterSpacing: 1 });
  door.position.set(B + 0.95, 1.17);
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

  const cw = worldText('YILMAZ VİNÇ', 0.26, { fill: C.liveryRed, letterSpacing: 1 });
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
  for (const x of [-4.4, 3.9]) {
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
