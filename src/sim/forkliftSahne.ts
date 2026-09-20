import { Box, Polygon, Vec2, type Body, type Contact, type World } from 'planck';
import { createWorld, createGround, KATEGORI, MASKE, Snapshotter, SIM } from './world';
import { Forklift, forkliftKapasitesi, FORKLIFT_NEUTRAL } from './forklift';
import type { Grabbable } from './crane';
import { LmiZone, type LmiReading } from './loadChart';
import {
  ADA_X, BEKLEME_CIZGISI, FORKLIFT_TASKS, GIRIS_X, PALET_AYAK, RAF_DERINLIK,
  RAF_KATLARI, RAF_X, TESLIM_HIZI, TESLIM_KOTU, ZEMIN_BANDI, adresKotu, adresX,
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
  for (const on of ADA_X) {
    const arka = on + RAF_DERINLIK;
    for (const kot of RAF_KATLARI) {
      // **Zemin gözünün kirişi yok.** Kot sıfırsa palet doğrudan betona
      // oturuyor; gerçek rafta da en alt palet zemindedir. Bu bir estetik
      // tercih değil, level'ın çalışma şartı: 1.30 metredeki bir kiriş,
      // taşıma kotunda giden paletin (üstü 1.41 m) tam üstüne geliyor ve
      // makine ikinci adaya hiç geçemiyordu.
      if (kot <= 0.001) continue;
      // Kat kirişi. **Ön yüzü DÜZ, alt ve üst kenarı pahlı.**
      //
      // Önce tamamen kama profildi, çünkü dikdörtgen kiriş bıçağı
      // yakalıyordu: bırakma sonrası bıçak kirişle aynı kota denk gelirse
      // geri çekilirken altına giriyor, krikoya dönüşüp makineyi 146
      // dereceye kadar döndürüyordu. Kama alttan geleni kurtardı ama yeni
      // bir bıçak ağzı yarattı — ölçüldü: çatalını 4.35'te unutup koridorda
      // ilerleyen makine kamanın tepesine dayanıp 120 dereceye devrildi.
      //
      // Gerçek raf kirişi de böyle: 10 santimlik düz bir ön yüz, üstte ve
      // altta kıvrık kenar. Düz yüze çarpan bıçak DURUYOR; alttan ya da
      // üstten gelen kayıp kurtuluyor. İkisi de gerekli.
      body.createFixture(new Polygon([
        new Vec2(on, kot - 0.13),
        new Vec2(on + 0.06, kot - 0.16),
        new Vec2(arka, kot - 0.16),
        new Vec2(arka, kot),
        new Vec2(on + 0.06, kot),
        new Vec2(on, kot - 0.03),
      ]), { friction: 0.9, ...filtre });
      // Arka dayanak: yük gözü geçip arkaya düşmesin. **Tam boy dikme DEĞİL** —
      // dikme koridoru kapatıyor ve makine adanın doğusuna hiç geçemiyordu.
      // Gerçek rafta da dikmeler derinlik yönünde durur.
      //
      // **Batı yüzü de PAHLI**, kirişin ön kenarı gibi ve aynı sebeple:
      // dikdörtgen dayanak, batıdan gelen bıçağı yakalıyordu. Ölçüldü —
      // çatalı 3.55 metrede unutup koridorda ilerleyen makine dayanağa
      // takılıp 92 dereceye devrildi. Gerçek raf arka dayanağı da yuvarlak
      // profildir; bıçağı kilitlemek yerine yukarı kaydırır.
      body.createFixture(new Polygon([
        new Vec2(arka - 0.07, kot + 0.16),
        new Vec2(arka + 0.07, kot),
        new Vec2(arka + 0.07, kot + 0.52),
        new Vec2(arka - 0.07, kot + 0.52),
      ]), { friction: 0.6, ...filtre });
    }
    // **Zemin gözünün arka dayanağı YOK** ve bu ölçümle karara bağlandı.
    // Konulduğunda makine ikinci adaya hiç geçemiyordu: taşıma kotundaki
    // (0.35 m) bıçak 25.6'daki dayanağa dayanıyor, kriko gibi çalışıp çatalı
    // 2.17 metreye kaldırıyor ve makineyi 15.9 dereceye yatırıyordu. Zaten
    // gerekli de değil — zemin gözüne konan palet oraya oturuyor ve bir
    // sonraki görev başlayınca stoğa geçip çarpışmayı tamamen bırakıyor.
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

  /**
   * Gözüne konmuş paletler — **fizik gövdesi yok, kayıt var.**
   *
   * Kodda yıllardır duran not buydu: *"Konanları da sahnede tutmak Sprint 5
   * işi."* Tutmamanın bedeli görünüyordu: oyuncu paleti rafa koyuyor, bir
   * sonraki görev başlayınca palet buharlaşıyordu — yani emeğinin izi
   * kalmıyordu ve depo bölümün sonunda başladığı kadar boştu.
   *
   * Gövde yerine kayıt tutmak kasıtlı: konan palet gözün derinliğine itilmiş
   * sayılıyor ve koridordan çıkıyor (bkz. `MASKE.stok`). Fizik gövdesi
   * bıraksaydık ya makine ikinci adaya geçemezdi ya da paleti çarpışmasız
   * yapmak için yine aynı yere gelirdik — üstelik bir de boşuna çözülen
   * gövde taşıyarak.
   */
  readonly stok: Array<{ task: Task; x: number; y: number }> = [];

  spawnLoad(spec: Task | null): void {
    // `gorevler[0]` ile çağrılmak bölümün BAŞI demek: ya ilk açılış ya da
    // yeniden başlatma. İkisinde de depo boş sayfadan başlamalı.
    const bolumBasi = spec !== null && spec === FORKLIFT_TASKS[0];
    if (bolumBasi) this.stok.length = 0;
    if (this.load) {
      // Bölüm ortasında yeni görev geliyorsa öncekini oyuncu YERİNE KOYDU;
      // sahnede kalsın. Başta ise eskisini temizliyoruz.
      const onceki = this.loadSpec;
      if (!bolumBasi && onceki) {
        const p = this.load.getPosition();
        this.stok.push({ task: onceki, x: p.x, y: p.y });
      }
      this.world.destroyBody(this.load);
    }
    this.loadSpec = spec;
    if (!spec) { this.grabbables = []; return; }
    // **Palet ancak makine yükleme karesinin BATISINDAYKEN iniyor.**
    // Forklift dönemediği için paleti alabilmek hep onun batısında olmak
    // demek; oysa önceki paleti rafa bırakınca makine doğuda kalıyor. Palet
    // önceden yerde dursaydı makine batıya dönerken onu önüne katardı
    // (ölçüldü: palet 1.7 metre süründü, çatal cebe hiç girmedi). Mal kabul
    // konveyörü sahada da tam olarak bunu yapıyor: sen yerine geçince indirir.
    const yerKotu = spec.halfHeight + PALET_AYAK;
    const acik = this.forklift.forkTip.x < this.teslimKapisi();
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
  /**
   * Ölçülen tur: görev başına 25–90 s.
   *
   * Eşik 22/70'ten 30/95'e çıktı ve sebebi bölümün kendisi: depo tek rafken
   * her görev 7 metrelik bir şeritte geçiyordu, şimdi üç adaya yayılmış
   * durumda ve en uzun tur 18 metre gidip 18 metre dönüyor. Eski eşikle
   * başsız rig iki görevde sıfır hız bonusu alıyordu — yani puan artık
   * sürüşün kalitesini değil, sadece mesafeyi ölçüyordu.
   */
  readonly hizEsikleri = { tam: 30, sifir: 95 };
  hedefNoktasi(t: Task): { x: number; y: number } | null {
    const kot = adresKotu(t.hedef);
    const on = adresX(t.hedef);
    if (kot === undefined || on === undefined) return null;
    // **Adanın ORTASI değil, ÖN KENARI.** Paleti dibine kadar sokmak çatalı
    // bir buçuk metre rafın içine sokmak demek; geri çekilirken bıçak kirişe
    // takılıyor ve makine şahlanıyordu. Sahada da palet gözün ön kenarına
    // konur — çatal ancak paletin boyu kadar içeri girer.
    // Palet rafa AYAKLARIYLA oturuyor: tabanı kirişin `PALET_AYAK` üstünde.
    // Zemin gözünde kot 0, yani palet doğrudan betona oturuyor — formül aynı.
    return { x: on + t.halfWidth + 0.06, y: kot + PALET_AYAK };
  }
  /** Hedef işareti kirişin ÜSTÜNDE dursun, paletin tabanında değil. */
  isaretNoktasi(t: Task): { x: number; y: number } | null {
    const kot = adresKotu(t.hedef);
    const on = adresX(t.hedef);
    return kot === undefined || on === undefined
      ? null : { x: on + t.halfWidth + 0.06, y: kot };
  }
  /**
   * Gözün içine oturmalı. Vinçteki 2 metrelik pencere burada anlamsız olurdu
   * — teras geniş bir düzlem, raf gözü ise paletten birkaç on santim büyük.
   */
  yerlestirmeToleransi(t: Task): { x: number; y: number } {
    // Yük adanın derinliğine sığmalı: geniş palette hata payı 30 cm'e iniyor.
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
    return [
      { x: c.x, y: c.y + 1.2 },
      { x: f.x, y: f.y + 1.0 },
      // **Zemin boyası da kadraja girmeli.** Boya y = 0'ın altındaki bantta
      // duruyor (bkz. `ZEMIN_BANDI`) ve kamera kutusuna katılmadığında
      // ekranın altında kalıyordu: koridor şeritleri, yön okları, gözlerin
      // ayak izleri ve "DUR" çizgisi — yani oyuncuya nerede duracağını
      // söyleyen her şey — çizilmiş ama görünmüyordu.
      { x: c.x, y: -ZEMIN_BANDI },
    ];
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
      if (this.forklift.forkTip.x >= this.teslimKapisi()) return;
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

  /**
   * Paletin inebilmesi için çatal ucunun batısında kalması gereken çizgi.
   *
   * Artık yüke göre değişmiyor: zeminde boyalı duran çizgiyle aynı yerde
   * (bkz. `BEKLEME_CIZGISI`). Oyuncunun göremediği bir kural, kural değil.
   */
  private teslimKapisi(): number { return BEKLEME_CIZGISI; }

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
