import { Application, Container } from 'pixi.js';

/**
 * Pixi sahnesi ve dünya→ekran eşlemesi.
 *
 * Dünya konteyneri (PPM, -PPM) ile ölçekleniyor: fizik metre cinsinden ve +y
 * yukarı, ekran ise piksel ve +y aşağı. Bu sayede tüm çizim kodu doğrudan metre
 * kullanabiliyor.
 *
 * Bedeli: y ekseni ters çevrildiği için içerideki her şey dikeyde aynalanır.
 * Dönüşlerde açının işaretini ters çevirmek, metinlerde ise scale.y = -1 ile
 * geri çevirmek gerekiyor (bkz. flipText).
 */
export const PPM = 34;

export interface Stage {
  app: Application;
  /** Kamera ile hareket eden dünya katmanı. */
  world: Container;
  /** Kameradan bağımsız arkaplan (gökyüzü). */
  backdrop: Container;
  /** Paralaks yapan uzak katman. */
  far: Container;
}

export async function createStage(host: HTMLElement): Promise<Stage> {
  const app = new Application();
  await app.init({
    background: 0x0E1417,
    antialias: true,
    resizeTo: host,
    // DPR'ı 2'de sınırla: DPR 3'te render 2.25 kat iş, gözle fark yok,
    // kare hızı çöker.
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  host.appendChild(app.canvas);

  const backdrop = new Container();
  const far = new Container();
  const world = new Container();
  world.scale.set(PPM, -PPM);
  far.scale.set(PPM, -PPM);

  app.stage.addChild(backdrop, far, world);
  return { app, world, backdrop, far };
}

/** Ters çevrilmiş dünya katmanında metni düz göstermek için. */
export function flipText<T extends { scale: { y: number } }>(t: T): T {
  t.scale.y = -1;
  return t;
}
