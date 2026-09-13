/**
 * Vinç kinematiği ve sarkaç matematiği. Yine motor bağımsız saf fonksiyonlar.
 */

import { G } from './loadChart';

/** YV-25 geometri sabitleri (metre, derece). */
export const CRANE_SPEC = {
  /** Döner tabla merkezinden bom ayağına yatay ofset. */
  pivotOffsetM: 0.6,
  /** Bom ayağının yerden yüksekliği. */
  pivotHeightM: 2.2,
  boomMinM: 9.5,
  boomMaxM: 30.0,
  boomMinAngleDeg: 0,
  boomMaxAngleDeg: 78,
  hookBlockTonnes: 0.25,
  machineTonnes: 24,
  /** Halatın sarılma/salınma hızı (m/s). */
  winchSpeedMps: 1.2,
  /** Teleskop açılma hızı (m/s). */
  telescopeSpeedMps: 0.8,
  /** Bom kaldırma hızı (derece/s). */
  luffSpeedDegPerSec: 4.0,
} as const;

export interface BoomState {
  /** Anlık bom uzunluğu (m). */
  lengthM: number;
  /** Yataydan bom açısı (derece). */
  angleDeg: number;
  /** Bom ucundan kancaya halat boyu (m). */
  ropeM: number;
}

/** Çalışma yarıçapı: R = d_pivot + L·cos(θ) */
export function workingRadius(boom: BoomState): number {
  return CRANE_SPEC.pivotOffsetM + boom.lengthM * Math.cos(toRad(boom.angleDeg));
}

/** Bom ucunun yerden yüksekliği. */
export function boomTipHeight(boom: BoomState): number {
  return CRANE_SPEC.pivotHeightM + boom.lengthM * Math.sin(toRad(boom.angleDeg));
}

/** Kancanın (salınım yokken) yerden yüksekliği. */
export function hookHeight(boom: BoomState): number {
  return boomTipHeight(boom) - boom.ropeM;
}

/** Bom ucunun dünya koordinatı, döner tabla merkezine göre. */
export function boomTipPosition(boom: BoomState): { x: number; y: number } {
  return { x: workingRadius(boom), y: boomTipHeight(boom) };
}

/**
 * Sarkaç periyodu: T = 2π·√(l/g)
 * Halat 4 m → 4.01 s. Oyuncunun salınımı söndürme temposu bu.
 */
export function pendulumPeriod(ropeLengthM: number): number {
  return 2 * Math.PI * Math.sqrt(Math.max(ropeLengthM, 0.01) / G);
}

/**
 * Anti-sway ipucu: tam bir periyot boyunca ivmelenmek salınımı yok eder.
 * HUD'da oyuncuya gösterilecek "güvenli hareket süresi".
 */
export function antiSwayWindow(ropeLengthM: number): number {
  return pendulumPeriod(ropeLengthM);
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;
