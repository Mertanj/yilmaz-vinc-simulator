import { Box, type Body, type Contact } from 'planck';
import { createWorld, createGround, Snapshotter, SIM } from './world';
import { Truck } from './truck';
import { Outriggers } from './outriggers';
import { Dirsekli, DIRSEKLI, DIRSEKLI_NEUTRAL } from './dirsekli';
import { DIRSEKLI_SPEC as S } from './dirsekliGeometri';
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
 *   luff      -> ana bom (kaldır / indir)
 *   telescope -> kırma   (aç / katla)
 *   winch     -> vinç    (sar / sal)
 */
const girdiyiCevir = (c: SceneInput['crane']): { ana: number; kirma: number; winch: number } =>
  ({ ana: c.luff, kirma: c.telescope, winch: c.winch });

/** Bunun üstündeki normal impuls (N·s) çarpma sayılıyor. */
const CARPMA_ESIGI_NS = 4500;

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
      if (j > CARPMA_ESIGI_NS) this.carpma++;
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
   * Hız eşikleri — ölçülen turdan. Eklemler yavaş (ana 5°/s, kırma 7°/s) ve
   * bölüm kısa; vinçin 90/240 eşiği burada her göreve tam bonus verirdi.
   */
  readonly hizEsikleri = { tam: 55, sifir: 150 };
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
        k.alt.konum(this.bom.anaAciDeg.toFixed(0), this.bom.kirmaAciDeg.toFixed(0)),
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
    if (this.hasLoad) return { metin: k.yukBagli(t), mod: 'crane' };
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
