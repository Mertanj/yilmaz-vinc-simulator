import { Container } from 'pixi.js';
import { Box } from 'planck';
import { createStage } from './render/stage';
import { FixedLoop } from './core/loop';
import { Camera } from './core/camera';
import { Keyboard } from './input/keyboard';
import {
  createWorld, createGround, createFactoryBody, createKerb, scatterProps,
  Snapshotter, SIM,
} from './sim/world';
import { Truck, TRUCK } from './sim/truck';
import { Outriggers } from './sim/outriggers';
import { Crane, NEUTRAL } from './sim/crane';
import { OutriggerState } from './sim/loadChart';
import { TruckView, drawWheel, drawContactShadow } from './render/truckView';
import { OutriggerView } from './render/outriggerView';
import { CableView, drawHookBlock, drawMachineLoad } from './render/craneView';
import {
  drawSky, drawGround, drawFactory, drawFarSkyline, drawEntranceSign, drawPropBox,
  drawSetupZone, drawKerb,
} from './render/scenery';

const FACTORY_X = 62;
/** Yük, kamyonun önünde yerde — kısa yarıçapta, tıpkı gerçek bir alma gibi. */
/**
 * Yük, kamyonun önünde yerde. Level tasarımındaki kurulum konumu Xc = 53;
 * oradan alma yarıçapı 6.3 m (çok kısa, yüksek kapasite) ve K1 terasına
 * bırakma yarıçapı 11.2 m oluyor.
 */
const LOAD = { x: 59.5, halfWidth: 1.15, halfHeight: 0.85, tonnes: 3.2 };
const SETUP_X = 52;
/** Takoz kamyonu burada durduruyor; ön tampon 56.8'de kalıyor, yüke 1.5 m var. */
const KERB_X = 57.2;

async function boot(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('#game bulunamadı');
  const stage = await createStage(host);

  // --- fizik ---
  const world = createWorld();
  const snaps = new Snapshotter();
  createGround(world);
  createFactoryBody(world);
  createKerb(world, KERB_X);
  const truck = new Truck(world, snaps);
  const outriggers = new Outriggers(world, truck.chassis, snaps);
  const crane = new Crane(world, truck.chassis, snaps);
  const props = scatterProps(world, snaps);

  const load = world.createDynamicBody({ x: LOAD.x, y: LOAD.halfHeight + 0.05 });
  load.createFixture(new Box(LOAD.halfWidth, LOAD.halfHeight), {
    density: 1, friction: 0.85, restitution: 0.02,
  });
  load.setMassData({ mass: LOAD.tonnes * 1000, center: { x: 0, y: 0 }, I: 1400 });
  load.setAngularDamping(0.5);
  snaps.track(load);

  // --- sabit dekor ---
  // NOT: burada cacheAsTexture DENENDİ ve geri alındı. Dekor metre biriminde
  // çiziliyor, dünya katmanı ise 34 kat ölçekleniyor; doku 1:1 pişip sonra
  // büyütülünce tüm arka plan bulanıklaştı.
  stage.far.addChild(drawFarSkyline());
  stage.world.addChild(
    drawGround(SIM.groundLeft, SIM.groundRight),
    drawFactory(FACTORY_X),
    drawSetupZone(SETUP_X),
    drawKerb(KERB_X),
    drawEntranceSign(-14),
  );

  // --- hareketli görünümler ---
  const shadow = drawContactShadow(TRUCK.chassisHalfLength * 0.92);
  const truckView = new TruckView();
  const wheelViews = truck.wheels.map(() => drawWheel(TRUCK.wheelRadius));
  const propViews = props.map((p) => drawPropBox(p.hw, p.hh));
  const outriggerView = new OutriggerView();
  const cableView = new CableView();
  const hookView = drawHookBlock();
  const loadView = drawMachineLoad(LOAD.halfWidth, LOAD.halfHeight);

  const actors = new Container();
  actors.addChild(
    shadow, ...propViews, loadView, ...wheelViews,
    outriggerView, truckView, cableView, hookView,
  );
  stage.world.addChild(actors);

  // --- girdi ve kamera ---
  const keys = new Keyboard();
  const camera = new Camera();
  camera.snapTo(truck.position.x, truck.position.y + 3);

  const hud = {
    speed: document.getElementById('speed'),
    rig: document.getElementById('rig'),
    tilt: document.getElementById('tilt'),
    boom: document.getElementById('boom'),
    lmi: document.getElementById('lmi'),
    hint: document.getElementById('hint'),
  };

  /** Ayaklar yerdeyse vinç fazındayız: sürüş kilitli, vinç açık. */
  const inCraneMode = (): boolean => outriggers.fraction > 0.15;

  const step = (dt: number): void => {
    if (keys.consumeReset()) {
      truck.reset();
      outriggers.reset(truck.chassis);
      camera.snapTo(TRUCK.spawnX, 6);
    }
    if (keys.consumeOutriggerToggle()) outriggers.toggle();

    const craneMode = inCraneMode();
    crane.setStowed(!craneMode);
    if (keys.consumeHookToggle() && craneMode) crane.requestToggleAttach();

    snaps.capture();

    // Ayaklar yerdeyken sürüş kilitli — gerçekte de öyle.
    truck.drive(craneMode ? { throttle: 0, handbrake: true } : keys.readDrive());
    outriggers.update();

    crane.update(craneMode ? keys.readCrane() : NEUTRAL, dt, crane.lmi);
    // Kinematik bomu konumlandır ve yükü şasiye aktar — adımdan hemen önce.
    crane.applyToWorld(dt);

    world.step(dt, SIM.velocityIterations, SIM.positionIterations);
    world.clearForces();

    // Tepki kuvveti ancak çözümden sonra tanımlı.
    crane.sampleLmi(dt, outriggers.state);

    // Joint yaratma/yok etme adımın DIŞINDA — planck world.step() içinde kilitli.
    crane.flushJointQueue([load, ...props.map((p) => p.body)]);
  };

  const render = (alpha: number, frameDt: number): void => {
    const c = snaps.interpolate(truck.chassis, alpha);
    truckView.position.set(c.x, c.y);
    truckView.rotation = -c.a;
    shadow.position.set(c.x, 0.05);

    truckView.boom.setPose(crane.angleDeg, crane.extensionM);

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

    const l = snaps.interpolate(load, alpha);
    loadView.position.set(l.x, l.y);
    loadView.rotation = -l.a;

    const h = snaps.interpolate(crane.hook, alpha);
    hookView.position.set(h.x, h.y);
    hookView.rotation = -h.a;
    cableView.update(crane.tipWorld, { x: h.x, y: h.y });

    outriggerView.update(outriggers.geometry(truck.chassis));

    camera.follow(c.x, c.y + 3, truck.chassis.getLinearVelocity().x, frameDt);
    camera.apply(stage.world, stage.far, stage.app.screen.width, stage.app.screen.height);

    updateHud();
  };

  function updateHud(): void {
    const craneMode = inCraneMode();
    if (hud.speed) hud.speed.textContent = `${truck.speedKmh.toFixed(0)} km/sa`;

    if (hud.rig) {
      const label = { [OutriggerState.Stowed]: 'TOPLU',
                      [OutriggerState.Half]: 'YARI AÇIK',
                      [OutriggerState.Full]: 'TAM AÇIK' }[outriggers.state];
      hud.rig.textContent = `ayak: ${label} %${(outriggers.fraction * 100).toFixed(0)}`;
      hud.rig.dataset['state'] = outriggers.state;
    }
    if (hud.tilt) {
      const deg = (-truck.chassis.getAngle() * 180) / Math.PI;
      hud.tilt.textContent = `eğim: ${deg >= 0 ? '+' : ''}${deg.toFixed(1)}°`;
      hud.tilt.dataset['warn'] = Math.abs(deg) > 3 ? 'yes' : 'no';
    }
    if (hud.boom) {
      hud.boom.textContent =
        `bom: ${crane.lengthM.toFixed(1)} m · ${crane.angleDeg.toFixed(0)}° · R ${crane.radiusM.toFixed(1)} m`;
    }
    if (hud.lmi) {
      const r = crane.lmi;
      const pct = Number.isFinite(r.percent) ? Math.min(999, r.percent) : 999;
      hud.lmi.textContent =
        `LMI %${pct.toFixed(0)} · kap ${r.capacityTonnes.toFixed(1)} t · yük ${r.loadTonnes.toFixed(2)} t`;
      hud.lmi.dataset['zone'] = r.zone;
    }
    if (hud.hint) {
      hud.hint.textContent = craneMode
        ? (crane.hasLoad ? 'yük bağlı · boşluk ile bırak' : 'kancayı yüke indir · boşluk ile bağla')
        : 'çalışma alanına yanaş, sonra Q ile ayakları aç';
      hud.hint.dataset['mode'] = craneMode ? 'crane' : 'drive';
    }
  }

  // --- gökyüzü, ekran boyutuna bağlı ---
  let sky = drawSky(stage.app.screen.width, stage.app.screen.height);
  stage.backdrop.addChild(sky);
  stage.app.renderer.on('resize', () => {
    sky.destroy();
    sky = drawSky(stage.app.screen.width, stage.app.screen.height);
    stage.backdrop.addChild(sky);
  });

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
