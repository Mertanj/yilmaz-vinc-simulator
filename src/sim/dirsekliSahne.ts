import { Box, type Body, type Contact } from 'planck';
import { createWorld, createGround, Snapshotter, SIM } from './world';
import { Truck } from './truck';
import { Outriggers } from './outriggers';
import { Dirsekli, DIRSEKLI, DIRSEKLI_NEUTRAL, type DirsekliInput } from './dirsekli';
import { DIRSEKLI_SPEC as S, dirsekliCozum } from './dirsekliGeometri';
import type { Grabbable } from './kanca';
import { AVLU, avluHedefleri, createAvlu } from './avlu';
import { DIRSEKLI_GOREVLER } from '../game/dirsekliGorevler';
import type { Task } from '../game/tasks';
import { OutriggerState } from './loadChart';
import type { SceneInput } from './scene';
import { imzaliDerece, type Gosterge, type OyunSahnesi, type PanelSatiri, type Uyari } from './sahne';
import { M, kumandaAdi } from '../ui/dil';

/**
 * Dirsekli bomun sahnesi — `OyunSahnesi`'nin üçüncü uygulaması.
 *
 * `Mission`, puanlama, kamera ve HUD kabuğu hiç değişmedi; arayüzün o sınırda
 * durmasının karşılığı tam olarak bu. Makineye özgü olan her şey (iki eklem
 * açısı, moment tablosu, kuyruk üstünden çalışma) buradaki `panelSatirlari`,
 * `gosterge` ve `uyari` çıktısından geçiyor.
 */
/**
 * **Girdi paylaşılıyor, yorum makineye ait.** Forklift de aynısını yapıyor:
 * `SceneInput` üç genel eksen taşıyor (`luff`, `telescope`, `winch`) ve her
 * makine onları kendi eklemine bağlıyor. Klavye ve dokunmatik böylece üçüncü
 * makineyi hiç bilmeden sürüyor.
 *
 *   luff      -> ana bom  (kaldır / indir)
 *   telescope -> kırma    (aç / katla)
 *   uzat      -> teleskop (uzat / topla)
 *   winch     -> vinç     (sar / sal)
 */
const girdiyiCevir = (c: SceneInput['crane']): DirsekliInput =>
  ({ ana: c.luff, kirma: c.telescope, uzat: c.uzat, winch: c.winch });

/** Bunun üstündeki normal impuls (N·s) çarpma sayılıyor. */
const CARPMA_ESIGI_NS = 4500;
/**
 * İki çarpma arasındaki en kısa süre (s).
 *
 * **Sürtünme bir çarpmadır, on dört değil.** Eşiksiz hâli ölçüldü: yükü
 * bahçe duvarının üstünden sürterek geçiren bir tur 10–14 çarpma yazıyor ve
 * puandan 1500–2100 götürüyordu — üstelik aynı panelde "bu görevdeki en
 * yüksek moment %59" yazarken, yani hiçbir aşırı yük yokken. Oyuncu bunu
 * geri bildirim değil hata olarak okur.
 *
 * Temas çözücü sürekli bir temasta her karede impuls bildiriyor; sayaç da
 * her karede artıyordu. Gerçekte olan tek olay var: yük duvara değdi.
 */
const CARPMA_BEKLEME_SN = 0.7;

export class DirsekliSahne implements OyunSahnesi {
  readonly world = createWorld();
  readonly snaps = new Snapshotter();
  readonly truck: Truck;
  readonly outriggers: Outriggers;
  readonly bom: Dirsekli;
  load!: Body;
  private loadSpec: Task | null = null;
  grabbables: Grabbable[] = [];
  carpma = 0;
  /** Son çarpmanın üstünden geçen süre (s). */
  private carpmaBekleme = 0;

  constructor() {
    createGround(this.world);
    createAvlu(this.world);
    this.truck = new Truck(this.world, this.snaps, AVLU.spawnX);
    this.outriggers = new Outriggers(this.world, this.truck.chassis, this.snaps);
    this.bom = new Dirsekli(this.world, this.truck.chassis, this.snaps);

    this.spawnLoad(DIRSEKLI_GOREVLER[0] ?? null);

    this.world.on('post-solve', (contact: Contact, impulse: { normalImpulses: number[] }) => {
      const a = contact.getFixtureA().getBody();
      const b = contact.getFixtureB().getBody();
      const ilgili = (x: Body): boolean => x === this.load || x === this.bom.hook;
      if (!ilgili(a) && !ilgili(b)) return;
      const j = Math.max(...(impulse.normalImpulses ?? [0]));
      if (j > CARPMA_ESIGI_NS && this.carpmaBekleme <= 0) {
        this.carpma++;
        this.carpmaBekleme = CARPMA_BEKLEME_SN;
      }
    });
  }

  spawnLoad(spec: Task | null): void {
    if (this.load) this.world.destroyBody(this.load);
    this.loadSpec = spec;
    if (!spec) { this.grabbables = []; return; }
    const body = this.world.createDynamicBody({
      x: AVLU.malzemeX, y: spec.halfHeight + 0.05,
    });
    body.createFixture(new Box(spec.halfWidth, spec.halfHeight), {
      density: 1, friction: 0.85, restitution: 0.02,
    });
    body.setMassData({
      mass: spec.tonnes * 1000,
      center: { x: 0, y: 0 },
      I: (spec.tonnes * 1000 * (spec.halfWidth ** 2 + spec.halfHeight ** 2)) / 3,
    });
    body.setAngularDamping(0.5);
    this.snaps.track(body);
    this.load = body;
    this.grabbables = [{ body, halfWidth: spec.halfWidth, halfHeight: spec.halfHeight }];
  }

  // --- bölüm ---
  readonly gorevler = DIRSEKLI_GOREVLER;
  /**
   * Hız eşikleri — ölçülen turdan. Başsız tur görev başına 90–321 saniye
   * sürüyor (yük 7.2 metre tırmanıyor ve üç eksen birden sürülüyor); ilk
   * kalibrasyon 55/150 idi ve bölüm dikeyleşince her görev sıfır bonus
   * alıyordu. Vinçteki oran korunuyor: rig tam bonus eşiğinin biraz üstünde.
   */
  readonly hizEsikleri = { tam: 100, sifir: 340 };
  private readonly hedefler = avluHedefleri();
  hedefNoktasi(t: Task): { x: number; y: number } | null {
    return this.hedefler[t.hedef] ?? null;
  }
  /**
   * Avlu dar: vinçteki 2 metrelik pencere burada bütün avluyu kaplardı.
   * Döşeme 2.9 m geniş, hedefler de onun üstünde.
   */
  yerlestirmeToleransi(): { x: number; y: number } { return { x: 1.1, y: 0.4 }; }

  get sasiHizi(): number { return this.truck.chassis.getLinearVelocity().x; }
  /** Sahne 25 metre; vinçinki 100'dü. Aynı ölçek burada makineyi karınca yapardı. */
  readonly kameraOlcegi = { yakin: 46, uzak: 26 };
  get devrildiMi(): boolean { return Math.abs(this.tiltDeg) > 8; }
  get loadTask(): Task | null { return this.loadSpec; }

  /** Ayaklar yerdeyse bom fazındayız: sürüş kilitli. */
  get calismaModunda(): boolean { return this.outriggers.fraction > 0.15; }
  get olcum() { return this.bom.lmi; }
  get hasLoad(): boolean { return this.bom.hasLoad; }
  get yukNoktasi(): { x: number; y: number } {
    const p = this.bom.hook.getPosition();
    return { x: p.x, y: p.y };
  }
  get tiltDeg(): number { return (-this.truck.chassis.getAngle() * 180) / Math.PI; }

  salinimDeg(): number {
    const tip = this.bom.tipWorld;
    const h = this.bom.hook.getPosition();
    const dy = tip.y - h.y;
    if (dy < 1.0) return 0;
    return (Math.atan2(h.x - tip.x, dy) * 180) / Math.PI;
  }

  odakNoktalari(): Array<{ x: number; y: number }> {
    const c = this.truck.chassis.getPosition();
    return [{ x: c.x, y: c.y + 1.6 }, this.bom.tipWorld, this.yukNoktasi];
  }

  step(input: SceneInput, dt: number): void {
    this.carpmaBekleme = Math.max(0, this.carpmaBekleme - dt);
    if (input.reset) {
      this.truck.reset(AVLU.spawnX);
      this.outriggers.reset(this.truck.chassis);
    }
    if (input.toggleOutriggers) this.outriggers.toggle();

    const bomModu = this.calismaModunda;
    this.bom.setStowed(!bomModu);
    if (input.toggleHook && bomModu) this.bom.requestToggleAttach();

    this.snaps.capture();

    this.truck.drive(bomModu ? { throttle: 0, handbrake: true } : input.drive);
    this.outriggers.update(dt);

    this.bom.update(bomModu ? girdiyiCevir(input.crane) : DIRSEKLI_NEUTRAL, dt, this.bom.lmi);
    this.bom.applyToWorld(dt);

    this.world.step(dt, SIM.velocityIterations, SIM.positionIterations);
    this.world.clearForces();

    this.bom.sampleLmi(dt);
    this.bom.flushJointQueue(this.grabbables);
  }

  // --- HUD ---
  private get tabloDisi(): boolean { return this.bom.tabloDisi; }

  gosterge(): Gosterge {
    const r = this.olcum;
    const d = M.vinc;
    const k = M.dirsekli;
    const pct = this.tabloDisi || !Number.isFinite(r.percent)
      ? null : Math.min(999, r.percent);
    return {
      baslik: k.baslik,
      yuzde: pct,
      durum: this.tabloDisi ? d.durum.tabloDisi
        : r.zone === 'red' ? d.durum.asiriYuk
        : r.zone === 'amber' ? d.durum.dikkat : d.durum.guvenli,
      zone: r.zone,
      dolu: Math.min(1, (pct ?? 999) / 150),
      altSatirlar: [
        k.alt.moment(S.momentTm.toFixed(0)),
        // **Eklem açıları değil, UCUN YERİ.** Önce "ana 78° · kırma 121°"
        // yazıyordu ve sahadan gelen teşhis şuydu: panel eklemlerin açısını
        // söylüyor ama ucun nereye gideceğini hiç söylemiyor. Üç eklemli bir
        // bomda oyuncunun kafasındaki soru açı değil, "uç nerede" — özellikle
        // teleskop yönü kırma açısına göre işaret değiştirdiği için. Açılar
        // detay satırlarında duruyor.
        k.alt.uc(this.bom.radiusM.toFixed(1), this.bom.tipWorld.y.toFixed(1)),
      ],
    };
  }

  panelSatirlari(): PanelSatiri[] {
    const r = this.olcum;
    const d = M.vinc;
    const k = M.dirsekli;
    const egim = this.tiltDeg;
    return [
      { etiket: d.satir.kancada, deger: `${r.loadTonnes.toFixed(2)} t` },
      { etiket: `${M.panel.sinir} · ${k.satir.sinirMoment}`,
        deger: this.tabloDisi ? d.satir.tabloDisi : `${r.capacityTonnes.toFixed(2)} t` },
      { etiket: d.satir.yaricap, deger: `${this.bom.radiusM.toFixed(1)} m` },
      { detay: true, etiket: k.satir.anaBom, deger: `${this.bom.anaAciDeg.toFixed(0)}°` },
      { detay: true, etiket: k.satir.kirma, deger: `${this.bom.kirmaAciDeg.toFixed(0)}°` },
      { detay: true, etiket: k.satir.uzama, deger: `${this.bom.uzamaBoyuM.toFixed(1)} m` },
      { detay: true, etiket: d.satir.halat, deger: `${this.bom.halatBoyuM.toFixed(1)} m`,
        ...(this.bom.ikiBlokta ? { vurgu: 'kotu' as const } : {}) },
      { detay: true, etiket: k.satir.ucKotu, deger: `${this.bom.tipWorld.y.toFixed(1)} m` },
      { detay: true, ...this.onPabucSatiri(k) },
      { detay: true, etiket: d.satir.ayaklar,
        deger: { [OutriggerState.Stowed]: d.satir.toplu,
                 [OutriggerState.Half]: d.satir.yariAcik,
                 [OutriggerState.Full]: d.satir.tamAcik }[this.outriggers.state],
        vurgu: this.outriggers.state === OutriggerState.Full ? 'iyi'
          : this.outriggers.state === OutriggerState.Half ? 'uyari' : undefined },
      { detay: true, etiket: M.panel.egim, deger: imzaliDerece(egim, 1),
        ...(Math.abs(egim) > 3 ? { vurgu: 'kotu' as const } : {}) },
      { detay: true, etiket: M.panel.hiz,
        deger: `${this.truck.speedKmh.toFixed(0)} ${M.panel.hizBirimi}` },
    ];
  }

  /**
   * ÖN pabucun payı — vinçteki arka pabuç satırının aynadaki hâli.
   *
   * Bu makine kuyruğunun üstünden çalışıyor, dolayısıyla devrilme ARKA pabuç
   * etrafında oluyor ve boşalan ön pabuç.
   *
   * **Ama vinçteki yerinde DURMUYOR: detaya indi.** Sebep ölçüm. Vinçte bu
   * satır bölüm boyunca %60.4 ile %23.8 arasında geziniyor ve devrilmenin
   * ikinci tanığı olarak gerçekten iş görüyor. Burada bütün bölüm boyunca
   * %41.0 ile %35.9 arasında kaldı — beş puanlık bir bant — ve şasi eğimi
   * hiç 0.00°'den ayrılmadı. Sebebi de açık: 25 tonluk kamyonun üstünde
   * 9 ton·metrelik bir vinç var; bu makine devrilmiyor, MOMENTİ bitiyor.
   *
   * Satır duruyor çünkü ölçtüğü şey gerçek, ama panelin her zaman görünen
   * üç satırından birini işgal etmesi yalan olurdu: oyuncunun anlık kararını
   * yük tablosu veriyor. Eşikler de ölçülen banda göre (%26 / %18); vinçin
   * %40 eşiği burada bölüm boyunca yanıp sönerdi.
   */
  private onPabucSatiri(k: typeof M.dirsekli): PanelSatiri {
    const pay = this.outriggers.pabucPayi('on');
    if (pay === null) return { etiket: k.satir.onPabuc, deger: '—' };
    return {
      etiket: k.satir.onPabuc, deger: M.yuzde((pay * 100).toFixed(0)),
      ...(pay < 0.18 ? { vurgu: 'kotu' as const }
        : pay < 0.26 ? { vurgu: 'uyari' as const } : {}),
    };
  }

  uyari(): Uyari | null {
    const r = this.olcum;
    const u = M.vinc.uyari;
    const k = M.dirsekli;
    const kilitli = this.bom.kilitliDenendi;
    if (!this.calismaModunda) return null;

    // **Sıkışma en önde.** Diğer uyarılar süregelen bir DURUMU anlatıyor
    // (yük ağır, yarıçap uzun); bu ise bir OLAYI: makine şu anda bir şeyi
    // eziyor ve hidrolik kesildi. Çıkış yolunu da söylemesi gerekiyor,
    // yoksa oyuncu kilitli bir makineyle baş başa kalıyor.
    if (this.bom.hidrolikDurdu) {
      return {
        zone: 'red', carpiyor: kilitli,
        bas: k.uyari.sikismaBas, govde: k.uyari.sikismaGovde,
        cozum: k.uyari.sikismaCozum,
      };
    }
    if (this.bom.ikiBlokta && (kilitli || this.hasLoad)) {
      return {
        zone: 'red', carpiyor: kilitli,
        bas: u.ikiBlokBas, govde: u.ikiBlokGovde, cozum: u.ikiBlokCozum,
      };
    }
    if (this.tabloDisi) {
      return {
        zone: 'red', carpiyor: kilitli,
        bas: u.tabloDisiBas,
        govde: u.tabloDisiGovde(this.bom.radiusM.toFixed(1)),
        cozum: k.uyari.tabloDisiCozum,
      };
    }
    if (r.zone === 'red') {
      return {
        zone: 'red', carpiyor: kilitli,
        bas: u.asiriBas,
        govde: u.asiriGovde(r.loadTonnes.toFixed(2), this.bom.radiusM.toFixed(1),
          r.capacityTonnes.toFixed(2)),
        cozum: kilitli ? k.uyari.asiriCozumKilitli : k.uyari.asiriCozum,
      };
    }
    if (r.zone === 'amber') {
      return {
        zone: 'amber', carpiyor: false,
        bas: u.yakinBas,
        govde: u.yakinGovde(r.loadTonnes.toFixed(2), r.capacityTonnes.toFixed(2),
          this.bom.radiusM.toFixed(1)),
        cozum: '',
      };
    }
    return null;
  }

  /**
   * Güncel hedefin istediği teleskop uzaması (m); hedef yoksa ya da
   * erişilemiyorsa null.
   *
   * Hedefin biraz ÜSTÜ soruluyor, hedefin kendisi değil: yükü bırakmak için
   * ucun yükün boyu ve halat kadar yukarıda durması gerekiyor.
   */
  private gerekenUzama(): number | null {
    const t = this.loadTask;
    const h = t ? this.hedefNoktasi(t) : null;
    if (!t || !h) return null;
    const c = dirsekliCozum(this.bom.dunyadanYerele({
      x: h.x, y: h.y + t.halfHeight * 2 + 1.0,
    }));
    return c ? c.uzamaM : null;
  }

  ipucu(): { metin: string; mod: 'drive' | 'crane' | 'ready' } {
    const i = M.vinc.ipucu;
    const k = M.dirsekli.ipucu;
    const t = kumandaAdi();
    if (!this.calismaModunda) {
      // **Cebi geçtiyse söyle.** Fiziksel takoz olmadığı için geri geri
      // yanaşmanın doğal bir sonu yok: kamyon bahçe duvarına dayanana kadar
      // gidiyor ve orada tabla malzemenin BERİSİNE düşüyor, yani yükü
      // alamıyor. Kurtarılabilir bir durum (ayakları topla, ileri al) ama
      // oyuncunun neyin yanlış olduğunu tahmin etmesi gerekirdi.
      const x = this.truck.chassis.getPosition().x;
      if (x < AVLU.parkX - AVLU.parkPayiM) {
        return { metin: k.cebiGectin, mod: 'drive' };
      }
      return { metin: k.yanasma(t), mod: 'drive' };
    }
    if (this.hasLoad) {
      // **Teleskobu KEŞFETTİRMEK gerekiyor.** Dördüncü eksen tuş listesinde
      // yazıyor ama oyun içinde hiçbir şey onu istemiyordu; üst teraslara
      // teleskop olmadan çıkılamıyor ve oyuncunun bunu tahmin etmesi
      // gerekirdi. Ters kinematik zaten hedefin ne kadar uzama istediğini
      // biliyor — soruyoruz ve cevabı satıra yazıyoruz.
      // **Duvar uyarısı en önde.** Sahadan gelen en ağır bulgu buydu: ilk
      // görevde hedef alçak olduğu için oyuncu bomu kaldırmadan yatay
      // gidiyor, yük bahçe duvarının üstünü sürüyor ve tur 10–14 çarpma
      // yazıyor. Geometri acımasız: kanca sonuna kadar sarılıyken bile yük
      // ucun 1.7 metre altında asılı kalıyor, yani 3 metrelik duvarı aşmak
      // için ucun 4.7 metrede olması gerekiyor — alma pozunda 4.4.
      // Makine bunu zaten biliyor; söylemesi yetiyor.
      const l = this.load.getPosition();
      const gorev = this.loadTask;
      const yukAlti = l.y - (gorev ? gorev.halfHeight : 0);
      if (l.x > AVLU.duvarSag && yukAlti < AVLU.duvarY + 0.35) {
        return { metin: k.duvariAs, mod: 'crane' };
      }
      const gereken = this.gerekenUzama();
      if (gereken !== null && gereken > this.bom.uzamaBoyuM + 0.35) {
        return { metin: k.uzat(t), mod: 'crane' };
      }
      return { metin: k.yukBagli(t), mod: 'crane' };
    }
    const { reason } = this.bom.attachCheck(this.grabbables);
    const say: Record<typeof reason, string> = {
      hazir: i.hazir(t),
      sallaniyor: i.sallaniyor,
      'yan-cekme': i.yanCekme,
      ortala: i.ortala,
      yukseklik: i.yukseklik,
      uzak: k.uzak(t),
    };
    return { metin: say[reason], mod: reason === 'hazir' ? 'ready' : 'crane' };
  }
}

export { DIRSEKLI };
