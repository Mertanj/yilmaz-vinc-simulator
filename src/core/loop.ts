/**
 * Sabit zaman adımlı oyun döngüsü, interpolasyonlu.
 *
 * planck'in kendi tavsiyesi: sabit adım, 1/60 s, 10 hız / 8 konum iterasyonu.
 * Kritik kural — "küçük zaman adımını yüksek iterasyon sayısına takas etmeyin;
 * 60 Hz ve 10 iterasyon, 30 Hz ve 20 iterasyondan çok daha iyidir."
 *
 * İnterpolasyon burada özellikle önemli: 60 Hz'de simüle edilip 120 Hz'de
 * çizilen bir sarkaç, interpolasyonsuz gözle görülür şekilde titrer.
 */
import { SIM } from '../sim/world';

export class FixedLoop {
  /** Kare süresi bunu aşarsa kırpılır — "spiral of death" koruması. */
  private static readonly MAX_FRAME = 0.25;

  private accumulator = 0;
  private last = 0;
  private running = false;
  private rafId = 0;

  constructor(
    private readonly onStep: (dt: number) => void,
    private readonly onRender: (alpha: number, frameDt: number) => void,
    readonly dt: number = 1 / SIM.hz,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    let frameTime = (now - this.last) / 1000;
    this.last = now;
    if (frameTime > FixedLoop.MAX_FRAME) frameTime = FixedLoop.MAX_FRAME;
    this.accumulator += frameTime;

    while (this.accumulator >= this.dt) {
      this.onStep(this.dt);
      this.accumulator -= this.dt;
    }

    this.onRender(this.accumulator / this.dt, frameTime);
  };
}
