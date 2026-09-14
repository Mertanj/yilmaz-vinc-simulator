import { World, Edge, Box, Vec2, type Body } from 'planck';

/** Yerçekimi ve simülasyon sabitleri. Her şey MKS: metre, kilogram, saniye. */
export const SIM = {
  gravity: -9.81,
  velocityIterations: 10,
  positionIterations: 8,
  /** Zeminin sol ve sağ sınırı (m). */
  groundLeft: -60,
  groundRight: 160,
} as const;

/**
 * Render interpolasyonu için önceki adımın gövde dönüşümlerini saklar.
 *
 * 60 Hz'de simüle edip 120 Hz'de çizersek, interpolasyon olmadan hareket
 * gözle görülür şekilde titrer.
 */
export class Snapshotter {
  private readonly prev = new Map<Body, { x: number; y: number; a: number }>();

  track(body: Body): Body {
    const p = body.getPosition();
    this.prev.set(body, { x: p.x, y: p.y, a: body.getAngle() });
    return body;
  }

  /** Her fizik adımından ÖNCE çağrılır. */
  capture(): void {
    for (const [body, slot] of this.prev) {
      const p = body.getPosition();
      slot.x = p.x;
      slot.y = p.y;
      slot.a = body.getAngle();
    }
  }

  /** alpha 0..1 — önceki adımla şimdiki adım arası. */
  interpolate(body: Body, alpha: number): { x: number; y: number; a: number } {
    const now = body.getPosition();
    const angle = body.getAngle();
    const old = this.prev.get(body);
    if (!old) return { x: now.x, y: now.y, a: angle };
    return {
      x: old.x + (now.x - old.x) * alpha,
      y: old.y + (now.y - old.y) * alpha,
      // Açıyı en kısa yoldan harmanla, yoksa ±π sınırında sıçrar.
      a: old.a + shortestAngle(old.a, angle) * alpha,
    };
  }
}

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(): World {
  return new World({ x: 0, y: SIM.gravity });
}

/** Sanayi sitesi avlusu — düz beton. */
export function createGround(world: World): Body {
  const ground = world.createBody();
  ground.createFixture(new Edge(
    { x: SIM.groundLeft, y: 0 },
    { x: SIM.groundRight, y: 0 },
  ), { friction: 0.95 });
  return ground;
}

/** Sahaya dağılmış kasalar — hem dekor hem fiziğin çalıştığının kanıtı. */
export interface Prop { body: Body; hw: number; hh: number; }

export function scatterProps(world: World, snaps: Snapshotter): Prop[] {
  const layout: Array<[number, number, number]> = [
    // [x, yarı-genişlik, yarı-yükseklik]
    [26, 0.42, 0.5], [27.3, 0.42, 0.5], [26.6, 0.42, 0.5],
    [44, 0.7, 0.45], [45.6, 0.7, 0.45],
  ];
  return layout.map(([x, hw, hh]) => {
    const body = world.createDynamicBody({ x, y: hh + 0.05 });
    body.createFixture(new Box(hw, hh), { density: 240, friction: 0.7, restitution: 0.03 });
    body.setAngularDamping(0.4);
    snaps.track(body);
    return { body, hw, hh };
  });
}

export { Vec2 };
