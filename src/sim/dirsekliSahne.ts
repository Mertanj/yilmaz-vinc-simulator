import { Box, Vec2, WeldJoint, type Body, type Contact } from 'planck';
import { createWorld, createGround, Snapshotter, SIM, TRUCK_GROUP, MASKE } from './world';
import { Truck, TRUCK } from './truck';
import { Outriggers } from './outriggers';
import { Dirsekli, DIRSEKLI, DIRSEKLI_NEUTRAL, type DirsekliInput } from './dirsekli';
import { DIRSEKLI_SPEC as S, dirsekliCozum } from './dirsekliGeometri';
import type { Grabbable } from './kanca';
import { DAR_SOKAK } from './avlu';
import { KASA_TABANI, KASA_ON_DUVAR, type DirsekliBolum } from './dirsekliBolum';
import type { Task } from '../game/tasks';
import { OutriggerState } from './loadChart';
import { bomGirdisiVar, type SceneInput } from './scene';
import { Ret } from './ret';
import type { SimKipi } from './kip';
import { imzaliDerece, almaSatiri, tasimaSatiri,
  type Gosterge, type OyunSahnesi, type PanelSatiri, type Uyari } from './sahne';
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

  /**
   * Bölüm varsayılanla geliyor: çağıran tarafların hiçbiri (main.ts, üç rig)
   * bölüm seçmiyor, hepsi tek bölümü oynuyordu. Varsayılan olmasaydı bu
   * ayıklama sekiz çağrı yerini birden değiştirmek zorunda kalırdı ve
   * değişiklik "davranış aynı kaldı mı" sorusuna cevap vermesi zor bir şey
   * olurdu.
   */
  constructor(readonly bolum: DirsekliBolum = DAR_SOKAK) {
    createGround(this.world);
    bolum.kur(this.world);
    this.truck = new Truck(this.world, this.snaps, bolum.spawnX);
    this.outriggers = new Outriggers(this.world, this.truck.chassis, this.snaps);
    this.bom = new Dirsekli(this.world, this.truck.chassis, this.snaps,
      bolum.montajX === undefined ? DIRSEKLI.pivot : new Vec2(bolum.montajX, DIRSEKLI.pivot.y));
    if (bolum.kasa) this.kasayiKur(bolum.kasa);

    this.spawnLoad(bolum.gorevler[0] ?? null);

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

  /**
   * Kasa tabanı ve ön duvar — şasinin kendi fikstürleri.
   *
   * Şasi kutusu kasanın tabanını çizimden 14 santim alçakta bitiriyordu;
   * yük oraya konsa tahtanın içine gömülü görünürdü. Yoğunluk SIFIR: şasinin
   * kütlesi elle verildi (24 t, merkez arkada) ve yoğunluklu bir fikstür onu
   * planck'te sessizce yeniden hesaplatırdı.
   */
  private kasayiKur(k: { on: number; arka: number }): void {
    const c = this.truck.chassis;
    const H = TRUCK.chassisHalfHeight;
    const filtre = { density: 0, filterGroupIndex: TRUCK_GROUP };
    c.createFixture(new Box((k.on - k.arka) / 2, KASA_TABANI / 2,
      new Vec2((k.on + k.arka) / 2, H + KASA_TABANI / 2), 0), { friction: 0.85, ...filtre });
    c.createFixture(new Box(0.06, KASA_ON_DUVAR / 2,
      new Vec2(k.on + 0.06, H + KASA_TABANI + KASA_ON_DUVAR / 2), 0), { friction: 0.6, ...filtre });
  }

  /** Kasaya konmuş, şasiye kaynamış yükler — yalnız kalıcı bölümde. */
  private readonly konanlar: Array<{ task: Task; body: Body }> = [];
  /** Güncel yük yükleme karesinde mi, yoksa henüz depoda mı bekliyor? */
  private teslimEdildi = true;
  /** Güncel yük bir kez olsun kancada kalktı mı? */
  private tasindi = false;
  /** Şasinin kıpırdamadan geçirdiği süre (s) — teslimin şartı. */
  private dinginSn = 0;

  spawnLoad(spec: Task | null): void {
    this.tasindi = false;
    if (this.bolum.kalici) { this.kaliciYukle(spec); return; }
    if (this.load) this.world.destroyBody(this.load);
    this.loadSpec = spec;
    if (!spec) { this.grabbables = []; return; }
    const body = this.world.createDynamicBody({
      x: this.bolum.malzemeX, y: spec.halfHeight + 0.05,
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

  private konanlariTemizle(): void {
    for (const k of this.konanlar) { this.world.destroyBody(k.body); this.snaps.birak(k.body); }
    this.konanlar.length = 0;
  }

  /**
   * Kasa bölümünde yük akışı.
   *
   * Konan yük şasiye KAYNIYOR: kamyonun parçası oluyor, sallanan bir sonraki
   * yük ona çarparsa yerinden oynatamıyor, kamyon kıpırdarsa onunla gidiyor.
   * Yeni yük depoda bekliyor ve makine ayaklarını açınca yükleme karesine,
   * kuyruğun arkasına geliyor (bkz. `malzemeYerel`).
   */
  private kaliciYukle(spec: Task | null): void {
    const bolumBasi = spec !== null && spec === this.bolum.gorevler[0];
    if (bolumBasi) {
      this.konanlariTemizle();
      if (this.load) { this.world.destroyBody(this.load); this.snaps.birak(this.load); }
    } else if (this.load && this.loadSpec) {
      this.world.createJoint(new WeldJoint({}, this.truck.chassis, this.load,
        this.load.getWorldCenter()));
      this.konanlar.push({ task: this.loadSpec, body: this.load });
    }
    this.loadSpec = spec;
    if (!spec) { this.grabbables = []; return; }
    const sira = this.bolum.gorevler.indexOf(spec);
    const body = this.world.createDynamicBody({
      x: this.bolum.bekleyenX?.(sira) ?? this.bolum.malzemeX, y: spec.halfHeight + 0.02,
    });
    body.createFixture(new Box(spec.halfWidth, spec.halfHeight), {
      density: 1, friction: 0.85, restitution: 0.02,
    });
    body.setAngularDamping(0.5);
    this.snaps.track(body);
    this.load = body;
    // Makine zaten kurulu ve duruyorsa (sonraki görevler) palet hemen geliyor.
    if (this.teslimeHazir) this.teslimEt();
    else this.depodaBeklet();
  }

  /** Depoda: çarpışmasız, kıpırtısız, alınamaz — makine kurulunca gelecek. */
  private depodaBeklet(): void {
    this.teslimEdildi = false;
    for (let f = this.load.getFixtureList(); f; f = f.getNext()) f.setFilterMaskBits(0);
    this.load.setType('static');
    this.grabbables = [];
  }

  /** Forklift paleti kuyruğun arkasına, vincin erişeceği yere bıraktı. */
  private teslimEt(): void {
    const spec = this.loadSpec;
    if (!spec) return;
    const yerel = this.bolum.malzemeYerel;
    const x = yerel === undefined ? this.bolum.malzemeX
      : this.truck.chassis.getWorldPoint(new Vec2(yerel, 0)).x;
    this.load.setType('dynamic');
    for (let f = this.load.getFixtureList(); f; f = f.getNext()) {
      f.setFilterMaskBits(MASKE.kasaPaleti);
    }
    this.load.setTransform({ x, y: spec.halfHeight + 0.02 }, 0);
    this.load.setLinearVelocity({ x: 0, y: 0 });
    this.load.setAngularVelocity(0);
    this.load.setMassData({
      mass: spec.tonnes * 1000,
      center: { x: 0, y: 0 },
      I: (spec.tonnes * 1000 * (spec.halfWidth ** 2 + spec.halfHeight ** 2)) / 3,
    });
    this.teslimEdildi = true;
    this.grabbables = [{ body: this.load, halfWidth: spec.halfWidth, halfHeight: spec.halfHeight }];
  }

  /**
   * Forklift paleti getirebilir mi: ayaklar TAM açık ve kamyon durulmuş.
   *
   * "Çalışma modu" (ayaklar %15'ten fazla açık) yetmiyordu: yarım açıkken
   * teslim edilen palet, ayaklar sonuna kadar açılınca kamyonun 16 santim
   * kaymasıyla vinçten o kadar uzakta kalıyordu — ilk palet R 8.56'da, diğer
   * dördü R 8.40'ta alındı ve ibre ilkinde iki puan fazla gösterdi.
   */
  private get teslimeHazir(): boolean {
    return this.outriggers.state === OutriggerState.Full && this.dinginSn > 0.5
      && this.parkta;
  }

  /** Kamyon bölümün park cebinde mi? Cep tanımlı değilse her yer uygun. */
  private get parkta(): boolean {
    const p = this.bolum.park;
    return !p || Math.abs(this.truck.chassis.getPosition().x - p.x) <= p.payM;
  }

  /** Kasaya konmuş yükler — çizim her karede şasiyle birlikte çiziyor. */
  get kasadakiler(): ReadonlyArray<{ task: Task; body: Body }> { return this.konanlar; }
  /** Güncel yük henüz depoda mı? Çizim ve ipucu soruyor. */
  get yukDepoda(): boolean { return !this.teslimEdildi; }

  /** İşaret şu an yükün KENDİSİNİ mi gösteriyor (kasa bölümü, henüz alınmadı)? */
  get isaretKaynakta(): boolean {
    return this.bolum.kalici === true && !this.tasindi && this.teslimEdildi
      && this.loadSpec !== null;
  }

  isaretNoktasi(t: Task): { x: number; y: number } | null {
    if (this.isaretKaynakta && t === this.loadSpec) {
      const p = this.load.getPosition();
      return { x: p.x, y: p.y - t.halfHeight };
    }
    return this.hedefNoktasi(t);
  }

  yeniYukYeri(): string | null {
    return this.bolum.kalici && this.loadSpec ? M.dirsekli.yer.kare : null;
  }

  // --- bölüm --- (hepsi `DirsekliBolum`'den; gerekçeler orada)
  get gorevler(): readonly Task[] { return this.bolum.gorevler; }
  get hizEsikleri(): { tam: number; sifir: number } { return this.bolum.hizEsikleri; }
  hedefNoktasi(t: Task): { x: number; y: number } | null {
    const konanlar = new Map<string, { x: number; y: number; hw: number; hh: number }>();
    for (const { task, body } of this.konanlar) {
      const p = body.getPosition();
      konanlar.set(task.kod, { x: p.x, y: p.y, hw: task.halfWidth, hh: task.halfHeight });
    }
    return this.bolum.hedefNoktasi(t, { sasi: this.truck.chassis, konanlar });
  }
  yerlestirmeToleransi(t: Task): { x: number; y: number } {
    return this.bolum.yerlestirmeToleransi(t);
  }

  get sasiHizi(): number { return this.truck.chassis.getLinearVelocity().x; }
  get kameraOlcegi(): { yakin: number; uzak: number } { return this.bolum.kameraOlcegi; }
  get devrildiMi(): boolean { return Math.abs(this.tiltDeg) > 8; }
  get loadTask(): Task | null { return this.loadSpec; }

  /** Ayaklar yerdeyse bom fazındayız: sürüş kilitli. */
  /** Reddedilen son komutun cevabı — gerekçesi `ret.ts`'te. */
  private readonly ret = new Ret();

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
    const noktalar = [{ x: c.x, y: c.y + 1.6 }, this.bom.tipWorld, this.yukNoktasi];
    if (this.isaretKaynakta) {
      const p = this.load.getPosition();
      const hh = this.loadSpec?.halfHeight ?? 0.5;
      noktalar.push({ x: p.x, y: p.y + hh + 0.6 }, { x: p.x, y: 0 });
    }
    return noktalar;
  }

  kipiSec(k: SimKipi): void { this.kip = k; this.bom.kipiSec(k); }
  private kip: SimKipi = 'tam';
  private get kipAdi(): string {
    return this.kip === 'temel' ? M.secim.kipTemel : M.secim.kipTam;
  }

  step(input: SceneInput, dt: number): void {
    this.carpmaBekleme = Math.max(0, this.carpmaBekleme - dt);
    if (input.reset) {
      // Kaynaklı yükler şasiyle birlikte ışınlanamaz: kaynak onları bir adımda
      // şasiye çekerdi. Bölüm zaten baştan başlıyor, önce onları kaldır.
      if (this.bolum.kalici) this.konanlariTemizle();
      this.truck.reset(this.bolum.spawnX);
      this.outriggers.reset(this.truck.chassis);
    }
    // Makine kuruldu ve AYAKLARIN ÜSTÜNDE DURULDU: depodaki palet yükleme
    // karesine geliyor. Ayaklar açılırken kamyon 17 santim kayıyor; palet
    // kurulum bitmeden gelse vincin 17 santim ötesinde kalıyordu.
    const v = this.truck.chassis.getLinearVelocity();
    this.dinginSn = Math.hypot(v.x, v.y) < 0.02 ? this.dinginSn + dt : 0;
    if (!this.teslimEdildi && this.teslimeHazir) this.teslimEt();
    const u = M.vinc.uyari;

    // **Faz kilitleri EN ÖNDE yazılıyor, özel retler sonra.**
    //
    // Sessizliğin iki yönü de kapanıyor: sürüş fazında bom tuşları ve
    // çalışma fazında sürüş tuşları hiçbir şey yapmıyor, hiçbir şey de
    // söylemiyordu; oyuncunun "yanlış tuş" ile "oyun donmuş" arasını
    // ayırmasının yolu yoktu.
    //
    // Sıra önemli: `Ret.yaz` son yazanı tutuyor. Oyuncu yüklü kancayla
    // ayak düğmesine basarken ok tuşunu da basılı tutuyorsa iki ret birden
    // doğuyor ve doğru cevap "ayaklar toplanamadı" — genel "sürüş kilitli"
    // değil. O yüzden genel olan önce yazılıyor, özel olan üstüne.
    const bomModu = this.calismaModunda;
    if (bomModu && (input.drive.throttle !== 0 || input.drive.handbrake)) {
      this.ret.yaz({
        bas: u.surusKilitliBas, govde: u.surusKilitliGovde,
        cozum: u.surusKilitliCozum(kumandaAdi()),
      });
    }
    if (!bomModu && bomGirdisiVar(input)) {
      this.ret.yaz({
        bas: u.bomKilitliBas, govde: u.bomKilitliGovde,
        cozum: u.bomKilitliCozum(kumandaAdi()),
      });
    }

    if (input.toggleOutriggers) {
      // Yük kancadayken ayak toplanmaz — gerekçesi vinç sahnesinde, aynı yer.
      if (this.hasLoad) {
        this.ret.yaz({ bas: u.ayakBas, govde: u.ayakGovde, cozum: u.ayakCozum });
      } else {
        this.outriggers.toggle();
        this.ret.temizle();
      }
    }

    // **Kilitli kumanda artık sessiz değil.** Sürüş fazında bom tuşları
    // hiçbir şey yapmıyordu ve hiçbir şey de söylemiyordu; oyuncunun "yanlış
    // tuş" ile "oyun donmuş" arasını ayırmasının yolu yoktu.
    if (!bomModu && bomGirdisiVar(input)) {
      this.ret.yaz({
        bas: u.bomKilitliBas, govde: u.bomKilitliGovde,
        cozum: u.bomKilitliCozum(kumandaAdi()),
      });
    }
    this.bom.setStowed(!bomModu);
    if (input.toggleHook && bomModu) {
      const cevap = this.bom.requestToggleAttach();
      if (cevap.neden === 'havada') {
        this.ret.yaz({ bas: u.birakBas, govde: u.birakGovde, cozum: u.birakCozum });
      } else if (cevap.ok) {
        this.ret.temizle();
      }
    }
    this.ret.azalt(dt);

    this.snaps.capture();

    this.truck.drive(bomModu ? { throttle: 0, handbrake: true } : input.drive);
    this.outriggers.update(dt);

    this.bom.update(bomModu ? girdiyiCevir(input.crane) : DIRSEKLI_NEUTRAL, dt, this.bom.lmi);
    this.bom.applyToWorld(dt);

    this.world.step(dt, SIM.velocityIterations, SIM.positionIterations);
    this.world.clearForces();

    this.bom.sampleLmi(dt);
    this.bom.flushJointQueue(this.grabbables);
    if (this.bom.hasLoad) this.tasindi = true;
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
      { detay: true, etiket: M.panel.kip, deger: this.kipAdi },
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

    // Ret EN ÖNDE, çalışma modu denetiminden de önde: kilitli kumanda
    // uyarısının görüneceği tek yer sürüş fazı. Sıkışma bile bunun altında —
    // sıkışma kendi kendine devam ediyor, ret ise az önceki harekete cevap.
    const red = this.ret.aktif;
    if (red) return { zone: 'amber', carpiyor: false, ret: true, ...red };
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
      // Park penceresi BÖLÜME ait — gerekçesi `DAR_SOKAK.surusIpucu`'da.
      const x = this.truck.chassis.getPosition().x;
      return this.bolum.surusIpucu?.(x) ?? { metin: k.yanasma(t), mod: 'drive' };
    }
    // Kasa bölümü: palet henüz depoda. Kurulum yarımsa ne yapılacağını,
    // tamsa neyin beklendiğini söyle — yoksa satır "kancayı yükün üstüne
    // indir" derdi ve yükleme karesi boş.
    if (this.yukDepoda && !this.hasLoad) {
      if (!this.parkta) return { metin: k.cepDisi(t), mod: 'drive' };
      return this.outriggers.state === OutriggerState.Full
        ? { metin: k.paletGeliyor, mod: 'crane' }
        : { metin: k.paletBekliyor(t), mod: 'ready' };
    }
    if (this.hasLoad) {
      // **Aşılacak engel BÖLÜME ait, teleskop MAKİNEYE.** Duvar uyarısını
      // bölüm veriyor (gerekçesi `DAR_SOKAK.tasimaIpucu`'da) ve önce o
      // soruluyor: engelin altındayken "bomu uzat" demek oyuncuyu duvarın
      // içine sürerdi.
      const l = this.load.getPosition();
      const gorev = this.loadTask;
      const engel = this.bolum.tasimaIpucu?.({
        x: l.x, y: l.y, yariBoy: gorev ? gorev.halfHeight : 0,
      });
      if (engel) return engel;
      // **Teleskobu KEŞFETTİRMEK gerekiyor.** Dördüncü eksen tuş listesinde
      // yazıyor ama oyun içinde hiçbir şey onu istemiyordu; üst teraslara
      // teleskop olmadan çıkılamıyor ve oyuncunun bunu tahmin etmesi
      // gerekirdi. Ters kinematik zaten hedefin ne kadar uzama istediğini
      // biliyor — soruyoruz ve cevabı satıra yazıyoruz.
      const gereken = this.gerekenUzama();
      if (gereken !== null && gereken > this.bom.uzamaBoyuM + 0.35) {
        // **Kilitliyse SEBEBİNİ söyle.** Gelişmiş kipte teleskop iki-blokta
        // kilitli; "bomu uzat" deyip uzatmayı kilitli bırakmak oyuncunun tek
        // satıra bakıp takıldığı kusurun aynısı olurdu.
        if (this.bom.ikiBlokta) return { metin: k.uzatHalatYok(t), mod: 'crane' };
        return { metin: k.uzat(t), mod: 'crane' };
      }
      // Engel de teleskop da tamamsa geriye nişan alma kalıyor: yön ve mesafe.
      const h = gorev ? this.hedefNoktasi(gorev) : null;
      const satir = gorev && h
        ? tasimaSatiri({ x: l.x, y: l.y - gorev.halfHeight }, h,
          this.yerlestirmeToleransi(gorev))
        : null;
      return { metin: satir ?? k.yukBagli(t), mod: 'crane' };
    }
    const { reason, sapma } = this.bom.attachCheck(this.grabbables);
    const say: Record<typeof reason, string> = {
      hazir: i.hazir(t),
      sallaniyor: i.sallaniyor,
      'yan-cekme': i.yanCekme,
      ortala: i.ortala,
      yukseklik: i.yukseklik,
      uzak: k.uzak(t),
    };
    return {
      metin: almaSatiri(reason, sapma, say[reason], M.dirsekli.ipucu.yanasma(kumandaAdi())),
      mod: reason === 'hazir' ? 'ready' : 'crane',
    };
  }
}

export { DIRSEKLI };
