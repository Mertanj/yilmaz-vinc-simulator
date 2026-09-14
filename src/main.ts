import { Container } from 'pixi.js';
import { createStage } from './render/stage';
import { FixedLoop } from './core/loop';
import { Camera } from './core/camera';
import { Keyboard } from './input/keyboard';
import { createWorld, createGround, scatterProps, Snapshotter, SIM } from './sim/world';
import { Truck, TRUCK } from './sim/truck';
import { TruckView, drawWheel, drawContactShadow } from './render/truckView';
import {
  drawSky, drawGround, drawFactory, drawFarSkyline, drawEntranceSign, drawPropBox,
} from './render/scenery';

const FACTORY_X = 62;

async function boot(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('#game bulunamadı');
  const stage = await createStage(host);

  // --- fizik ---
  const world = createWorld();
  const snaps = new Snapshotter();
  createGround(world);
  const truck = new Truck(world, snaps);
  const props = scatterProps(world, snaps);

  // --- sabit dekor ---
  stage.far.addChild(drawFarSkyline());
  stage.world.addChild(
    drawGround(SIM.groundLeft, SIM.groundRight),
    drawFactory(FACTORY_X),
    drawEntranceSign(-14),
  );

  // --- hareketli görünümler ---
  const shadow = drawContactShadow(TRUCK.chassisHalfLength * 0.92);
  const truckView = new TruckView();
  const wheelViews = truck.wheels.map(() => drawWheel(TRUCK.wheelRadius));
  const propViews = props.map((p) => drawPropBox(p.hw, p.hh));

  const actors = new Container();
  actors.addChild(shadow, ...propViews, ...wheelViews, truckView);
  stage.world.addChild(actors);

  // --- girdi ve kamera ---
  const keys = new Keyboard();
  const camera = new Camera();
  camera.snapTo(truck.position.x, truck.position.y + 3);

  const speedEl = document.getElementById('speed');

  const step = (dt: number): void => {
    if (keys.consumeReset()) {
      truck.reset();
      camera.snapTo(TRUCK.spawnX, 6);
    }
    snaps.capture();
    truck.drive(keys.readDrive());
    world.step(dt, SIM.velocityIterations, SIM.positionIterations);
    world.clearForces();
  };

  const render = (alpha: number, frameDt: number): void => {
    const c = snaps.interpolate(truck.chassis, alpha);
    truckView.position.set(c.x, c.y);
    truckView.rotation = -c.a;

    // Gölge zeminde kalır, araçla birlikte yatar ama dönmez.
    shadow.position.set(c.x, 0.05);
    shadow.alpha = 0.38;

    truck.wheels.forEach((body, i) => {
      const view = wheelViews[i];
      if (!view) return;
      const w = snaps.interpolate(body, alpha);
      view.position.set(w.x, w.y);
      view.rotation = -w.a;
    });

    props.forEach((p, i) => {
      const view = propViews[i];
      if (!view) return;
      const s = snaps.interpolate(p.body, alpha);
      view.position.set(s.x, s.y);
      view.rotation = -s.a;
    });

    camera.follow(c.x, c.y + 3, truck.chassis.getLinearVelocity().x, frameDt);
    camera.apply(stage.world, stage.far, stage.app.screen.width, stage.app.screen.height);

    if (speedEl) speedEl.textContent = `${truck.speedKmh.toFixed(0)} km/sa`;
  };

  // --- gökyüzü, ekran boyutuna bağlı ---
  let sky = drawSky(stage.app.screen.width, stage.app.screen.height);
  stage.backdrop.addChild(sky);
  const relayout = (): void => {
    sky.destroy();
    sky = drawSky(stage.app.screen.width, stage.app.screen.height);
    stage.backdrop.addChild(sky);
  };
  stage.app.renderer.on('resize', relayout);

  new FixedLoop(step, render).start();
}

boot().catch((err: unknown) => {
  console.error(err);
  const host = document.getElementById('game');
  if (host) {
    host.innerHTML =
      '<p style="color:#E2645A;font:14px monospace;padding:24px">Başlatılamadı: '
      + String(err) + '</p>';
  }
});
