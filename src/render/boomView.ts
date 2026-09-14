import { Container, Graphics } from 'pixi.js';
import { C } from './palette';

/**
 * Teleskopik bom — parametrik.
 *
 * Hazır sprite ile çizilemez: bom hem döner (luff) hem uzar (teleskop), yani
 * her açı × uzunluk kombinasyonu ayrı kare gerektirirdi. Bunun yerine kesitler
 * ayrı çiziliyor ve çalışma anında ötelenip döndürülüyor.
 *
 * Kritik kural: kesit sprite'ı BOYUNA ÖLÇEKLENMİYOR. Ölçeklemek uç dökümünü ve
 * ayak pimini yamultur. Her kesit kendi sabit boyunda çiziliyor, sadece
 * konumları kayıyor.
 */
export const BOOM = {
  /** Kesit boyları (m) — dipten uca. */
  sections: [9.5, 9.0, 8.6, 8.2],
  /** Kesit yükseklikleri (m) — uca doğru incelir. */
  heights: [0.98, 0.84, 0.72, 0.60],
  /** Toplam teleskop stroku (m): 9.5 toplu → 30 tam açık. */
  maxExtension: 20.5,
} as const;

export class BoomView extends Container {
  /** Bom ayağı pimine göre döner. */
  private readonly flies: Container[] = [];
  private readonly tip: Container;
  private readonly cylinder: Graphics;

  constructor() {
    super();

    // Kaldırma silindiri: krom mil + amber gövde. Bomun altında, ayağa yakın.
    this.cylinder = new Graphics();
    this.addChild(this.cylinder);

    // Kesitler: en içteki (uç) önce eklenir ki dip kesit üstte kalsın.
    for (let i = BOOM.sections.length - 1; i >= 0; i--) {
      const len = BOOM.sections[i] ?? 0;
      const h = BOOM.heights[i] ?? 0.6;
      const holder = new Container();
      holder.addChild(drawSection(len, h, i === 0));
      this.addChildAt(holder, 0);
      if (i > 0) this.flies[i - 1] = holder;
    }

    this.tip = new Container();
    this.tip.addChild(drawTip(BOOM.heights[3] ?? 0.6));
    this.addChild(this.tip);

    this.setPose(0, 0);
  }

  /**
   * @param angleDeg yataydan bom açısı (0–78)
   * @param extensionM teleskop uzaması (0–20.5)
   */
  setPose(angleDeg: number, extensionM: number): void {
    // Dünya katmanı y'yi ters çevirdiği için açının işareti ters.
    this.rotation = -(angleDeg * Math.PI) / 180;

    const e = Math.max(0, Math.min(BOOM.maxExtension, extensionM));
    const per = e / this.flies.length;
    this.flies.forEach((holder, i) => { holder.x = per * (i + 1); });

    // Uç, fizikteki bom ucuyla aynı yerde olmalı: dip kesit boyu + uzama.
    // Kesit uzunluklarından toplamak görsel olarak yakın ama fizikle kayıyor.
    this.tip.x = (BOOM.sections[0] ?? 9.5) + e;
    this.drawCylinder(angleDeg);
  }

  /** Bom ucunun, ayak pimine göre yerel konumu. */
  get tipLocal(): { x: number; y: number } {
    return { x: this.tip.x, y: 0 };
  }

  private drawCylinder(angleDeg: number): void {
    const g = this.cylinder;
    g.clear();
    // Silindir, üst yapıdaki sabit bir noktadan bomun altına bağlanır. Bom
    // açıldıkça mil uzar — burada sadece görsel yaklaşım.
    const stroke = 0.35 + (angleDeg / 78) * 1.5;
    const barrelLen = 2.6;
    const y = -0.78;
    g.roundRect(0.5, y - 0.19, barrelLen, 0.38, 0.12).fill(C.hydraulic);
    g.roundRect(0.5, y - 0.19, barrelLen, 0.13, 0.06).fill({ color: C.hydraulicL, alpha: 0.9 });
    g.roundRect(0.5 + barrelLen, y - 0.085, stroke, 0.17, 0.06).fill(C.chrome);
    g.circle(0.5, y, 0.17).fill(C.frame);
  }
}

function drawSection(len: number, h: number, isBase: boolean): Graphics {
  const g = new Graphics();
  const half = h / 2;

  // Gövde
  g.roundRect(0, -half, len, h, half * 0.28).fill(C.amber);
  // Alt gölge bandı — silindirik hacim hissi
  g.rect(0, half - h * 0.30, len, h * 0.30).fill({ color: C.amberDark, alpha: 0.85 });
  // Üst ışık bandı
  g.rect(0, -half + h * 0.06, len, h * 0.16).fill({ color: C.amberLight, alpha: 0.7 });
  // Kenar çizgisi — siluet netleşsin
  g.roundRect(0, -half, len, h, half * 0.28).stroke({ width: 0.045, color: C.frameDark, alpha: 0.85 });

  // Panel çizgileri: uzunluk hissini veren şey bu
  const step = 1.6;
  for (let x = step; x < len - 0.3; x += step) {
    g.moveTo(x, -half + 0.09).lineTo(x, half - 0.09)
      .stroke({ width: 0.03, color: C.amberDark, alpha: 0.55 });
  }

  if (isBase) {
    // Ayak pimi kulakçığı
    g.circle(0, 0, half * 0.72).fill(C.frameLight);
    g.circle(0, 0, half * 0.34).fill(C.frameDark);
  }
  return g;
}

function drawTip(h: number): Graphics {
  const g = new Graphics();
  // Uç makarası (sheave) — halat buradan iner
  g.roundRect(-0.42, -h * 0.62, 0.84, h * 1.24, 0.12).fill(C.amberDark);
  g.circle(0.12, 0, h * 0.46).fill(C.chrome);
  g.circle(0.12, 0, h * 0.30).fill(C.frame);
  g.circle(0.12, 0, h * 0.10).fill(C.chrome);
  return g;
}
