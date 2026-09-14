import { Graphics } from 'pixi.js';
import { C } from './palette';

/**
 * Ayakların görünümü. Kızak ve pabuç, şasi bağlantısı ile pabuç gövdesi
 * arasına çiziliyor — fizikle görüntünün ayrışması bu sayede imkânsız.
 *
 * **Neden kirli-bayrak var:** ilk sürüm her karede clear() + yeniden çiziyordu.
 * PixiJS'in kendi performans notu bunu açıkça uyarıyor — clear/rebuild CPU'da
 * geometriyi yeniden üçgenliyor. Ayaklar açılırken zaten hareket ediyor, ama
 * oyunun büyük kısmı araç park halinde ve ayaklar sabitken geçiyor; o durumda
 * yeniden çizim tamamen israf. Uç noktalar kayda değer şekilde oynamadıkça
 * çizimi atlıyoruz.
 */
const EPSILON = 0.004; // metre

export class OutriggerView extends Graphics {
  private lastGeometry: number[] = [];

  update(legs: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>): void {
    const flat: number[] = [];
    for (const leg of legs) flat.push(leg.from.x, leg.from.y, leg.to.x, leg.to.y);

    if (flat.length === this.lastGeometry.length) {
      let moved = false;
      for (let i = 0; i < flat.length; i++) {
        if (Math.abs((flat[i] ?? 0) - (this.lastGeometry[i] ?? 0)) > EPSILON) { moved = true; break; }
      }
      if (!moved) return;
    }
    this.lastGeometry = flat;

    this.clear();
    for (const leg of legs) {
      const dx = leg.to.x - leg.from.x;
      const dy = leg.to.y - leg.from.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.05) continue;
      const ux = dx / len;
      const uy = dy / len;
      // Dik normal — kızak kalınlığı için
      const nx = -uy;
      const ny = ux;

      const outer = 0.19;
      const inner = 0.12;
      // Dış kızak (şasiden çıkan kalın kutu)
      quad(this, leg.from, ux, uy, nx, ny, len * 0.55, outer, C.frameDark);
      // İç mil — daha ince, krom
      quad(this, leg.from, ux, uy, nx, ny, len, inner, C.chrome);
      quad(this, leg.from, ux, uy, nx, ny, len * 0.55, outer, C.frameDark);
      // Üst ışık bandı
      this.moveTo(leg.from.x + nx * outer * 0.5, leg.from.y + ny * outer * 0.5)
        .lineTo(leg.from.x + ux * len * 0.55 + nx * outer * 0.5,
                leg.from.y + uy * len * 0.55 + ny * outer * 0.5)
        .stroke({ width: 0.06, color: C.frameLight, alpha: 0.7 });

      // Pabuç
      this.roundRect(leg.to.x - 0.46, leg.to.y - 0.11, 0.92, 0.22, 0.05).fill(C.hazardY);
      this.roundRect(leg.to.x - 0.46, leg.to.y - 0.11, 0.92, 0.22, 0.05)
        .stroke({ width: 0.04, color: C.frameDark, alpha: 0.9 });
      this.rect(leg.to.x - 0.3, leg.to.y - 0.02, 0.6, 0.06)
        .fill({ color: C.hazardK, alpha: 0.55 });
    }
  }
}

function quad(
  g: Graphics,
  from: { x: number; y: number },
  ux: number, uy: number, nx: number, ny: number,
  len: number, halfW: number, color: number,
): void {
  g.poly([
    from.x + nx * halfW, from.y + ny * halfW,
    from.x + ux * len + nx * halfW, from.y + uy * len + ny * halfW,
    from.x + ux * len - nx * halfW, from.y + uy * len - ny * halfW,
    from.x - nx * halfW, from.y - ny * halfW,
  ]).fill(color);
}
