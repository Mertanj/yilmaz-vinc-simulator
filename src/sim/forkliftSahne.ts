import { Box, Polygon, Vec2, type Body, type Contact, type World } from 'planck';
import { createWorld, createGround, KATEGORI, MASKE, Snapshotter, SIM } from './world';
import { Forklift, forkliftKapasitesi, FORKLIFT_NEUTRAL } from './forklift';
import type { Grabbable } from './crane';
import { LmiZone, type LmiReading } from './loadChart';
import {
  FORKLIFT_TASKS, GIRIS_X, PALET_AYAK, RAF_DERINLIK, RAF_KATLARI, RAF_X,
  TESLIM_HIZI, TESLIM_KOTU, katKotu,
} from '../game/forkliftTasks';
import type { Task } from '../game/tasks';
import type { SceneInput } from './scene';
import type { Gosterge, OyunSahnesi, PanelSatiri, Uyari } from './sahne';
import { imzaliDerece } from './sahne';
import { M, kumandaAdi } from '../ui/dil';

/**
 * Rafın çarpışma gövdesi.
 *
 * **Kirişler makineyle ÇARPIŞMIYOR.** Yan görünümde raf derinlik yönünde
 * durur; forklift onun önündeki koridorda ilerler. İlk sürümde bu modellenmiş
 * değildi ve en alt kat şasinin üstüne çıkarılmak zorunda kalmıştı — yani
 * level, eksik bir filtreyi telafi etmek için yalan söylüyordu. Şimdi kirişler
 * yükle ve çatalla çarpışıyor, gövdeyle değil; raf da olması gereken yerde.
 */
export function createRaf(world: World): Body {
  const body = world.createBody();
  const filtre = { filterCategoryBits: KATEGORI.raf, filterMaskBits: MASKE.raf };
  for (const kot of RAF_KATLARI) {
    // Kat kirişi. **Ön kenarı PAHLI** — dikdörtgen kiriş çatalı yakalıyordu:
    // bırakma sonrası bıçak kirişle aynı kota denk gelirse geri çekilirken
    // altına giriyor, krikoya dönüşüp makineyi 146 dereceye kadar döndürüyordu.
    // Gerçek raf kirişinin de ön yüzü kıvrık; kama profil bıçağı yakalamak
    // yerine yukarı ya da aşağı kaydırıyor.
    const on = RAF_X;
    const arka = RAF_X + RAF_DERINLIK;
    body.createFixture(new Polygon([
      new Vec2(on, kot - 0.08),
      new Vec2(on + 0.12, kot - 0.16),
      new Vec2(arka, kot - 0.16),
      new Vec2(arka, kot),
      new Vec2(on + 0.12, kot),
    ]), { friction: 0.9, ...filtre });
    // Arka dayanak: yük rafı geçip arkaya düşmesin. **Tam boy dikme DEĞİL** —
    // dikme koridoru kapatıyor ve makine rafın doğusundaki giriş alanına hiç
    // geçemiyordu. Gerçek rafta da dikmeler derinlik yönünde durur.
    body.createFixture(
      new Box(0.07, 0.26, new Vec2(RAF_X + RAF_DERINLIK, kot + 0.26), 0),
      { friction: 0.6, ...filtre },
    );
  }
  return body;
}

/**
 * Forklift sahnesi.
 *
 * Vinç sahnesiyle aynı arayüzü uyguluyor, dolayısıyla görev akışı, puanlama,
 * kamera ve HUD kabuğu hiç değişmeden çalışıyor. Farklı olan tek şey makine
 * ve onun ölçüsü: burada yarıçap değil YÜK MERKEZİ MESAFESİ, halat değil
 * kaldırma yüksekliği bağlıyor.
 */
export class ForkliftSahnesi implements OyunSahnesi {
  readonly world = createWorld();
  readonly snaps = new Snapshotter();
  readonly forklift: Forklift;
  load!: Body;
  private loadSpec: Task | null = null;
  grabbables: Grabbable[] = [];
  carpma = 0;
  private olcumTon = 0;
  /** Palet konveyörde mi, iniyor mu, yerde mi? */
  private teslim: 'bekliyor' | 'iniyor' | 'hazir' = 'hazir';

  constructor() {
    createGround(this.world);
    createRaf(this.world);
    this.forklift = new Forklift(this.world, this.snaps);
    this.spawnLoad(FORKLIFT_TASKS[0] ?? null);

    this.world.on('post-solve', (contact: Contact, impulse: { normalImpulses: number[] }) => {
      const a = contact.getFixtureA().getBody();
      const b = contact.getFixtureB().getBody();
      if (a !== this.load && b !== this.load) return;
      // Çataldaki yük her adım setTransform ile yerine konuyor; onun temas
      // impulsu gerçek bir çarpma değil, kinematik sürüşün artığı. Sadece
      // SERBEST yükün çarpması sayılıyor.
      if (this.forklift.hasLoad) return;
      const j = Math.max(...(impulse.normalImpulses ?? [0]));
      if (j > 9000) this.carpma++;
    });
  }

  spawnLoad(spec: Task | null): void {
    if (this.load) this.world.destroyBody(this.load);
    this.loadSpec = spec;
    if (!spec) { this.grabbables = []; return; }
    // **Palet ancak makine yükleme karesinin BATISINDAYKEN iniyor.**
    // Forklift dönemediği için paleti alabilmek hep onun batısında olmak
    // demek; oysa önceki paleti rafa bırakınca makine doğuda kalıyor. Palet
    // önceden yerde dursaydı makine batıya dönerken onu önüne katardı
    // (ölçüldü: palet 1.7 metre süründü, çatal cebe hiç girmedi). Mal kabul
    // konveyörü sahada da tam olarak bunu yapıyor: sen yerine geçince indirir.
    const yerKotu = spec.halfHeight + PALET_AYAK;
    const acik = this.forklift.forkTip.x < this.teslimKapisi(spec.halfWidth);
    this.teslim = acik ? 'hazir' : 'bekliyor';
    const body = this.world.createDynamicBody({
      x: GIRIS_X, y: acik ? yerKotu : TESLIM_KOTU + spec.halfHeight,
    });
    if (!acik) body.setType('kinematic');
    // Yükün kendisi: her şeye değiyor.
    body.createFixture(new Box(spec.halfWidth, spec.halfHeight), {
      density: 1, friction: 0.9, restitution: 0.01,
      filterCategoryBits: KATEGORI.yuk, filterMaskBits: MASKE.yuk,
    });
    // **Paletin ayakları.** Cebi açan şey bunlar: yük zeminden 15 cm yukarıda
    // duruyor ve çatal altına giriyor. Ayaklar çatalla ÇARPIŞMIYOR, çünkü
    // gerçekte çatal takozların arasından geçer — yandan bakınca içinden
    // geçiyormuş gibi görünür, 2B'de bunu ancak filtreyle anlatabiliyoruz.
    for (const sx of [-1, 1]) {
      body.createFixture(
        new Box(0.16, PALET_AYAK / 2,
          new Vec2(sx * (spec.halfWidth - 0.18), -spec.halfHeight - PALET_AYAK / 2), 0),
        { density: 0.2, friction: 0.9,
          filterCategoryBits: KATEGORI.paletAyagi,
          filterMaskBits: MASKE.paletAyagi & MASKE.yuk },
      );
    }
    this.load = body;
    this.kutleyiYaz(spec);
    body.setAngularDamping(0.6);
    this.snaps.track(body);
    this.grabbables = [{
      body, halfWidth: spec.halfWidth, halfHeight: spec.halfHeight, ayakM: PALET_AYAK,
    }];
  }

  /** Forklift bölümü — depo. Hedefler raf katları. */
  readonly gorevler = FORKLIFT_TASKS;
  /** Ölçülen tur: görev başına 26–35 s. Forklift bölümü kısa, eşik de öyle. */
  readonly hizEsikleri = { tam: 22, sifir: 70 };
  hedefNoktasi(t: Task): { x: number; y: number } | null {
    const kot = katKotu(t.hedef);
    if (kot === undefined) return null;
    // **Rafın ORTASI değil, ÖN KENARI.** Paleti dibine kadar sokmak çatalı
    // bir buçuk metre rafın içine sokmak demek; geri çekilirken bıçak kirişe
    // takılıyor ve makine şahlanıyordu. Sahada da palet gözün ön kenarına
    // konur — çatal ancak paletin boyu kadar içeri girer.
    // Palet rafa AYAKLARIYLA oturuyor: tabanı kirişin `PALET_AYAK` üstünde.
    return { x: RAF_X + t.halfWidth + 0.06, y: kot + PALET_AYAK };
  }
  /** Hedef işareti kirişin ÜSTÜNDE dursun, paletin tabanında değil. */
  isaretNoktasi(t: Task): { x: number; y: number } | null {
    const kot = katKotu(t.hedef);
    return kot === undefined ? null : { x: RAF_X + t.halfWidth + 0.06, y: kot };
  }
  /**
   * Rafın içine oturmalı. Vinçteki 2 metrelik pencere burada anlamsız olurdu
   * — teras geniş bir düzlem, raf katı ise paletten birkaç on santim büyük.
   */
  yerlestirmeToleransi(t: Task): { x: number; y: number } {
    // Yük rafın derinliğine sığmalı: geniş palette hata payı 30 cm'e iniyor.
    return { x: Math.max(0.2, (RAF_DERINLIK - t.halfWidth * 2) / 2), y: 0.32 };
  }
  get sasiHizi(): number { return this.forklift.chassis.getLinearVelocity().x; }
  /** Küçük makine, dar koridor: vinçten belirgin biçimde daha yakın. */
  readonly kameraOlcegi = { yakin: 46, uzak: 24 };
  /**
   * Forklift için devrilme eşiği yüksek — ÇÜNKÜ burnunu çatalına dayamak
   * kaza değil, kurtarılabilir bir hata. Ölçümde aşırı yükte makine 2.1°
   * eğilip çatalının üstünde duruyor; oradan geri gidip yükü bırakabiliyor.
   * Gerçek devrilme yük yukarıdayken oluyor ve çok daha büyük bir açı.
   */
  get devrildiMi(): boolean { return Math.abs(this.tiltDeg) > 22; }

  private kutleyiYaz(spec: Task): void {
    this.load.setMassData({
      mass: spec.tonnes * 1000, center: { x: 0, y: 0 },
      I: (spec.tonnes * 1000 * (spec.halfWidth ** 2 + spec.halfHeight ** 2)) / 3,
    });
  }

  get loadTask(): Task | null { return this.loadSpec; }
  /** Forkliftte kurulum yok: makine indiği an çalışır. */
  get calismaModunda(): boolean { return true; }
  get hasLoad(): boolean { return this.forklift.hasLoad; }
  get tiltDeg(): number { return (-this.forklift.chassis.getAngle() * 180) / Math.PI; }
  get yukNoktasi(): { x: number; y: number } { return this.forklift.forkWorld; }
  /** Forkliftte sarkaç yok — yük çatala kilitli. */
  salinimDeg(): number { return 0; }

  /**
   * Arka aksın taşıdığı yükün, boş makinedeki payına oranı.
   *
   * Forkliftin devrilme göstergesi bu: yük tablosu "kaldırabilir misin"i
   * söylüyor, bu ise "şu anda ne kadar payın kaldı"yı. 0'a inmesi arka
   * tekerin havalanması demek ve ölçüm — süspansiyon mafsalının tepki
   * kuvvetinden okunuyor, tahmin değil.
   */
  get arkaAksPayi(): number {
    return Math.max(0, Math.min(1.5, this.forklift.arkaAksN / this.forklift.arkaAksStatikN));
  }

  odakNoktalari(): Array<{ x: number; y: number }> {
    const c = this.forklift.chassis.getPosition();
    const f = this.forklift.forkWorld;
    return [{ x: c.x, y: c.y + 1.2 }, { x: f.x, y: f.y + 1.0 }];
  }

  get olcum(): LmiReading {
    const merkez = this.forklift.loadCentreM;
    const kap = forkliftKapasitesi(merkez, this.forklift.liftM);
    const toplam = this.olcumTon;
    const percent = kap <= 0 ? Infinity : (toplam / kap) * 100;
    const zone = percent > 100 ? LmiZone.Red : percent >= 80 ? LmiZone.Amber : LmiZone.Green;
    return {
      percent, zone,
      capacityTonnes: kap, chartTonnes: kap, ropeTonnes: kap, limitedBy: 'tablo',
      loadTonnes: toplam, radiusM: merkez,
      speedScale: zone === LmiZone.Red ? 0.3 : zone === LmiZone.Amber ? 0.6 : 1,
      blockRadiusIncrease: zone === LmiZone.Red,
    };
  }

  step(input: SceneInput, dt: number): void {
    if (input.reset) this.forklift.reset();

    this.snaps.capture();
    this.forklift.drive(input.drive, dt);
    // Vinç kolları forkliftte kaldırma ve eğim oluyor: W/S çatal, ⇧W/⇧S direk.
    // **Yük alma tuşu yok** — çatal paleti fiziken kaldırıyor.
    this.forklift.update(
      { lift: input.crane.luff, tilt: input.crane.telescope },
      dt, this.olcum.blockRadiusIncrease, this.grabbables,
    );

    this.teslimiYurut();

    this.world.step(dt, SIM.velocityIterations, SIM.positionIterations);
    this.world.clearForces();

    // Ölçüm: çatalda ne varsa onun ağırlığı.
    const ham = this.forklift.yukTonu;
    this.olcumTon += (ham - this.olcumTon) * Math.min(1, dt / 0.2);
  }

  /** Yükleme karesine palet indirme akışı. */
  private teslimiYurut(): void {
    const spec = this.loadSpec;
    if (!spec || this.teslim === 'hazir') return;
    if (this.teslim === 'bekliyor') {
      if (this.forklift.forkTip.x >= this.teslimKapisi(spec.halfWidth)) return;
      this.load.setLinearVelocity({ x: 0, y: -TESLIM_HIZI });
      this.teslim = 'iniyor';
      return;
    }
    const yerKotu = spec.halfHeight + PALET_AYAK;
    if (this.load.getPosition().y > yerKotu) return;
    // Yere değdi: artık normal dinamik gövde. setType kütleyi sıfırladığı
    // için kütle verisi yeniden yazılıyor — vinçteki kanca hatasının aynısı.
    this.load.setTransform({ x: GIRIS_X, y: yerKotu }, 0);
    this.load.setType('dynamic');
    this.load.setLinearVelocity({ x: 0, y: 0 });
    this.load.setAngularVelocity(0);
    this.kutleyiYaz(spec);
    this.teslim = 'hazir';
  }

  /** Paletin inebilmesi için çatal ucunun batısında kalması gereken çizgi. */
  private teslimKapisi(halfWidth: number): number {
    return GIRIS_X - halfWidth - 0.45;
  }

  /** Palet yere indi mi? HUD ve rig bunu soruyor. */
  get paletHazir(): boolean { return this.teslim === 'hazir'; }

  gosterge(): Gosterge {
    const r = this.olcum;
    const d = M.forklift;
    const pct = Number.isFinite(r.percent) ? Math.min(999, r.percent) : 999;
    const devrilme = Math.abs(this.tiltDeg);
    return {
      baslik: d.baslik,
      yuzde: pct,
      durum: r.zone === LmiZone.Red ? d.durum.devrilir
        : r.zone === LmiZone.Amber ? d.durum.dikkat
        : this.arkaAksPayi < 0.25 ? d.durum.bosaliyor
        : devrilme > 1.5 ? d.durum.oneYatiyor : d.durum.guvenli,
      zone: r.zone === LmiZone.Red ? 'red' : r.zone === LmiZone.Amber ? 'amber' : 'green',
      dolu: Math.min(1, pct / 150),
      altSatirlar: [
        d.alt.merkez(r.radiusM.toFixed(2)),
        this.forklift.liftM > 3.3
          ? d.alt.ustuDusuyor((forkliftKapasitesi(r.radiusM, this.forklift.liftM)
              / Math.max(forkliftKapasitesi(r.radiusM, 0), 0.01)).toFixed(2))
          : d.alt.alcakTasi,
      ],
    };
  }

  panelSatirlari(): PanelSatiri[] {
    const r = this.olcum;
    const d = M.forklift;
    const egim = this.tiltDeg;
    const f = this.forklift;
    return [
      // Her zaman görünen üç satır: çatalda ne var, sınır ne, payın ne kadar.
      { etiket: d.satir.catalda, deger: `${r.loadTonnes.toFixed(2)} t` },
      { etiket: M.panel.sinir, deger: `${r.capacityTonnes.toFixed(2)} t` },
      { etiket: d.satir.arkaAks, deger: M.yuzde((this.arkaAksPayi * 100).toFixed(0)),
        ...(this.arkaAksPayi < 0.25 ? { vurgu: 'kotu' as const }
          : this.arkaAksPayi < 0.45 ? { vurgu: 'uyari' as const } : {}) },
      // Gerisi detay.
      { detay: true, etiket: d.satir.yukMerkezi, deger: `${r.radiusM.toFixed(2)} m` },
      { detay: true, etiket: d.satir.catalKotu, deger: `${f.liftM.toFixed(2)} m`,
        ...(f.liftM > 3.3 ? { vurgu: 'uyari' as const } : {}) },
      { detay: true, etiket: d.satir.direkEgimi,
        deger: imzaliDerece(f.tiltDeg),
        ...(f.tiltDeg < 0 && f.hasLoad ? { vurgu: 'kotu' as const } : {}) },
      { detay: true, etiket: M.panel.egim, deger: imzaliDerece(egim, 1),
        ...(Math.abs(egim) > 1.5 ? { vurgu: 'kotu' as const } : {}) },
      { detay: true, etiket: M.panel.hiz, deger: `${f.speedKmh.toFixed(0)} ${M.panel.hizBirimi}` },
    ];
  }

  uyari(): Uyari | null {
    const r = this.olcum;
    const u = M.forklift.uyari;
    const kilitli = this.forklift.kilitliDenendi;
    const egim = this.tiltDeg;

    if (this.forklift.burunYerde) {
      return {
        zone: 'red', carpiyor: true,
        bas: u.burunBas, govde: u.burunGovde(egim.toFixed(1)), cozum: u.burunCozum,
      };
    }
    if (this.arkaAksPayi < 0.2 && this.forklift.hasLoad) {
      return {
        zone: 'red', carpiyor: true,
        bas: u.arkaBas,
        govde: u.arkaGovde((this.arkaAksPayi * 100).toFixed(0)),
        cozum: u.arkaCozum,
      };
    }
    if (r.zone === LmiZone.Red) {
      return {
        zone: 'red', carpiyor: kilitli,
        bas: u.asiriBas,
        govde: u.asiriGovde(r.loadTonnes.toFixed(2), r.radiusM.toFixed(2),
          this.forklift.liftM.toFixed(2), r.capacityTonnes.toFixed(2)),
        cozum: kilitli ? u.asiriCozumKilitli : u.asiriCozum,
      };
    }
    if (r.zone === LmiZone.Amber) {
      return {
        zone: 'amber', carpiyor: false,
        bas: u.yakinBas,
        govde: u.yakinGovde(r.loadTonnes.toFixed(2), r.capacityTonnes.toFixed(2),
          r.radiusM.toFixed(2)),
        cozum: '',
      };
    }
    return null;
  }

  ipucu(): { metin: string; mod: 'drive' | 'crane' | 'ready' } {
    const i = M.forklift.ipucu;
    if (!this.paletHazir) {
      return {
        metin: this.teslim === 'iniyor' ? i.teslimIniyor : i.teslimBekle,
        mod: 'drive',
      };
    }
    const durum = this.forklift.durum(this.grabbables);
    const k = kumandaAdi();
    const say: Record<typeof durum, string> = {
      yuklu: i.yuklu, hazir: i.hazir(k), yuksek: i.yuksek(k),
      alcak: i.alcak(k), yanas: i.yanas, kot: i.kot(k), uzak: i.uzak,
    };
    return {
      metin: say[durum],
      mod: durum === 'hazir' ? 'ready' : durum === 'yuklu' ? 'crane' : 'drive',
    };
  }

  reset(): void { this.forklift.reset(); }
}

export { FORKLIFT_NEUTRAL, FORKLIFT_TASKS, RAF_KATLARI, RAF_X, RAF_DERINLIK };
