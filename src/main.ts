import { Container } from 'pixi.js';
import { createStage } from './render/stage';
import { FixedLoop } from './core/loop';
import { Camera } from './core/camera';
import { Keyboard } from './input/keyboard';
import { createWorld, createGround, scatterProps, Snapshotter, SIM } from './sim/world';
import { Truck, TRUCK } from './sim/truck';
import { Outriggers } from './sim/outriggers';
import { OutriggerState } from './sim/loadChart';
import { OutriggerView } from './render/outriggerView';
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
  const outriggers = new Outriggers(world, truck.chassis, snaps);
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

  const outriggerView = new OutriggerView();

  const actors = new Container();
  actors.addChild(shadow, ...propViews, ...wheelViews, outriggerView, truckView);
  stage.world.addChild(actors);

  // --- girdi ve kamera ---
  const keys = new Keyboard();
  const camera = new Camera();
  camera.snapTo(truck.position.x, truck.position.y + 3);

  const speedEl = document.getElementById('speed');
  const rigEl = document.getElementById('rig');
  const tiltEl = document.getElementById('tilt');

  const step = (dt: number): void => {
    if (keys.consumeReset()) {
      truck.reset();
      outriggers.reset(truck.chassis);
      camera.snapTo(TRUCK.spawnX, 6);
    }
    if (keys.consumeOutriggerToggle()) outriggers.toggle();

    snaps.capture();
    // Ayaklar yerdeyken sürüş kilitli — gerçekte de öyle, ve oyuncunun
    // ayakları toplamayı unutup çekmesini engelliyor.
    const grounded = outriggers.fraction > 0.15;
    truck.drive(grounded ? { throttle: 0, handbrake: true } : keys.readDrive());
    outriggers.update();
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

    outriggerView.update(outriggers.geometry(truck.chassis));

    if (speedEl) speedEl.textContent = `${truck.speedKmh.toFixed(0)} km/sa`;
    if (rigEl) {
      const label = { [OutriggerState.Stowed]: 'TOPLU',
                      [OutriggerState.Half]: 'YARI AÇIK',
                      [OutriggerState.Full]: 'TAM AÇIK' }[outriggers.state];
      const pct = (outriggers.fraction * 100).toFixed(0);
      rigEl.textContent = `ayak: ${label} %${pct}`;
      rigEl.dataset['state'] = outriggers.state;
    }
    if (tiltEl) {
      const deg = (-c.a * 180) / Math.PI;
      tiltEl.textContent = `eğim: ${deg >= 0 ? '+' : ''}${deg.toFixed(1)}°`;
      tiltEl.dataset['warn'] = Math.abs(deg) > 3 ? 'yes' : 'no';
    }
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
