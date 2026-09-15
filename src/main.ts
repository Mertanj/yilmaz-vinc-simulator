import { Container } from 'pixi.js';
import { createStage } from './render/stage';
import { FixedLoop } from './core/loop';
import { Camera } from './core/camera';
import { Keyboard } from './input/keyboard';
import { SIM } from './sim/world';
import { Scene, SCENE } from './sim/scene';
import { TRUCK } from './sim/truck';
import { OutriggerState } from './sim/loadChart';
import { TruckView, drawWheel, drawContactShadow } from './render/truckView';
import { OutriggerView } from './render/outriggerView';
import { CableView, drawHookBlock, drawMachineLoad } from './render/craneView';
import {
  drawSky, drawGround, drawFactory, drawFarSkyline, drawEntranceSign, drawPropBox,
  drawSetupZone, drawKerb,
} from './render/scenery';

const { factoryX: FACTORY_X, setupX: SETUP_X, kerbX: KERB_X, load: LOAD } = SCENE;

async function boot(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('#game bulunamadı');
  const stage = await createStage(host);

  // --- fizik ---
  // Dünyanın kurulumu Scene'in içinde; başsız test de aynı sınıfı sürüyor.
  const scene = new Scene();
  const { truck, outriggers, crane, props, load } = scene;

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

  const step = (dt: number): void => {
    const reset = keys.consumeReset();
    scene.step({
      drive: keys.readDrive(),
      crane: keys.readCrane(),
      toggleOutriggers: keys.consumeOutriggerToggle(),
      toggleHook: keys.consumeHookToggle(),
      reset,
    }, dt);
    if (reset) camera.snapTo(TRUCK.spawnX, 6);
  };

  const render = (alpha: number, frameDt: number): void => {
    const c = scene.snaps.interpolate(truck.chassis, alpha);
    truckView.position.set(c.x, c.y);
    truckView.rotation = c.a;
    shadow.position.set(c.x, 0.05);

    truckView.boom.setPose(crane.angleDeg, crane.extensionM);

    truck.wheels.forEach((body, i) => {
      const view = wheelViews[i];
      if (!view) return;
      const w = scene.snaps.interpolate(body, alpha);
      view.position.set(w.x, w.y);
      view.rotation = w.a;
    });

    props.forEach((p, i) => {
      const view = propViews[i];
      if (!view) return;
      const s = scene.snaps.interpolate(p.body, alpha);
      view.position.set(s.x, s.y);
      view.rotation = s.a;
    });

    const l = scene.snaps.interpolate(load, alpha);
    loadView.position.set(l.x, l.y);
    loadView.rotation = l.a;

    const h = scene.snaps.interpolate(crane.hook, alpha);
    hookView.position.set(h.x, h.y);
    hookView.rotation = h.a;
    cableView.update(crane.tipWorld, { x: h.x, y: h.y });

    outriggerView.update(outriggers.geometry(truck.chassis));

    camera.follow(c.x, c.y + 3, truck.chassis.getLinearVelocity().x, frameDt);
    camera.apply(stage.world, stage.far, stage.app.screen.width, stage.app.screen.height);

    updateHud();
  };

  function updateHud(): void {
    const craneMode = scene.craneMode;
    if (hud.speed) hud.speed.textContent = `${truck.speedKmh.toFixed(0)} km/sa`;

    if (hud.rig) {
      const label = { [OutriggerState.Stowed]: 'TOPLU',
                      [OutriggerState.Half]: 'YARI AÇIK',
                      [OutriggerState.Full]: 'TAM AÇIK' }[outriggers.state];
      hud.rig.textContent = `ayak: ${label} %${(outriggers.fraction * 100).toFixed(0)}`;
      hud.rig.dataset['state'] = outriggers.state;
    }
    if (hud.tilt) {
      const deg = scene.tiltDeg;
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
      if (!craneMode) {
        hud.hint.textContent = 'çalışma alanına yanaş, sonra Q ile ayakları aç';
        hud.hint.dataset['mode'] = 'drive';
      } else if (crane.hasLoad) {
        hud.hint.textContent = 'yük bağlı · boşluk ile bırak';
        hud.hint.dataset['mode'] = 'crane';
      } else {
        // Kancanın neden tutmadığını söylemek şart: oyuncu aksi halde
        // tahmin oyunu oynuyor.
        const { reason } = crane.attachCheck(scene.grabbables);
        const say: Record<typeof reason, string> = {
          hazir: 'KANCA MENZİLDE · boşluk ile bağla',
          sallaniyor: 'kanca sallanıyor · dursun, sonra bağla',
          'yan-cekme': 'halat eğik · yan çekme olur, bomu yükün üstüne getir',
          ortala: 'kancayı yükün TAM ORTASINA getir',
          yukseklik: 'kancayı biraz daha indir',
          uzak: 'kancayı yükün üstüne indir',
        };
        hud.hint.textContent = say[reason];
        hud.hint.dataset['mode'] = reason === 'hazir' ? 'ready' : 'crane';
      }
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
