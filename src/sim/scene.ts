import { Box, type Body, type World, type Contact } from 'planck';
import {
  createWorld, createGround, createFactoryBody, createKerb, scatterProps,
  factoryTerraces, Snapshotter, SIM,
} from './world';
import { Truck } from './truck';
import { Outriggers } from './outriggers';
import { Crane, NEUTRAL, type CraneInput, type Grabbable, type KatRet } from './crane';
import type { DriveInput } from '../input/kumanda';
import { TASKS, MALZEME_X, type Task } from '../game/tasks';
import { OutriggerState } from './loadChart';
import type { Gosterge, OyunSahnesi, PanelSatiri, Uyari } from './sahne';
import { imzaliDerece } from './sahne';
import { M, kumandaAdi } from '../ui/dil';

/**
 * Sahnenin fizik tarafı — tek kaynak.
 *
 * main.ts bunu çizer, tools/headless.ts aynısını klavyesiz sürer. Ayrı ayrı
 * kurulsalardı test ettiğimiz dünya ile oynanan dünya sessizce ayrışırdı; bu
 * projede her fizik kararı ölçümle alındığı için o ayrışma en pahalı hata olurdu.
 */
export const SCENE = {
  factoryX: 62,
  setupX: 52,
  /**
   * Takoz kamyonu burada durduruyor. 57.2'den öne alındı — kamyon yaklaştıkça
   * bütün yarıçaplar kısalıyor ve üst katlar erişilebilir oluyor.
   *
   * 58.5 DENENDİ ve olmadı: takoz kutusu 58.15–58.85 arasını kaplıyor, yükün
   * sol kenarı ise 58.35'te. İkisi doğuşta iç içe giriyor, planck da onları
   * ayırmak için yükü 60 santim ileri fırlatıyordu. Sahne kurulurken çakışma
   * denetimi (`overlaps`) artık bunu yakalıyor.
   */
  kerbX: 57.9,
  /** Bunun üstündeki normal impuls (N·s) çarpma sayılıyor. */
  carpmaEsigiNs: 9000,
  /** Malzeme alanının merkezi — her görevin yükü buraya geliyor. */
  malzemeX: MALZEME_X,
} as const;

/** Bir fizik adımının bütün girdisi. Klavye de, test de bunu üretir. */
export interface SceneInput {
  drive: DriveInput;
  crane: CraneInput;
  /** Bu karede ayakları aç/topla. */
  toggleOutriggers: boolean;
  /** Bu karede kancayı bağla/bırak. */
  toggleHook: boolean;
  /** Bu karede halat kat sayısını değiştir. */
  toggleKat: boolean;
  /** Bu karede her şeyi başa al. */
  reset: boolean;
}

export const IDLE: SceneInput = {
  drive: { throttle: 0, handbrake: false },
  crane: NEUTRAL,
  toggleOutriggers: false,
  toggleHook: false,
  toggleKat: false,
  reset: false,
};

export class Scene implements OyunSahnesi {
  readonly world = createWorld();
  readonly snaps = new Snapshotter();
  readonly truck: Truck;
  readonly outriggers: Outriggers;
  readonly crane: Crane;
  readonly props: ReturnType<typeof scatterProps>;
  /** Malzeme alanındaki güncel yük. Görev değişince yenisiyle değişiyor. */
  load!: Body;
  private loadSpec: Task | null = null;
  grabbables: Grabbable[] = [];
  /**
   * Sert çarpışma sayısı — puanlamaya giriyor.
   *
   * Her temas değil, ÇARPMA sayılıyor: yükü terasa usulca koymak da bir
   * temastır. Eşik çözücünün bildirdiği normal impulsa bakıyor, böylece
   * "bıraktım" ile "çarptım" ayrışıyor.
   */
  carpma = 0;

  constructor() {
    createGround(this.world);
    createFactoryBody(this.world);
    createKerb(this.world, SCENE.kerbX);
    this.truck = new Truck(this.world, this.snaps);
    this.outriggers = new Outriggers(this.world, this.truck.chassis, this.snaps);
    this.crane = new Crane(this.world, this.truck.chassis, this.snaps);
    this.props = scatterProps(this.world, this.snaps);

    this.spawnLoad(TASKS[0] ?? null);

    assertNoSpawnOverlap(this.world);

    // Sert çarpışmaları say. post-solve, impuls hesaplandıktan sonra çağrılıyor.
    this.world.on('post-solve', (contact: Contact, impulse: { normalImpulses: number[] }) => {
      const a = contact.getFixtureA().getBody();
      const b = contact.getFixtureB().getBody();
      // Sadece YÜK ve KANCA sayılıyor. Şasi de sayılsa takoza yanaşmak —
      // yani park etmenin tek yolu — her turda bir çarpma yazıyordu.
      const ilgili = (x: Body): boolean => x === this.load || x === this.crane.hook;
      if (!ilgili(a) && !ilgili(b)) return;
      const j = Math.max(...(impulse.normalImpulses ?? [0]));
      if (j > SCENE.carpmaEsigiNs) this.carpma++;
    });
  }

  /**
   * Malzeme alanına yeni bir yük koyar, eskisini siler.
   *
   * Yükün gövdesi görev başına yeniden yaratılıyor çünkü her görevin ölçüsü ve
   * kütlesi farklı; planck'te bir fikstürün şeklini sonradan değiştirmek yok.
   */
  spawnLoad(spec: Task | null): void {
    if (this.load) this.world.destroyBody(this.load);
    this.loadSpec = spec;
    if (!spec) {
      this.grabbables = this.props.map((p) => ({ body: p.body, halfWidth: p.hw, halfHeight: p.hh }));
      return;
    }
    const body = this.world.createDynamicBody({ x: SCENE.malzemeX, y: spec.halfHeight + 0.05 });
    body.createFixture(new Box(spec.halfWidth, spec.halfHeight), {
      density: 1, friction: 0.85, restitution: 0.02,
    });
    // Atalet momenti kütleyle ölçekleniyor: sabit bırakılınca ağır yük hafif
    // yükten daha çabuk dönüyordu, ki bu tersine olmalı.
    body.setMassData({
      mass: spec.tonnes * 1000,
      center: { x: 0, y: 0 },
      I: (spec.tonnes * 1000 * (spec.halfWidth ** 2 + spec.halfHeight ** 2)) / 3,
    });
    body.setAngularDamping(0.5);
    this.snaps.track(body);
    this.load = body;
    this.grabbables = [
      { body, halfWidth: spec.halfWidth, halfHeight: spec.halfHeight },
      ...this.props.map((p) => ({ body: p.body, halfWidth: p.hw, halfHeight: p.hh })),
    ];
  }

  /** Güncel yükün tanımı — boyutları puanlama ve çizim için gerekiyor. */
  /** Bölüm 1 — sanayi sitesi. Hedefler binanın terasları. */
  readonly gorevler = TASKS;
  /** Vinçin ölçülmüş kalibrasyonu: başsız turda görev başına 139–215 s. */
  readonly hizEsikleri = { tam: 90, sifir: 240 };
  private readonly teraslar = factoryTerraces();
  hedefNoktasi(t: Task): { x: number; y: number } | null {
    return this.teraslar[t.hedef] ?? null;
  }
  /** Teras geniş: kör kaldırmada iki metrelik pencere adil. */
  yerlestirmeToleransi(): { x: number; y: number } { return { x: 2.0, y: 0.4 }; }
  get sasiHizi(): number { return this.truck.chassis.getLinearVelocity().x; }
  readonly kameraOlcegi = { yakin: 30, uzak: 15 };
  /** Vinçte 8° zaten kaza: ayaklar açıkken şasi hiç eğilmemeli. */
  get devrildiMi(): boolean { return Math.abs(this.tiltDeg) > 8; }

  get loadTask(): Task | null { return this.loadSpec; }

  /** Ayaklar yerdeyse vinç fazındayız: sürüş kilitli, vinç açık. */
  get craneMode(): boolean {
    return this.outriggers.fraction > 0.15;
  }

  // --- OyunSahnesi arayüzü ---
  get calismaModunda(): boolean { return this.craneMode; }
  get olcum() { return this.crane.lmi; }
  get hasLoad(): boolean { return this.crane.hasLoad; }
  get yukNoktasi(): { x: number; y: number } {
    const p = this.crane.hook.getPosition();
    return { x: p.x, y: p.y };
  }

  /**
   * Halatın düşeyden sapma açısı — salınımın doğrudan ölçüsü.
   *
   * Halat 1.5 metrenin altındaysa sıfır sayılıyor: kanca bom ucuna dayanmışken
   * 11 santimlik bir kayma 5 dereceye denk geliyor, yani ölçü anlamını
   * yitiriyor.
   */
  salinimDeg(): number {
    const tip = this.crane.tipWorld;
    const h = this.crane.hook.getPosition();
    const dy = tip.y - h.y;
    if (dy < 1.5) return 0;
    return (Math.atan2(h.x - tip.x, dy) * 180) / Math.PI;
  }

  odakNoktalari(): Array<{ x: number; y: number }> {
    const c = this.truck.chassis.getPosition();
    return [{ x: c.x, y: c.y + 2.2 }, this.crane.tipWorld, this.yukNoktasi];
  }

  private get tabloDisi(): boolean { return this.crane.lmi.capacityTonnes <= 0; }

  gosterge(): Gosterge {
    const r = this.crane.lmi;
    const d = M.vinc;
    const pct = this.tabloDisi || !Number.isFinite(r.percent)
      ? null : Math.min(999, r.percent);
    return {
      baslik: d.baslik,
      yuzde: pct,
      durum: this.tabloDisi ? d.durum.tabloDisi
        : r.zone === 'red' ? d.durum.asiriYuk
        : r.zone === 'amber' ? d.durum.dikkat : d.durum.guvenli,
      zone: r.zone,
      dolu: Math.min(1, (pct ?? 999) / 150),
      altSatirlar: [
        r.limitedBy === 'halat'
          ? d.alt.halatSinir(r.chartTonnes.toFixed(1))
          : d.alt.tabloSinir(r.ropeTonnes.toFixed(1)),
        this.crane.reevingSuresi > 0
          ? d.alt.reeving(this.crane.reevingSuresi.toFixed(0))
          : d.alt.kat(this.crane.katSayisi,
              this.crane.halatKapasiteTon.toFixed(1), this.crane.sonrakiKat),
      ],
    };
  }

  panelSatirlari(): PanelSatiri[] {
    const r = this.crane.lmi;
    const d = M.vinc;
    const egim = this.tiltDeg;
    return [
      // Her zaman görünen üç satır: ne taşıyorsun, sınır ne, ne kadar uzakta.
      { etiket: d.satir.kancada, deger: `${r.loadTonnes.toFixed(2)} t` },
      // Etiket sınırı KİMİN koyduğunu da söylüyor: halat katını artırmanın
      // işe yarayıp yaramayacağı doğrudan buna bağlı.
      { etiket: `${M.panel.sinir} · ${r.limitedBy === 'halat'
        ? d.satir.sinirHalat : d.satir.sinirTablo}`,
        deger: this.tabloDisi ? d.satir.tabloDisi : `${r.capacityTonnes.toFixed(2)} t` },
      { etiket: d.satir.yaricap, deger: `${this.crane.radiusM.toFixed(1)} m` },
      // Devrilmenin ÖLÇÜLEN yüzü — yük tablosunun söylediğinin yanındaki
      // ikinci tanık. Forkliftte aynı işi arka aks yapıyor.
      this.arkaPabucSatiri(d),
      // Gerisi detay: makineyi zaten bilen için.
      { detay: true, etiket: d.satir.bom,
        deger: `${this.crane.lengthM.toFixed(1)} m · ${this.crane.angleDeg.toFixed(0)}°` },
      { detay: true, etiket: d.satir.halat, deger: `${this.crane.ropeM.toFixed(1)} m`,
        ...(this.crane.ikiBlokta ? { vurgu: 'kotu' as const } : {}) },
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
   * Arka pabuç payı satırı.
   *
   * **Ne ölçüyor:** arka pabucun, iki pabuca binen toplam yükteki payı.
   * Solverın o temaslara verdiği normal impulstan okunuyor, tahmin değil —
   * forkliftteki arka aksla aynı teknik. Düşmesi ağırlığın öne, yani bomun
   * altına gitmesi demek; sıfır, arka pabucun yerden kesilmesi.
   *
   * **Ne ölçmüyor:** pabuçtaki gerçek kuvveti. Ayak silindirleri makinenin
   * ağırlığının on katı güçte konum servosu (3000 kN/bacak) ve mafsal
   * limitleri de yük taşıyor; ölçüldü, iki pabucun toplamı 506 kN çıkıyor,
   * oysa dünyadaki tüm dinamik ağırlık 304 kN. Motor gücü düşürülünce toplam
   * gerçeğe yaklaşıyor (373 kN) ama boştaki pay da %31'den %41'e kayıyor,
   * yani mutlak değer servonun izini taşıyor. Bu yüzden satır bir yük hücresi
   * gibi sunulmuyor: PAY gösteriyor, kilonewton değil.
   *
   * Eşikler bölümün kendi ölçümünden: başsız tur boyunca pay %60.4 ile %23.8
   * arasında geziyor ve en dibi LMI %128'e denk geliyor.
   */
  private arkaPabucSatiri(d: typeof M.vinc): PanelSatiri {
    const pay = this.outriggers.arkaPabucPayi;
    if (pay === null) return { etiket: d.satir.arkaPabuc, deger: '—' };
    return {
      etiket: d.satir.arkaPabuc, deger: M.yuzde((pay * 100).toFixed(0)),
      ...(pay < 0.25 ? { vurgu: 'kotu' as const }
        : pay < 0.40 ? { vurgu: 'uyari' as const } : {}),
    };
  }

  uyari(): Uyari | null {
    const r = this.crane.lmi;
    const u = M.vinc.uyari;
    const kilitli = this.crane.kilitliDenendi;
    if (!this.craneMode) return null;

    // Ret EN ÖNDE: bir düğmeye basmanın doğrudan cevabı, süregelen bir
    // durumdan daha acil. Üç buçuk saniye sonra kendi kendine çekiliyor ve
    // altındaki uyarı neyse o geri geliyor.
    if (this.katRedKalan > 0 && this.katRedNeden !== '') {
      return {
        zone: 'amber', carpiyor: false,
        bas: u.katBas,
        govde: u.katGovde(this.katRedNeden),
        cozum: this.katRedNeden === 'suruyor' ? '' : u.katCozum,
      };
    }

    // İki-blok, yük momentinden ÖNCE gelir: kanca kafaya dayanmışsa mesele
    // ağırlık değil, halatın bitmiş olması. Ama SADECE oyuncuyu fiilen
    // engellediğinde uyarıyoruz — kurulumda kanca zaten kafaya toplu duruyor.
    if (this.crane.ikiBlokta && (kilitli || this.crane.hasLoad)) {
      return {
        zone: 'red', carpiyor: kilitli,
        bas: u.ikiBlokBas, govde: u.ikiBlokGovde, cozum: u.ikiBlokCozum,
      };
    }
    if (this.tabloDisi) {
      return {
        zone: 'red', carpiyor: kilitli,
        bas: u.tabloDisiBas,
        govde: u.tabloDisiGovde(this.crane.radiusM.toFixed(1)),
        cozum: u.tabloDisiCozum,
      };
    }
    if (r.zone === 'red') {
      return {
        zone: 'red', carpiyor: kilitli,
        bas: u.asiriBas,
        govde: u.asiriGovde(r.loadTonnes.toFixed(2), this.crane.radiusM.toFixed(1),
          r.capacityTonnes.toFixed(2)),
        cozum: kilitli ? u.asiriCozumKilitli : u.asiriCozum,
      };
    }
    if (r.zone === 'amber') {
      return {
        zone: 'amber', carpiyor: false,
        bas: u.yakinBas,
        govde: u.yakinGovde(r.loadTonnes.toFixed(2), r.capacityTonnes.toFixed(2),
          this.crane.radiusM.toFixed(1)),
        cozum: '',
      };
    }
    return null;
  }

  ipucu(): { metin: string; mod: 'drive' | 'crane' | 'ready' } {
    const i = M.vinc.ipucu;
    const k = kumandaAdi();
    if (!this.craneMode) return { metin: i.surus(k), mod: 'drive' };
    // Halat geçirme 14 saniye sürüyor ve o sırada makine hiçbir şey yapmıyor.
    // Geri sayım gösterge bloğunun alt satırında da var ama o satır dar
    // ekranda gizli; ipucu satırı her boyutta görünüyor.
    if (this.crane.reevingSuresi > 0) {
      return {
        metin: M.vinc.alt.reeving(this.crane.reevingSuresi.toFixed(0)),
        mod: 'crane',
      };
    }
    if (this.crane.hasLoad) return { metin: i.yukBagli(k), mod: 'crane' };
    const { reason } = this.crane.attachCheck(this.grabbables);
    const say: Record<typeof reason, string> = {
      hazir: i.hazir(k),
      sallaniyor: i.sallaniyor,
      'yan-cekme': i.yanCekme,
      ortala: i.ortala,
      yukseklik: i.yukseklik,
      uzak: i.uzak,
    };
    return { metin: say[reason], mod: reason === 'hazir' ? 'ready' : 'crane' };
  }

  /** Son kat değiştirme denemesinin sonucu — HUD gerekçeyi gösteriyor. */
  /**
   * Kat değiştirme reddedildiğinde uyarı şeridi bu kadar saniye kalıyor.
   *
   * Sahadan gelen geri bildirim: *"halat katı düğmesini anlamadım."* Sebebi
   * büyük ölçüde şuydu: düğmeye basınca çoğu zaman HİÇBİR ŞEY olmuyordu.
   * Makine haklı olarak reddediyordu (kancada yük varken ya da kanca havadayken
   * sapancı halatı yeniden geçiremez) ama sebebi hesaplanıp ÇÖPE ATILIYORDU —
   * `sonKatCevabi` hiçbir yerde okunmuyordu. Ret bir kerelik bir olay, oysa
   * uyarı şeridi süregelen durumları gösteriyor; o yüzden kendi sayacı var.
   */
  private katRedKalan = 0;
  private katRedNeden: KatRet = '';

  /** Şasi eğimi, derece. Ekranda gördüğümüz işaretle aynı. */
  get tiltDeg(): number {
    return (-this.truck.chassis.getAngle() * 180) / Math.PI;
  }

  step(input: SceneInput, dt: number): void {
    if (input.reset) {
      this.truck.reset();
      this.outriggers.reset(this.truck.chassis);
    }
    if (input.toggleOutriggers) this.outriggers.toggle();

    const craneMode = this.craneMode;
    this.crane.setStowed(!craneMode);
    if (input.toggleHook && craneMode) this.crane.requestToggleAttach();
    if (input.toggleKat && craneMode) {
      const cevap = this.crane.katDegistir();
      this.katRedKalan = cevap.ok ? 0 : 3.5;
      this.katRedNeden = cevap.neden;
    }
    this.katRedKalan = Math.max(0, this.katRedKalan - dt);

    this.snaps.capture();

    // Ayaklar yerdeyken sürüş kilitli — gerçekte de öyle.
    this.truck.drive(craneMode ? { throttle: 0, handbrake: true } : input.drive);
    this.outriggers.update(dt);

    this.crane.update(craneMode ? input.crane : NEUTRAL, dt, this.crane.lmi);
    // Kinematik bomu konumlandır ve yükü şasiye aktar — adımdan hemen önce.
    this.crane.applyToWorld(dt);

    this.world.step(dt, SIM.velocityIterations, SIM.positionIterations);
    this.world.clearForces();

    // Tepki kuvveti ancak çözümden sonra tanımlı.
    this.crane.sampleLmi(dt, this.outriggers.state);

    // Joint yaratma/yok etme adımın DIŞINDA — planck world.step() içinde kilitli.
    this.crane.flushJointQueue(this.grabbables);
  }
}

/**
 * Doğuşta iç içe geçmiş gövde var mı?
 *
 * planck çakışan iki gövdeyi ilk adımlarda şiddetle iter; sahnedeki bir nesne
 * kendiliğinden fırlar. Bu bir kez başımıza geldi (takoz yükün içine girdi ve
 * yük 60 cm ileri savruldu) ve ekranda "yük biraz kaymış" gibi göründüğü için
 * teşhisi pahalı oldu. Kurulum sırasında bir kere bakmak bedava.
 */
function assertNoSpawnOverlap(world: World): void {
  const boxes: Array<{ name: string; min: Vec2Like; max: Vec2Like }> = [];
  for (let b = world.getBodyList(); b; b = b.getNext()) {
    for (let f = b.getFixtureList(); f; f = f.getNext()) {
      // Edge (zemin) ve sensörler dışarıda: zemin her şeye değiyor zaten.
      if (f.getShape().getType() !== 'polygon' && f.getShape().getType() !== 'circle') continue;
      const aabb = f.getAABB(0);
      if (!aabb) continue;
      boxes.push({ name: b.isStatic() ? 'sabit' : 'dinamik', min: aabb.lowerBound, max: aabb.upperBound });
    }
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const c = boxes[j];
      if (!a || !c) continue;
      // Sadece sabit-dinamik çiftleri ilgilendiriyor; kamyonun kendi parçaları
      // (şasi, teker, ayak) tasarım gereği üst üste.
      if (a.name === c.name) continue;
      const dx = Math.min(a.max.x, c.max.x) - Math.max(a.min.x, c.min.x);
      const dy = Math.min(a.max.y, c.max.y) - Math.max(a.min.y, c.min.y);
      // AABB kabadır; ciddi bir girişim olmadıkça susuyoruz.
      if (dx > 0.2 && dy > 0.2) {
        console.warn(
          `sahne uyarısı: ${a.name} ve ${c.name} gövdeler doğuşta iç içe `
          + `(${dx.toFixed(2)} × ${dy.toFixed(2)} m) — biri fırlayacak`,
        );
      }
    }
  }
}

interface Vec2Like { x: number; y: number }
