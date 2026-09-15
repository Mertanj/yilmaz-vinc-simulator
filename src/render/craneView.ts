import { Graphics } from 'pixi.js';
import { C } from './palette';

/**
 * Halat ve kanca bloğu.
 *
 * Halat her karede yeniden çiziliyor — burada kirli-bayrak yok, çünkü halat
 * gerçekten her karede değişiyor (sarkaç salınıyor, vinç boy veriyor).
 *
 * Çelik halat tek gri çizgi olarak çizilirse iplik gibi durur. Üç kat üst üste:
 * koyu kalın, orta, ve bir piksel yukarı kaydırılmış açık ince — bükümlü çelik
 * halat izlenimi böyle çıkıyor.
 */
export class CableView extends Graphics {
  update(from: { x: number; y: number }, to: { x: number; y: number }): void {
    this.clear();
    this.moveTo(from.x, from.y).lineTo(to.x, to.y)
      .stroke({ width: 0.11, color: 0x1E2226 });
    this.moveTo(from.x, from.y).lineTo(to.x, to.y)
      .stroke({ width: 0.07, color: 0x4A5259 });
    this.moveTo(from.x + 0.02, from.y + 0.02).lineTo(to.x + 0.02, to.y + 0.02)
      .stroke({ width: 0.03, color: 0x8A949B, alpha: 0.8 });
  }
}

export function drawHookBlock(): Graphics {
  const g = new Graphics();
  // Yerel +y dünyada YUKARI: çengel NEGATİF y'de olmalı. Bir ara yukarı
  // bakıyordu, yani kanca ters duruyordu ve yükü tuttuğu nokta (grabPoint,
  // merkezin 0.46 m altı) çizimle uyuşmuyordu.
  //
  // Makara gövdesi — halatın bağlandığı üst kısım
  g.roundRect(-0.3, -0.16, 0.6, 0.5, 0.08).fill(C.hydraulic);
  g.rect(-0.3, 0.2, 0.6, 0.14).fill({ color: C.hydraulicL, alpha: 0.9 });
  g.circle(-0.12, 0.08, 0.1).fill(C.chrome);
  g.circle(0.12, 0.08, 0.1).fill(C.chrome);
  // Çengel — siluetini belirgin tut, küçük ölçekte okunması gereken şey bu
  g.moveTo(0, -0.16).lineTo(0, -0.36)
    .stroke({ width: 0.12, color: C.chrome, cap: 'round' });
  g.arc(0, -0.46, 0.16, Math.PI * 1.15, Math.PI * 1.85, false)
    .stroke({ width: 0.11, color: C.chrome, cap: 'round' });
  // Emniyet mandalı
  g.moveTo(-0.13, -0.42).lineTo(0.1, -0.52)
    .stroke({ width: 0.04, color: C.chrome, alpha: 0.75 });
  return g;
}

/** Sapanlı makine kasası — bölümdeki yük. */
export function drawMachineLoad(hw: number, hh: number): Graphics {
  const g = new Graphics();
  g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.06).fill(0x9C2B26);
  g.rect(-hw, -hh, hw * 2, hh * 0.4).fill({ color: 0xC24138, alpha: 0.8 });
  g.rect(-hw, hh - hh * 0.35, hw * 2, hh * 0.35).fill({ color: 0x6E1C19, alpha: 0.85 });
  g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.06)
    .stroke({ width: 0.05, color: 0x2A1210, alpha: 0.9 });
  // Kumanda paneli ve havalandırma — CNC tezgâhı gibi okunsun
  g.roundRect(hw * 0.28, -hh * 0.55, hw * 0.5, hh * 0.6, 0.04).fill(0x1B2126);
  g.roundRect(hw * 0.34, -hh * 0.46, hw * 0.38, hh * 0.34, 0.03).fill(0x4E7F86);
  for (let i = 0; i < 4; i++) {
    g.rect(-hw * 0.78, -hh * 0.5 + i * hh * 0.22, hw * 0.5, hh * 0.09)
      .fill({ color: 0x6E1C19, alpha: 0.7 });
  }
  // Kaldırma mapaları — yükün ÜSTÜNDE (+y dünyada yukarı)
  g.circle(-hw * 0.6, hh, 0.09).stroke({ width: 0.05, color: C.chrome });
  g.circle(hw * 0.6, hh, 0.09).stroke({ width: 0.05, color: C.chrome });
  return g;
}
