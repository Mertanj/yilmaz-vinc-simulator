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

  const el = (id: string): HTMLElement | null => document.getElementById(id);
  const hud = {
    gorev: el('gorev'), gorevBrif: el('gorev-brif'), sure: el('sure'), puan: el('puan'),
    barDolu: el('bar-dolu'), yuzde: el('moment-yuzde'), durum: el('moment-durum'),
    pYuk: el('p-yuk'), pSinir: el('p-sinir'), pYaricap: el('p-yaricap'),
    pBom: el('p-bom'), pAyak: el('p-ayak'), pEgim: el('p-egim'), pHiz: el('p-hiz'),
    hint: el('hint'), uyari: el('uyari'),
    sonuc: el('sonuc'), sonucIc: el('sonuc-ic'), kondu: el('kondu'),
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
    const r = crane.lmi;
    // Yük tablosu 28 metrede bitiyor. Ötesinde kapasite sıfır, yani yüzde
    // tanımsız — bu "sınırı aştın" değil, "bu mesafede hiç çalışılamaz"
    // durumu ve oyuncuya öyle anlatılmalı.
    const tabloDisi = r.capacityTonnes <= 0;
    const pct = tabloDisi || !Number.isFinite(r.percent)
      ? 999 : Math.min(999, r.percent);

    const gorev = mission.task;
    if (hud.gorev) {
      hud.gorev.textContent = gorev
        ? `${gorev.kod}/${mission.taskCount} · ${gorev.ad} ${gorev.tonnes.toFixed(2)} t`
        : 'bölüm tamamlandı';
    }
    if (hud.gorevBrif) hud.gorevBrif.textContent = gorev ? `— ${gorev.brif}` : '';
    if (hud.sure) {
      const sn = mission.score.sure;
      hud.sure.textContent =
        `${Math.floor(sn / 60)}:${(sn % 60).toFixed(0).padStart(2, '0')}`;
    }
    if (hud.puan) hud.puan.textContent = `${mission.score.puan} puan`;

    // --- kaldırma momenti göstergesi ---
    // Çubuk %150'ye kadar ölçekli; %100 çizgisi CSS'te 66.7'de duruyor, yani
    // sınırı aşmak çubukta da gözle görülüyor.
    if (hud.barDolu) {
      hud.barDolu.style.width = `${Math.min(100, (pct / 150) * 100).toFixed(1)}%`;
      hud.barDolu.style.backgroundColor =
        r.zone === 'red' ? '#E2645A' : r.zone === 'amber' ? '#E8A62C' : '#5FB07C';
    }
    if (hud.yuzde) {
      hud.yuzde.textContent = tabloDisi ? '—' : `%${pct.toFixed(0)}`;
      hud.yuzde.dataset['zone'] = r.zone;
    }
    if (hud.durum) {
      hud.durum.textContent = tabloDisi ? 'YARIÇAP TABLO DIŞI'
        : r.zone === 'red' ? 'AŞIRI YÜK'
        : r.zone === 'amber' ? 'DİKKAT · SINIRA YAKIN' : 'GÜVENLİ';
      hud.durum.dataset['zone'] = r.zone;
    }

    if (hud.pYuk) hud.pYuk.textContent = `${r.loadTonnes.toFixed(2)} t`;
    if (hud.pSinir) {
      hud.pSinir.textContent = tabloDisi ? 'tablo dışı' : `${r.capacityTonnes.toFixed(2)} t`;
    }
    if (hud.pYaricap) hud.pYaricap.textContent = `${crane.radiusM.toFixed(1)} m`;
    if (hud.pBom) {
      hud.pBom.textContent = `${crane.lengthM.toFixed(1)} m · ${crane.angleDeg.toFixed(0)}°`;
    }
    if (hud.pAyak) {
      hud.pAyak.textContent = { [OutriggerState.Stowed]: 'TOPLU',
                                [OutriggerState.Half]: 'YARI AÇIK',
                                [OutriggerState.Full]: 'TAM AÇIK' }[outriggers.state];
      hud.pAyak.dataset['state'] = outriggers.state;
    }
    if (hud.pEgim) {
      const deg = scene.tiltDeg;
      hud.pEgim.textContent = `${deg >= 0 ? '+' : ''}${deg.toFixed(1)}°`;
      hud.pEgim.dataset['warn'] = Math.abs(deg) > 3 ? 'yes' : 'no';
    }
    if (hud.pHiz) hud.pHiz.textContent = `${truck.speedKmh.toFixed(0)} km/sa`;

    uyariGoster(craneMode, tabloDisi);
    konduGoster();
    sonucGoster();

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
   * Fizik sınırına dayanınca NE OLDUĞUNU ve NE YAPILACAĞINI söyler.
   *
   * Sahadan gelen geri bildirim: "panelde bir şey kırmızıya dönüyor ama
   * okuyarak anlayamıyorum; öyle bir durumda 'hayır, bu yükü burada
   * kaldıramazsın' gibi bir uyarı versin." Doğru istek — yük momenti
   * göstergesi zaten kolları kilitliyordu ama bunu oyuncuya hiç söylemiyordu,
   * dolayısıyla kilit bozukluk gibi hissediliyordu.
   */
  function uyariGoster(craneMode: boolean, tabloDisi: boolean): void {
    const u = hud.uyari;
    if (!u) return;
    const r = crane.lmi;
    if (!craneMode || r.zone === 'green') { u.hidden = true; return; }

    const kilitli = crane.kilitliDenendi;
    if (tabloDisi) {
      // Yük tablosunun sonunu geçtik. Burada mesele yükün ağırlığı değil,
      // mesafenin kendisi: boş kanca bile bu yarıçapta kaldırılamaz.
      u.dataset['zone'] = 'red';
      u.classList.toggle('carpiyor', kilitli);
      u.innerHTML = [
        '<div class="bas">⚠ YARIÇAP TABLO DIŞI</div>',
        `<p><b>${crane.radiusM.toFixed(1)} m</b> mesafede bu vinç`
        + ' <b>hiçbir yük</b> kaldıramaz — yük tablosu 28 metrede bitiyor.</p>',
        '<p class="cozum">W ile bomu kaldır ya da ⇧S ile teleskobu topla.</p>',
      ].join('');
      u.hidden = false;
      return;
    }
    if (r.zone === 'red') {
      u.dataset['zone'] = 'red';
      u.classList.toggle('carpiyor', kilitli);
      u.innerHTML = [
        '<div class="bas">⚠ AŞIRI YÜK — BU YÜKÜ BURADA KALDIRAMAZSIN</div>',
        `<p>Kancadaki <b>${r.loadTonnes.toFixed(2)} t</b>,`
        + ` <b>${crane.radiusM.toFixed(1)} m</b> mesafede izin verilen`
        + ` <b>${r.capacityTonnes.toFixed(2)} t</b> sınırının üstünde.</p>`,
        kilitli
          ? '<p class="cozum">Bom indirme ve teleskop açma KİLİTLİ.'
            + ' W ile bomu kaldır ya da ⇧S ile teleskobu topla — yarıçap kısalır,'
            + ' sınır yükselir.</p>'
          : '<p class="cozum">W ile bomu kaldır: yarıçap kısalır, sınır yükselir.</p>',
      ].join('');
    } else {
      u.dataset['zone'] = 'amber';
      u.classList.remove('carpiyor');
      u.innerHTML = [
        '<div class="bas">SINIRA YAKLAŞIYORSUN</div>',
        `<p>${r.loadTonnes.toFixed(2)} t / ${r.capacityTonnes.toFixed(2)} t`
        + ` · yarıçap ${crane.radiusM.toFixed(1)} m.`
        + ' Yarıçapı büyütürsen kollar kilitlenir.</p>',
      ].join('');
    }
    u.hidden = false;
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
      const pz = t.puan;
      hud.kondu.innerHTML = [
        '<div class="tik">✓ YERİNE KONDU</div>',
        `<div class="ad">${t.kod} · ${t.ad}</div>`,
        `<div class="kazanc">+${pz.toplam} puan</div>`,
        '<dl>',
        `<dt>yerleştirme</dt><dd data-iyi="evet">+${pz.temel}</dd>`,
        `<dt>isabet · ${t.sapmaCm.toFixed(0)} cm sapma</dt>`
        + `<dd data-iyi="${yakin ? 'evet' : 'hayir'}">+${pz.isabet}</dd>`,
        `<dt>hız · ${Math.floor(t.sure / 60)}:${(t.sure % 60).toFixed(0).padStart(2, '0')}</dt>`
        + `<dd data-iyi="${pz.hiz > 0 ? 'evet' : 'hayir'}">+${pz.hiz}</dd>`,
        pz.ceza > 0 ? `<dt>aşırı yük / çarpma</dt><dd data-iyi="hayir">−${pz.ceza}</dd>` : '',
        `<dt>bu görevde en yüksek moment</dt>`
        + `<dd data-iyi="${lmiIyi ? 'evet' : 'hayir'}">%${t.maxLmi.toFixed(0)}</dd>`,
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
      `<p class="toplam">${s.puan} puan</p>`,
      '<table>',
      `<tr><td>tamamlanan görev</td><td>${s.sapmalar.length} / ${mission.taskCount}</td></tr>`,
      `<tr><td>süre</td><td>${Math.floor(s.sure / 60)}:${(s.sure % 60).toFixed(0).padStart(2, '0')}</td></tr>`,
      `<tr><td>en yüksek kaldırma momenti</td><td>%${s.maxLmi.toFixed(0)}</td></tr>`,
      `<tr><td>kırmızıda geçen süre</td><td>${s.kirmiziSn.toFixed(1)} sn</td></tr>`,
      `<tr><td>en geniş salınım</td><td>${s.maxSalinim.toFixed(0)}°</td></tr>`,
      `<tr><td>çarpma</td><td>${s.carpma}</td></tr>`,
      `<tr><td>ortalama yerleştirme sapması</td><td>${(ortSapma * 100).toFixed(0)} cm</td></tr>`,
      '</table>',
      `<p class="puan">başarı %${r.puan.toFixed(0)}</p>`,
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
