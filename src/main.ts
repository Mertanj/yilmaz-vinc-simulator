import { createStage, type Stage } from './render/stage';
import { FixedLoop } from './core/loop';
import { Camera } from './core/camera';
import { Kumanda } from './input/kumanda';
import { Mission } from './game/mission';
import { aracSec } from './ui/secim';
import { enIyiKaydet } from './game/enIyi';
import type { AracTanimi } from './game/araclar';
import {
  M, baslangicDili, dilSec, gorevAdi, gorevBrifi, kumandaModunuSec,
} from './ui/dil';
import { dokunmatikKur, dokunmatikVar } from './ui/dokunmatik';
import type { DokunmatikDuzeni } from './ui/dokunmatik';
import { oku, yaz } from './ui/kayit';
import { Ses } from './ses/ses';
import { kipOku } from './sim/kip';

/**
 * Detay modu açık mı?
 *
 * Sahadan gelen geri bildirim: *"şu sol bar'ı düzenleyelim, şu an çok detaylı,
 * oyuncular için fazla olabilir."* Panel sekiz satırdı. Varsayılan artık üç
 * satır — anlık karar için gereken kadarı; gerisi `I` ile açılıyor. Tercih
 * `localStorage`'da duruyor, çünkü paneli bir kez açan oyuncu onu her açılışta
 * yeniden açmak istemiyor.
 */
const DETAY_ANAHTARI = 'yv.detay';

/**
 * Ses, Pixi uygulaması ve klavye gibi DÖNGÜNÜN DIŞINDA, tek.
 *
 * Her araçta yeni bir `AudioContext` açmak tarayıcının bağlam sayısını
 * tüketir (Chrome ~6'da sessizce reddediyor) ve makine değiştiren oyuncu
 * üçüncü turda sessiz bir oyun bulurdu. Sessizlik tercihi de araçlar arasında
 * korunuyor — sesi kapatan biri onu her makinede yeniden kapatmak istemez.
 */
const ses = new Ses();

/**
 * Bölüme ait gövde sınıflarını temizler.
 *
 * **Sahadan gelen hata:** *"bir turu bitirince herhangi bir araçla machines'a
 * basınca ya da yeni oyuna başlayınca tuş pad gelmiyor."*
 *
 * Sebep bir sızıntıydı. `bitti` sınıfı sonuç paneli açılınca ekleniyor (ekran
 * kumandasının sürüş ve çatal kümeleri panelin önünü kapatmasın diye) ve
 * YALNIZCA `sonucGoster` içinde, `mission.result` null'a dönünce kaldırılıyor.
 * Oyuncu sonuç ekranından Esc'e basınca döngü duruyor, o kod bir daha hiç
 * çalışmıyor ve sınıf gövdede kalıyor — sonraki bölümde CSS `.pad.sol` ve
 * `.pad.sag`'ı gizlemeye devam ediyor. `R` ile sıfırlamak bu hatayı
 * göstermiyordu, çünkü orada `mission.result` gerçekten null'a dönüyor.
 *
 * Çıkışta `temizle()` çağırıyor — sonuç, uyarı ve yerleştirme panellerini
 * gizleyen yer orası ve bu onların kardeşi; panellerin doğru temizlenip
 * sınıfın unutulmasının sebebi zaten ikisinin ayrı yerlerde durmasıydı.
 * Girişte bir kez daha çağrılıyor: sigorta, ileride başka bir çıkış yolu
 * eklense bile bir sonraki bölüm kendini toparlasın.
 *
 * **Yalnız bölüme ait olanlar siliniyor.** `dokunmatik` cihaza ait,
 * `yatay-zorla` ve `cevir-kapali` oyuncunun tercihi — üçü de turlar arasında
 * yaşamalı.
 */
function bolumSiniflariniTemizle(): void {
  document.body.classList.remove('bitti');
}

/**
 * Oyunun dış kabuğu: seç → oyna → seçime dön.
 *
 * Önceden `aracSec` açılışta bir kez bekleniyordu ve makineyi değiştirmenin
 * tek yolu sayfayı yenilemekti. İki bölüm var ama oyuncuların çoğu bir
 * tanesini görüyordu. Artık `oyna()` oyuncu Esc'e basınca çözülüyor ve döngü
 * başa sarıyor.
 *
 * Pixi uygulaması DÖNGÜNÜN DIŞINDA, bir kez kuruluyor: her araçta yeni bir
 * `Application` açmak WebGL context'lerini tüketir (tarayıcılar ~16 taneyle
 * sınırlıyor ve sessizce en eskisini öldürüyor). Araç değişiminde sadece
 * katmanların içi boşaltılıyor. Klavye de aynı sebeple tek: her kurulum
 * `window`'a bir dinleyici daha eklerdi.
 */
async function boot(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('#game bulunamadı');
  const secimHost = document.getElementById('secim');
  if (!secimHost) throw new Error('#secim bulunamadı');

  // Dil, hiçbir metin okunmadan ÖNCE seçiliyor: araç kartları, HUD etiketleri
  // ve görev adları hep aynı sözlükten besleniyor.
  dilSec(baslangicDili());

  yatayCagrisiniKur();

  const stage = await createStage(host);
  const keys = new Kumanda();

  for (;;) {
    const arac = await aracSec(secimHost);
    // **Ses bağlamı TAM BURADA açılıyor.** Tarayıcı `AudioContext`in ancak bir
    // kullanıcı hareketinden sonra çalışmasına izin veriyor; karta basmak
    // oyuna girmenin zaten tek yolu, yani başka bir "sesi başlat" düğmesi
    // uydurmaya gerek yok. Sekmeden çıkıp dönünce bağlam askıya alınıyor, o
    // yüzden her turda yeniden çağrılıyor — `ac()` bunu bekliyor.
    ses.ac();
    // Hazır olmayan kart zaten `disabled`; yine de oyunu düşürmüyoruz.
    if (!arac.kur) continue;
    keys.sifirla();
    await oyna(stage, keys, arac);
    // Döngü durdu; süregelen sesleri indir, yoksa seçim ekranında motor çalar.
    ses.bosta();
    temizle(stage);
  }
}

/** Araç değişiminde sahneyi boşalt — GPU kaynakları görünümle birlikte gitsin. */
function temizle(stage: Stage): void {
  for (const katman of [stage.world, stage.far, stage.backdrop]) {
    for (const c of katman.removeChildren()) c.destroy({ children: true });
  }
  for (const id of ['uyari', 'kondu', 'sonuc']) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  bolumSiniflariniTemizle();
}

/** Bir makineyle bir bölüm. Oyuncu seçime dönmek isteyince çözülür. */
function oyna(stage: Stage, keys: Kumanda, arac: AracTanimi): Promise<void> {
  const { sahne: scene, gorunum, pad: padKaynagi } = arac.kur!();
  const mission = new Mission(scene);

  document.title = `${arac.ad} · Yılmaz Vinç`;
  const ustBaslik = document.querySelector('#ust b');
  if (ustBaslik) ustBaslik.textContent = arac.ad.toLocaleUpperCase(M.kod);
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

  bolumSiniflariniTemizle();

  // Kipi sahne kurulur kurulmaz uygula: oyuncunun seçimi fiziğin ilk
  // adımından önce yerinde olmalı.
  scene.kipiSec?.(kipOku());

  // --- kamera ---
  const camera = new Camera();
  camera.olcekSiniri(scene.kameraOlcegi.yakin, scene.kameraOlcegi.uzak);
  const odak = gorunum.baslangicOdak();
  camera.snapTo(odak.x, odak.y);

  let detay = oku(DETAY_ANAHTARI) === '1';

  // Telefonda klavye yok: hem makinenin kumandası hem de detay satırlarını
  // açan anahtar dokunmatik olmak zorunda, yoksa erişilemez kalıyorlar.
  const dokunmatik = dokunmatikVar() && padKaynagi !== undefined;
  kumandaModunuSec(dokunmatik);

  const el = (id: string): HTMLElement | null => document.getElementById(id);
  const hud = {
    gorev: el('gorev'), gorevBrif: el('gorev-brif'), sure: el('sure'), puan: el('puan'),
    baslik: el('p-baslik'), barDolu: el('bar-dolu'),
    yuzde: el('moment-yuzde'), durum: el('moment-durum'),
    satirlar: el('p-satirlar'), detay: el('p-detay'),
    alt1: el('p-alt1'), alt2: el('p-alt2'),
    hint: el('hint'), uyari: el('uyari'),
    sonuc: el('sonuc'), sonucIc: el('sonuc-ic'), kondu: el('kondu'),
  };

  // --- ekran üstü kumanda ---
  const padHost = el('dokunmatik');
  // Çevirme düğmesi araç tanımında DEĞİL: makinenin bir fonksiyonu değil,
  // ekranın kendi işi. Her makinenin padine buradan ekleniyor.
  const kaynak = padKaynagi && {
    anahtar: padKaynagi.anahtar,
    duzen: (): DokunmatikDuzeni => {
      const d = padKaynagi.duzen();
      return {
        ...d,
        yardimci: [...d.yardimci, {
          isaret: '⟳', ad: M.dokunma.cevir,
          eylem: (): void => {
            yatayZorla(!document.body.classList.contains('yatay-zorla'));
            olculeriYaz();
          },
        }],
      };
    },
  };
  const pad = dokunmatik && padHost && kaynak
    ? dokunmatikKur(padHost, kaynak, keys)
    : null;
  const padiSok = (): void => pad?.sok();

  /**
   * Detay satırı dokunmatikte düğmeye dönüşüyor.
   *
   * Panelin tamamı `pointer-events: none` — oyunun üstünde duran bir gösterge,
   * tıklanacak bir arayüz değil. Bu tek satır istisna oluyor, çünkü telefonda
   * `I` tuşu yok ve detay satırları başka türlü hiç açılamıyor.
   */
  const detayDugmesiniSok = ((): (() => void) => {
    const d = hud.detay;
    if (!dokunmatik || !d) return () => { /* klavyede I var */ };
    const bas = (): void => keys.tetikle('detay');
    d.classList.add('dokunulur');
    d.setAttribute('role', 'button');
    d.addEventListener('click', bas);
    return () => {
      d.removeEventListener('click', bas);
      d.classList.remove('dokunulur');
      d.removeAttribute('role');
    };
  })();

  /**
   * Kumandanın kapladığı yerleri ölç ve kullanacaklara bildir.
   *
   * `offsetWidth/Height` kullanılıyor, `getBoundingClientRect()` değil:
   * zorlanmış yatayda sahne 90° dönük ve rect ekran uzayında EKSEN HİZALI
   * kutu veriyor, yani dönük bir kümenin `height`'ı aslında onun genişliği
   * oluyor. `offset*` dönüşümden etkilenmiyor, kabın kendi uzayında ölçüyor.
   *
   * Yardımcı kümenin genişliği CSS'e yazılıyor: ipucu şeridi ona göre
   * duruyor ve küme sabit genişlikte DEĞİL — etiketler dile göre uzuyor
   * ("makineler" / "machines") ve her makinenin yardımcı düğme sayısı farklı
   * olabiliyor. Sabit bir sayı yazmak bir dilde ya da bir araçta sessizce
   * çakışırdı. Sabitler: 14 = kümenin kenar boşluğu, 8 = aradaki nefes payı.
   */
  const sahneKabi = el('sahne');
  function olculeriYaz(): void {
    // İKİ kümenin büyüğü: vinçte çalışma fazında sağ küme beş düğme ve
    // dikeyde sol kümeden bir sıra daha uzun oluyor. Sadece sola bakmak
    // makineyi sağdaki düğmelerin arkasında bırakırdı.
    const yukseklik = ['.pad.sol', '.pad.sag']
      .map((s) => padHost?.querySelector<HTMLElement>(s)?.offsetHeight ?? 0)
      .reduce((a, b) => Math.max(a, b), 0);
    camera.altPayi(yukseklik > 0 ? yukseklik + 22 : 0);
    const yardimci = padHost?.querySelector<HTMLElement>('.pad.yardimci');
    if (sahneKabi && yardimci) {
      sahneKabi.style.setProperty('--yardimci-en', `${yardimci.offsetWidth + 22}px`);
    }
  }
  olculeriYaz();

  // --- arka plan, ekran boyutuna bağlı ---
  let arkaPlan = gorunum.arkaPlan(stage.app.screen.width, stage.app.screen.height);
  stage.backdrop.addChild(arkaPlan);
  const yenidenBoyutlandi = (): void => {
    // Ekran döndüğünde kumanda yeniden diziliyor: kapladığı şerit de değişiyor.
    olculeriYaz();
    arkaPlan.destroy({ children: true });
    arkaPlan = gorunum.arkaPlan(stage.app.screen.width, stage.app.screen.height);
    stage.backdrop.addChild(arkaPlan);
  };
  stage.app.renderer.on('resize', yenidenBoyutlandi);

  // --- ses: olaylar DURUM DEĞİŞİMİNDEN türetiliyor ---
  //
  // Sahneye "ses çal" diye bir çağrı eklemek yerine main.ts her karede neyin
  // değiştiğine bakıyor. Sebep sınır: `src/sim` altında ses diye bir şey yok
  // ve olmamalı — başsız rigler node'da koşuyor, orada `AudioContext` yok.
  // Değişim izlemek zaten bedava, çünkü bu değerlerin hepsi HUD için okunuyor.
  let oncekiCarpma = scene.carpma;
  let oncekiYuk = scene.hasLoad;
  let oncekiSira = 0;
  let oncekiAyak = scene.calismaModunda;
  let oncekiUyari = '';
  let inceMod = false;

  return new Promise<void>((cik) => {
    const step = (dt: number): void => {
      if (keys.consumeSesToggle()) ses.degistir();
      if (keys.consumeDetayToggle()) {
        detay = !detay;
        yaz(DETAY_ANAHTARI, detay ? '1' : '0');
      }
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

      // Çıkış en sonda: bu karenin fiziği zaten işledi, yarım kalan bir adım
      // bırakmıyoruz.
      if (keys.consumeCikis()) {
        loop.stop();
        stage.app.renderer.off('resize', yenidenBoyutlandi);
        padiSok();
        detayDugmesiniSok();
        cik();
      }
    };

    const render = (alpha: number, frameDt: number): void => {
      gorunum.ciz(alpha, mission.marker, mission.task?.halfWidth ?? 1);

      sesiSur(frameDt);

      // Kadraja girmesi gerekenleri makine söylüyor; hedefi biz ekliyoruz.
      const bakilacak = scene.odakNoktalari();
      const hedefNoktasi = mission.target;
      if (hedefNoktasi && scene.hasLoad) bakilacak.push(hedefNoktasi);

      // **İnce hizalamada kadraj daralıyor.** Karar sunum katmanında, çünkü
      // kullandığı her şey (kanca, yük, hedef) zaten burada okunuyor ve
      // makinenin bunu bilmesi gerekmiyor. Girme/çıkma eşikleri AYRI: tek
      // eşikte kamera sınırda gidip gelen bir yükle birlikte nefes alıyordu.
      const k = scene.yukNoktasi;
      const yukP = scene.load.getPosition();
      const nokta = scene.hasLoad ? hedefNoktasi : { x: yukP.x, y: yukP.y };
      const uzaklik = nokta ? Math.hypot(k.x - nokta.x, k.y - nokta.y) : Infinity;
      inceMod = uzaklik < (inceMod ? 4.6 : 3.0);
      camera.inceHizalama(inceMod);

      camera.follow(
        bakilacak, scene.sasiHizi, stage.app.screen.width, stage.app.screen.height, frameDt,
      );
      camera.apply(stage.world, stage.far, stage.app.screen.width, stage.app.screen.height);

      updateHud();
    };

    const loop = new FixedLoop(step, render);
    loop.start();

    /**
     * Süregelen sesleri besler ve olayları değişimden türetir.
     *
     * Gaz doğrudan okunmuyor: `sasiHizi` var ve motorun duyulması gereken şey
     * zaten o — duran bir kamyonda rölanti, hızlananda yükselen devir.
     * Hidrolik için kolların mutlak en büyüğü alınıyor; oyuncu hangi ekseni
     * sürerse sürsün pompa aynı pompa.
     */
    function sesiSur(frameDt: number): void {
      const c = keys.readCrane();
      const hidrolik = scene.calismaModunda
        ? Math.max(Math.abs(c.luff), Math.abs(c.telescope),
          Math.abs(c.uzat), Math.abs(c.winch))
        : 0;
      ses.guncelle({
        gaz: Math.min(1, Math.abs(scene.sasiHizi) / 9),
        hidrolik,
        zone: scene.gosterge().zone,
      }, frameDt);

      if (scene.carpma !== oncekiCarpma) {
        oncekiCarpma = scene.carpma;
        ses.olay('carpma');
        camera.sars(0.22);
      }
      if (scene.hasLoad !== oncekiYuk) {
        ses.olay(oncekiYuk ? 'birak' : 'bagla');
        oncekiYuk = scene.hasLoad;
      }
      const t = mission.sonTamamlanan;
      if (t && t.sira !== oncekiSira) {
        oncekiSira = t.sira;
        ses.olay('kondu');
      }
      if (scene.calismaModunda !== oncekiAyak) {
        oncekiAyak = scene.calismaModunda;
        ses.olay('ayak');
      }
      // Ret şeridi YENİ açıldıysa bir kez öt: şerit 3.5 saniye duruyor ve
      // her karede ötseydi alarm olurdu.
      const u = scene.uyari();
      const bas = u?.ret === true ? u.bas : '';
      if (bas !== '' && bas !== oncekiUyari) ses.olay('ret');
      oncekiUyari = bas;
    }

    function detayMetni(): string {
      return dokunmatik ? M.panel.detayDokunma(detay) : M.panel.detayIpucu(detay);
    }

    function updateHud(): void {
      const g = scene.gosterge();

      const gorev = mission.task;
      if (hud.gorev) {
        hud.gorev.textContent = gorev
          ? `${gorev.kod}/${mission.taskCount} · ${gorevAdi(gorev.kod, gorev.ad)}`
            + ` ${gorev.tonnes.toFixed(2)} t`
          : M.ust.bolumTamam;
      }
      if (hud.gorevBrif) {
        hud.gorevBrif.textContent = gorev ? `— ${gorevBrifi(gorev.kod, gorev.brif)}` : '';
      }
      if (hud.sure) hud.sure.textContent = sureyiYaz(mission.score.sure);
      if (hud.puan) hud.puan.textContent = M.ust.puan(mission.score.puan);

      // --- gösterge bloğu ---
      if (hud.baslik) hud.baslik.textContent = g.baslik;
      if (hud.barDolu) {
        hud.barDolu.style.width = `${(g.dolu * 100).toFixed(1)}%`;
        hud.barDolu.style.backgroundColor =
          g.zone === 'red' ? '#E2645A' : g.zone === 'amber' ? '#E8A62C' : '#5FB07C';
      }
      if (hud.yuzde) {
        hud.yuzde.textContent = g.yuzde === null ? '—' : M.yuzde(g.yuzde.toFixed(0));
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
      // buraya hiç dokunmuyor. Detay bayraklı satırlar `I` kapalıyken gizleniyor.
      if (hud.satirlar) {
        hud.satirlar.innerHTML = scene.panelSatirlari()
          .filter((x) => detay || !x.detay)
          .map((x) => `<dt>${x.etiket}</dt>`
            + `<dd${x.vurgu ? ` data-vurgu="${x.vurgu}"` : ''}>${x.deger}</dd>`)
          .join('');
      }
      if (hud.detay) hud.detay.textContent = detayMetni();

    // Pad yeniden çizilince düğme kümesi de değişmiş olabiliyor: ölçüler
    // ancak O ZAMAN yenileniyor.
    if (pad?.guncelle()) olculeriYaz();

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
        const k = M.kondu;
        hud.kondu.innerHTML = [
          `<div class="tik">${k.tik}</div>`,
          `<div class="ad">${t.kod} · ${gorevAdi(t.kod, t.ad)}</div>`,
          `<div class="kazanc">+${pz.toplam} ${k.kazanc}</div>`,
          '<dl>',
          `<dt>${k.yerlestirme}</dt><dd data-iyi="evet">+${pz.temel}</dd>`,
          `<dt>${k.isabet(Math.round(t.sapmaCm))}</dt>`
          + `<dd data-iyi="${yakin ? 'evet' : 'hayir'}">+${pz.isabet}</dd>`,
          `<dt>${k.hiz(sureyiYaz(t.sure))}</dt>`
          + `<dd data-iyi="${pz.hiz > 0 ? 'evet' : 'hayir'}">+${pz.hiz}</dd>`,
          pz.ceza > 0 ? `<dt>${k.ceza}</dt><dd data-iyi="hayir">−${pz.ceza}</dd>` : '',
          `<dt>${k.enYuksekMoment}</dt>`
          + `<dd data-iyi="${lmiIyi ? 'evet' : 'hayir'}">${M.yuzde(t.maxLmi.toFixed(0))}</dd>`,
          '</dl>',
          `<p class="sonraki">${k.sonraki(t.kalan)}</p>`,
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
        if (sonucYazildi && hud.sonuc) {
          hud.sonuc.hidden = true;
          sonucYazildi = false;
          document.body.classList.remove('bitti');
        }
        return;
      }
      if (sonucYazildi || !hud.sonuc || !hud.sonucIc) return;
      sonucYazildi = true;
      // Derece bölüm BİTİNCE yazılıyor; yarıda Esc'lenen tur kayda girmiyor.
      const { rekor, onceki } = enIyiKaydet(arac.id, r);
      const s = r.score;
      const n = M.sonuc;
      const ortSapma = s.sapmalar.length
        ? s.sapmalar.reduce((a, b) => a + b, 0) / s.sapmalar.length : 0;
      hud.sonucIc.innerHTML = [
        `<div class="not" data-not="${r.not}">${r.not}</div>`,
        `<h2>${r.devrildi ? n.devrildi : n.tamamlandi}</h2>`,
        r.usta ? `<p class="rozet">${n.usta}</p>` : '',
        `<p class="toplam">${n.puan(s.puan)}</p>`,
        rekor ? `<p class="rekor">${n.rekor}</p>` : '',
        !rekor && onceki ? `<p class="onceki">${n.oncekiEnIyi(String(onceki.puan))}</p>` : '',
        '<table>',
        `<tr><td>${n.gorev}</td><td>${s.sapmalar.length} / ${mission.taskCount}</td></tr>`,
        `<tr><td>${n.sure}</td><td>${sureyiYaz(s.sure)}</td></tr>`,
        `<tr><td>${n.maxMoment}</td><td>${M.yuzde(s.maxLmi.toFixed(0))}</td></tr>`,
        `<tr><td>${n.kirmizi}</td><td>${s.kirmiziSn.toFixed(1)} ${n.saniye}</td></tr>`,
        `<tr><td>${n.salinim}</td><td>${s.maxSalinim.toFixed(0)}°</td></tr>`,
        `<tr><td>${n.carpma}</td><td>${s.carpma}</td></tr>`,
        `<tr><td>${n.sapma}</td><td>${(ortSapma * 100).toFixed(0)} cm</td></tr>`,
        '</table>',
        `<p class="puan">${n.basari(r.puan.toFixed(0))}</p>`,
        `<p class="note">${dokunmatik
          ? n.dokunmaNot : `${n.yeniden} · ${n.makineDegistir}`}</p>`,
      ].join('');
      hud.sonuc.hidden = false;
      // Sonuç paneli açıkken sürüş/çatal düğmeleri gizleniyor; köşedeki
      // yardımcılar kalıyor, yoksa telefonda turu bitirmenin yolu olmuyor.
      document.body.classList.add('bitti');
    }
  });
}

/**
 * "Yatay tutunca daha iyi" çağrısı.
 *
 * Bir zamanlar KAPI'ydı ve sahadan gelen geri bildirim onu yıktı: *"telefonda
 * denedim ama artifact içinde açıldığı için telefon yatay çevirmeyi tanımıyor,
 * oyunu başlatamıyorum."* Sebebi şu: `orientation: portrait` bir iframe içinde
 * ÇERÇEVENİN en-boyunu okuyor, cihazın değil. Artifact panelinde çerçeve dikey
 * kalıyor, telefon çevrilse bile. Yani oyuncu, sağlayamayacağı bir koşulun
 * arkasına kilitlenmişti.
 *
 * Artık öneri: dikey de oynanıyor (kumanda dar ekranda iki sütuna diziliyor),
 * çağrı kapatılabiliyor ve kapatıldığı hatırlanıyor.
 */
const YATAY_ANAHTARI = 'yv.yatayCagri';
const ZORLA_ANAHTARI = 'yv.yatayZorla';

/**
 * Oyunu kendimiz çeviriyoruz.
 *
 * Telefonun döndürme kilidi açıkken tarayıcı yatayı hiç görmüyor;
 * `screen.orientation.lock()` ise tam ekran istiyor ve iOS'ta hiç yok.
 * Kalan dürüst yol sahneyi 90° döndürmek — oyuncu telefonu fiziksel olarak
 * çeviriyor, her tarayıcıda çalışıyor, izin istemiyor.
 */
function yatayZorla(acik: boolean): void {
  document.body.classList.toggle('yatay-zorla', acik);
  yaz(ZORLA_ANAHTARI, acik ? '1' : '0');
  // Pixi tuvali `resizeTo` ile kabına uyuyor ama bunu pencerenin `resize`
  // olayıyla tetikliyor; CSS dönüşü o olayı doğurmuyor ve tuval eski
  // ölçüsünde kalıyordu. Yerleşim otursun diye bir kare bekleyip haber
  // veriyoruz — aynı olay kameranın alt payını da yeniden ölçtürüyor.
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

function yatayCagrisiniKur(): void {
  const cevir = document.getElementById('cevir');
  if (!cevir) return;
  if (oku(YATAY_ANAHTARI) === 'kapali') document.body.classList.add('cevir-kapali');
  if (oku(ZORLA_ANAHTARI) === '1') document.body.classList.add('yatay-zorla');
  // Simge Unicode değil çizim: `▯` gibi bir karakter telefonun kendi fontunda
  // yoksa boş kutu olarak çıkıyor — hem de tam "telefonunu çevir" derken.
  cevir.innerHTML = '<svg class="simge" viewBox="0 0 40 64" aria-hidden="true">'
    + '<rect x="2.5" y="2.5" width="35" height="59" rx="6" fill="none"'
    + ' stroke="currentColor" stroke-width="3"/>'
    + '<line x1="15" y1="55" x2="25" y2="55" stroke="currentColor"'
    + ' stroke-width="3" stroke-linecap="round"/></svg>'
    + `<div class="bas">${M.cevir.bas}</div><p>${M.cevir.govde}</p>`
    + '<div class="secenekler">'
    + `<button type="button" class="yatay">${M.cevir.yatayOyna}</button>`
    + `<button type="button" class="yine">${M.cevir.yineOyna}</button></div>`;
  const kapat = (): void => {
    document.body.classList.add('cevir-kapali');
    yaz(YATAY_ANAHTARI, 'kapali');
  };
  cevir.querySelector('button.yine')?.addEventListener('click', kapat);
  cevir.querySelector('button.yatay')?.addEventListener('click', () => {
    yatayZorla(true);
    kapat();
  });
}

/** m:ss */
/**
 * mm:ss. Saniye AŞAĞI yuvarlanıyor, yuvarlanmıyor değil.
 *
 * `(sn % 60).toFixed(0)` 1079.7 saniyede "60" üretiyor ve ekranda "17:60"
 * yazıyordu — dakika taşımıyor, çünkü dakikayı `Math.floor` veriyor. Saat
 * hiçbir zaman 60'ı göstermemeli.
 */
function sureyiYaz(sn: number): string {
  const t = Math.max(0, Math.floor(sn));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

boot().catch((err: unknown) => {
  console.error(err);
  const host = document.getElementById('game');
  if (host) {
    host.innerHTML =
      '<p style="color:#E2645A;font:14px monospace;padding:24px">'
      + M.hata(String(err)) + '</p>';
  }
});
