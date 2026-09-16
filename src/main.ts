import { createStage } from './render/stage';
import { FixedLoop } from './core/loop';
import { Camera } from './core/camera';
import { Keyboard } from './input/keyboard';
import { Mission } from './game/mission';
import { aracSec } from './ui/secim';

async function boot(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('#game bulunamadı');

  // --- araç seçimi ---
  // Oyun makineyi seçmekle başlıyor; bundan sonrası hangi makine olduğunu
  // bilmiyor. `main.ts` içinde tek bir `if (vinç)` yok, olmamalı da.
  const secimHost = document.getElementById('secim');
  if (!secimHost) throw new Error('#secim bulunamadı');
  const arac = await aracSec(secimHost);
  if (!arac.kur) throw new Error(`${arac.ad} henüz oynanabilir değil`);
  const { sahne: scene, gorunum } = arac.kur();

  const stage = await createStage(host);
  const mission = new Mission(scene);

  document.title = `${arac.ad} · Yılmaz Vinç`;
  const ustBaslik = document.querySelector('#ust b');
  if (ustBaslik) ustBaslik.textContent = arac.ad.toLocaleUpperCase('tr');
  const tuslar = document.getElementById('tuslar');
  if (tuslar) tuslar.innerHTML = arac.tuslar;

  // --- sabit dekor ---
  // NOT: burada cacheAsTexture DENENDİ ve geri alındı. Dekor metre biriminde
  // çiziliyor, dünya katmanı ise 34 kat ölçekleniyor; doku 1:1 pişip sonra
  // büyütülünce tüm arka plan bulanıklaştı.
  // Pixi'nin addChild'ı argümansız çağrılınca patlıyor; forkliftte uzak
  // katman boş, o yüzden dizi boşsa hiç çağırmıyoruz.
  const uzak = gorunum.uzak();
  if (uzak.length) stage.far.addChild(...uzak);
  stage.world.addChild(...gorunum.dekor(), gorunum.aktorler);

  // --- girdi ve kamera ---
  const keys = new Keyboard();
  const camera = new Camera();
  camera.olcekSiniri(scene.kameraOlcegi.yakin, scene.kameraOlcegi.uzak);
  const odak = gorunum.baslangicOdak();
  camera.snapTo(odak.x, odak.y);

  const el = (id: string): HTMLElement | null => document.getElementById(id);
  const hud = {
    gorev: el('gorev'), gorevBrif: el('gorev-brif'), sure: el('sure'), puan: el('puan'),
    baslik: el('p-baslik'), barDolu: el('bar-dolu'),
    yuzde: el('moment-yuzde'), durum: el('moment-durum'),
    satirlar: el('p-satirlar'), alt1: el('p-alt1'), alt2: el('p-alt2'),
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
      toggleKat: keys.consumeKatToggle(),
      reset,
    }, dt);
    if (reset) {
      const o = gorunum.baslangicOdak();
      camera.snapTo(o.x, o.y);
      mission.markReset();
    }
    mission.update(dt);
  };

  const render = (alpha: number, frameDt: number): void => {
    gorunum.ciz(alpha, mission.marker, mission.task?.halfWidth ?? 1);

    // Kadraja girmesi gerekenleri makine söylüyor; hedefi biz ekliyoruz.
    const bakilacak = scene.odakNoktalari();
    const hedefNoktasi = mission.target;
    if (hedefNoktasi && scene.hasLoad) bakilacak.push(hedefNoktasi);
    camera.follow(
      bakilacak, scene.sasiHizi, stage.app.screen.width, stage.app.screen.height, frameDt,
    );
    camera.apply(stage.world, stage.far, stage.app.screen.width, stage.app.screen.height);

    updateHud();
  };

  function updateHud(): void {
    const g = scene.gosterge();

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

    // --- gösterge bloğu ---
    if (hud.baslik) hud.baslik.textContent = g.baslik;
    if (hud.barDolu) {
      hud.barDolu.style.width = `${(g.dolu * 100).toFixed(1)}%`;
      hud.barDolu.style.backgroundColor =
        g.zone === 'red' ? '#E2645A' : g.zone === 'amber' ? '#E8A62C' : '#5FB07C';
    }
    if (hud.yuzde) {
      hud.yuzde.textContent = g.yuzde === null ? '—' : `%${g.yuzde.toFixed(0)}`;
      hud.yuzde.dataset['zone'] = g.zone;
    }
    if (hud.durum) {
      hud.durum.textContent = g.durum;
      hud.durum.dataset['zone'] = g.zone;
    }
    if (hud.alt1) hud.alt1.textContent = g.altSatirlar[0] ?? '';
    if (hud.alt2) hud.alt2.textContent = g.altSatirlar[1] ?? '';

    // --- etiket–değer satırları ---
    // Satırları makine üretiyor, main.ts sadece basıyor: üçüncü aracı eklemek
    // buraya hiç dokunmuyor.
    if (hud.satirlar) {
      hud.satirlar.innerHTML = scene.panelSatirlari()
        .map((x) => `<dt>${x.etiket}</dt>`
          + `<dd${x.vurgu ? ` data-vurgu="${x.vurgu}"` : ''}>${x.deger}</dd>`)
        .join('');
    }

    uyariGoster();
    konduGoster();
    sonucGoster();

    if (hud.hint) {
      const { metin, mod } = scene.ipucu();
      hud.hint.textContent = metin;
      hud.hint.dataset['mode'] = mod;
    }
  }

  /**
   * Fizik sınırına dayanınca NE OLDUĞUNU ve NE YAPILACAĞINI söyler.
   *
   * Sahadan gelen geri bildirim: "panelde bir şey kırmızıya dönüyor ama
   * okuyarak anlayamıyorum; öyle bir durumda 'hayır, bu yükü burada
   * kaldıramazsın' gibi bir uyarı versin." İçeriği makine üretiyor, çünkü
   * neyin neden kilitlendiğini bilen o.
   */
  function uyariGoster(): void {
    const u = hud.uyari;
    if (!u) return;
    const w = scene.uyari();
    if (!w) { u.hidden = true; return; }
    u.dataset['zone'] = w.zone;
    u.classList.toggle('carpiyor', w.carpiyor);
    u.innerHTML = `<div class="bas">${w.bas}</div><p>${w.govde}</p>`
      + (w.cozum ? `<p class="cozum">${w.cozum}</p>` : '');
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

  // --- arka plan, ekran boyutuna bağlı ---
  let arkaPlan = gorunum.arkaPlan(stage.app.screen.width, stage.app.screen.height);
  stage.backdrop.addChild(arkaPlan);
  stage.app.renderer.on('resize', () => {
    arkaPlan.destroy({ children: true });
    arkaPlan = gorunum.arkaPlan(stage.app.screen.width, stage.app.screen.height);
    stage.backdrop.addChild(arkaPlan);
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
