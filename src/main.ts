import { Container } from 'pixi.js';
import { createStage } from './render/stage';
import { FixedLoop } from './core/loop';
import { Camera } from './core/camera';
import { Keyboard } from './input/keyboard';
import { SIM } from './sim/world';
import { Scene, SCENE } from './sim/scene';
import { Mission } from './game/mission';
import { drawLoad, TargetMarker } from './render/missionView';
import { TRUCK } from './sim/truck';
import { OutriggerState } from './sim/loadChart';
import { TruckView, drawWheel, drawContactShadow } from './render/truckView';
import { OutriggerView } from './render/outriggerView';
import { CableView, drawHookBlock } from './render/craneView';
import {
  drawSky, drawGround, drawFactory, drawFarSkyline, drawEntranceSign, drawPropBox,
  drawSetupZone, drawKerb,
} from './render/scenery';

const { factoryX: FACTORY_X, setupX: SETUP_X, kerbX: KERB_X } = SCENE;

async function boot(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('#game bulunamadı');
  const stage = await createStage(host);

  // --- fizik ---
  // Dünyanın kurulumu Scene'in içinde; başsız test de aynı sınıfı sürüyor.
  const scene = new Scene();
  const { truck, outriggers, crane, props } = scene;
  const mission = new Mission(scene);

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
  const marker = new TargetMarker();

  const actors = new Container();
  actors.addChild(
    shadow, ...propViews, marker, ...wheelViews,
    outriggerView, truckView, cableView, hookView,
  );
  stage.world.addChild(actors);

  // Yük görünümü göreve bağlı: her görevin ölçüsü ve türü farklı, o yüzden
  // gövde yenilendiğinde çizim de yenileniyor.
  let loadViewFor = scene.loadTask;
  let loadView = loadViewFor ? drawLoad(loadViewFor) : new Container();
  actors.addChildAt(loadView, actors.getChildIndex(marker));

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
    gorev: document.getElementById('gorev'),
    sure: document.getElementById('sure'),
    sonuc: document.getElementById('sonuc'),
    sonucIc: document.getElementById('sonuc-ic'),
    kondu: document.getElementById('kondu'),
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
    if (reset) {
      camera.snapTo(TRUCK.spawnX, 6);
      mission.markReset();
    }
    mission.update(dt);
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

    // Görev değiştiyse yük çizimini yenile.
    if (scene.loadTask !== loadViewFor) {
      loadViewFor = scene.loadTask;
      const yeni = loadViewFor ? drawLoad(loadViewFor) : new Container();
      actors.addChildAt(yeni, actors.getChildIndex(loadView));
      loadView.destroy({ children: true });
      loadView = yeni;
    }
    if (loadViewFor) {
      const l = scene.snaps.interpolate(scene.load, alpha);
      loadView.position.set(l.x, l.y);
      loadView.rotation = l.a;
    }

    // Hedef işareti yük havadayken parlıyor: kör kaldırmada aranan şey o.
    marker.update(mission.target, mission.task?.halfWidth ?? 1, crane.hasLoad);

    const h = scene.snaps.interpolate(crane.hook, alpha);
    hookView.position.set(h.x, h.y);
    hookView.rotation = h.a;
    cableView.update(crane.tipWorld, { x: h.x, y: h.y });

    outriggerView.update(outriggers.geometry(truck.chassis));

    // Kadraja girmesi gerekenler: araç, bom ucu, kanca ve varsa hedef teras.
    // Hedefi de katmak şart — çatıya uzanırken oyuncu yükü bıraktığı yeri
    // göremiyordu.
    const bakilacak: Array<{ x: number; y: number }> = [
      { x: c.x, y: c.y + 2.2 }, crane.tipWorld, { x: h.x, y: h.y },
    ];
    const hedefNoktasi = mission.target;
    if (hedefNoktasi && crane.hasLoad) bakilacak.push(hedefNoktasi);
    camera.follow(
      bakilacak, truck.chassis.getLinearVelocity().x,
      stage.app.screen.width, stage.app.screen.height, frameDt,
    );
    camera.apply(stage.world, stage.far, stage.app.screen.width, stage.app.screen.height);

    updateHud();
  };

  function updateHud(): void {
    const craneMode = scene.craneMode;
    if (hud.speed) hud.speed.textContent = `${truck.speedKmh.toFixed(0)} km/sa`;

    if (hud.gorev) {
      const t = mission.task;
      hud.gorev.textContent = t
        ? `${t.kod}/${mission.taskCount} · ${t.ad} ${t.tonnes.toFixed(2)} t — ${t.brif}`
        : 'bölüm tamamlandı';
    }
    if (hud.sure) {
      const sn = mission.score.sure;
      hud.sure.textContent =
        `${Math.floor(sn / 60)}:${(sn % 60).toFixed(0).padStart(2, '0')}`
        + ` · çarpma ${mission.score.carpma}`
        + ` · en yüksek LMI %${mission.score.maxLmi.toFixed(0)}`
        + (mission.score.kirmiziSn > 0.05
          ? ` · kırmızıda ${mission.score.kirmiziSn.toFixed(1)} sn` : '');
    }
    sonucGoster();
    konduGoster();

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

  /**
   * Yük terasa oturduğunda onay paneli.
   *
   * Sahadan gelen ihtiyaç: "doğru yerleştirdim mi bilmek istiyorum". Kör
   * kaldırmada yük bırakıldığı an oyuncunun görüş açısının dışında kalıyor,
   * dolayısıyla başarının ayrıca SÖYLENMESİ gerekiyor. Panel oyunu durdurmuyor
   * ve dört saniyede kendi kapanıyor — akışı kesmeden onay veriyor.
   */
  let konduSira = 0;
  let konduBitis = 0;
  function konduGoster(): void {
    const t = mission.sonTamamlanan;
    if (t && t.sira !== konduSira && hud.kondu) {
      konduSira = t.sira;
      konduBitis = performance.now() + 4000;
      const yakin = t.sapmaCm <= 60;
      const lmiIyi = t.maxLmi <= 90;
      hud.kondu.innerHTML = [
        '<div class="tik">✓ YERİNE KONDU</div>',
        `<div class="ad">${t.kod} · ${t.ad}</div>`,
        '<dl>',
        `<dt>hedeften sapma</dt><dd data-iyi="${yakin ? 'evet' : 'hayir'}">${t.sapmaCm.toFixed(0)} cm</dd>`,
        `<dt>bu görevde en yüksek LMI</dt><dd data-iyi="${lmiIyi ? 'evet' : 'hayir'}">%${t.maxLmi.toFixed(0)}</dd>`,
        `<dt>süre</dt><dd>${Math.floor(t.sure / 60)}:${(t.sure % 60).toFixed(0).padStart(2, '0')}</dd>`,
        '</dl>',
        `<p class="sonraki">${t.kalan > 0
          ? `sırada ${t.kalan} görev var · yeni yük malzeme alanında`
          : 'bölümdeki son yük — toparlayabilirsin'}</p>`,
      ].join('');
      hud.kondu.hidden = false;
    }
    if (hud.kondu && !hud.kondu.hidden && performance.now() > konduBitis) {
      hud.kondu.hidden = true;
    }
  }

  /** Bölüm bitince ya da devrilince sonuç panelini bir kez yaz. */
  let sonucYazildi = false;
  function sonucGoster(): void {
    const r = mission.result;
    if (!r) {
      if (sonucYazildi && hud.sonuc) { hud.sonuc.hidden = true; sonucYazildi = false; }
      return;
    }
    if (sonucYazildi || !hud.sonuc || !hud.sonucIc) return;
    sonucYazildi = true;
    const s = r.score;
    const ortSapma = s.sapmalar.length
      ? s.sapmalar.reduce((a, b) => a + b, 0) / s.sapmalar.length : 0;
    hud.sonucIc.innerHTML = [
      `<div class="not" data-not="${r.not}">${r.not}</div>`,
      `<h2>${r.devrildi ? 'ARAÇ DEVRİLDİ' : 'BÖLÜM TAMAMLANDI'}</h2>`,
      r.usta ? '<p class="rozet">USTA VİNÇÇİ</p>' : '',
      '<table>',
      `<tr><td>süre</td><td>${Math.floor(s.sure / 60)}:${(s.sure % 60).toFixed(0).padStart(2, '0')}</td></tr>`,
      `<tr><td>en yüksek LMI</td><td>%${s.maxLmi.toFixed(0)}</td></tr>`,
      `<tr><td>kırmızıda geçen süre</td><td>${s.kirmiziSn.toFixed(1)} sn</td></tr>`,
      `<tr><td>en geniş salınım</td><td>${s.maxSalinim.toFixed(0)}°</td></tr>`,
      `<tr><td>çarpma</td><td>${s.carpma}</td></tr>`,
      `<tr><td>yerleştirme sapması</td><td>${(ortSapma * 100).toFixed(0)} cm</td></tr>`,
      `<tr><td>tamamlanan görev</td><td>${s.sapmalar.length} / ${mission.taskCount}</td></tr>`,
      '</table>',
      `<p class="puan">${r.puan.toFixed(0)} / 100</p>`,
      '<p class="note">R ile yeniden başla</p>',
    ].join('');
    hud.sonuc.hidden = false;
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
