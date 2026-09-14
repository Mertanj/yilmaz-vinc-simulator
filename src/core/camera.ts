import type { Container } from 'pixi.js';
import { PPM } from '../render/stage';

/**
 * Hedefi takip eden kamera, hız yönünde öne bakışlı.
 *
 * İki hata bunun bugünkü halini şekillendirdi:
 *
 * 1. İlk sürümde geniş ölü bölge + yavaş yumuşatma vardı; kamyon 40 km/sa'e
 *    çıkınca kamera yetişemedi, araç ekrandan çıktı.
 * 2. İkinci sürümde yumuşatma kare BAŞINA sabit katsayıydı (x += d * 0.1).
 *    Bu kare hızına bağlıdır: 60 fps'te doğru, 10 fps'te kamera 11 metre
 *    geride kalıyordu. Ölçümle yakalandı — düşük kare hızında oyun bozuluyordu.
 *
 * Çözüm: zaman sabitli üstel yaklaşma. k = 1 - exp(-dt/tau) her kare hızında
 * aynı yerleşme süresini verir.
 */
export class Camera {
  x = 0;
  y = 6;

  /** Yatay yerleşme zaman sabiti (s). Küçük = daha sıkı takip. */
  private readonly tauX = 0.16;
  /** Dikey daha gevşek — süspansiyon zıplamaları kamerayı sallamasın. */
  private readonly tauY = 0.5;
  /** Hız başına öne bakış (s). Oyuncu gittiği yeri görsün. */
  private readonly lookAheadSec = 0.8;
  private readonly maxLookAhead = 9;
  /** Araç hiçbir koşulda bu kadar metreden fazla merkezden sapamaz. */
  private readonly maxOffset = 11;
  private readonly minY = 5.5;

  /**
   * @param dt gerçek kare süresi (s) — fizik adımı değil.
   */
  follow(targetX: number, targetY: number, velX: number, dt: number): void {
    const look = clamp(velX * this.lookAheadSec, -this.maxLookAhead, this.maxLookAhead);

    this.x = approach(this.x, targetX + look, this.tauX, dt);
    this.x = clamp(this.x, targetX - this.maxOffset, targetX + this.maxOffset);

    this.y = approach(this.y, Math.max(targetY, this.minY), this.tauY, dt);
    if (this.y < this.minY) this.y = this.minY;
  }

  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = Math.max(y, this.minY);
  }

  /**
   * Uzak katman yatayda daha yavaş kayar ama DİKEYDE dünyayla birebir hareket
   * eder — aksi halde uzak binalar zemin çizgisinden kopup havada yüzüyor.
   */
  apply(world: Container, far: Container, screenW: number, screenH: number): void {
    const cx = screenW / 2;
    const cy = screenH / 2;
    world.position.set(cx - this.x * PPM, cy + this.y * PPM);
    far.position.set(cx - this.x * PPM * 0.45, cy + this.y * PPM);
  }
}

/** Kare hızından bağımsız üstel yaklaşma. */
function approach(current: number, target: number, tau: number, dt: number): number {
  const k = 1 - Math.exp(-dt / Math.max(tau, 1e-4));
  return current + (target - current) * k;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
