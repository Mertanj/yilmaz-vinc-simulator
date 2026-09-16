import { Box, type Body, type World, type Contact } from 'planck';
import {
  createWorld, createGround, createFactoryBody, createKerb, scatterProps,
  Snapshotter, SIM,
} from './world';
import { Truck } from './truck';
import { Outriggers } from './outriggers';
import { Crane, NEUTRAL, type CraneInput, type Grabbable } from './crane';
import type { DriveInput } from '../input/keyboard';
import { TASKS, MALZEME_X, type Task } from '../game/tasks';

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

export class Scene {
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
  get loadTask(): Task | null { return this.loadSpec; }

  /** Ayaklar yerdeyse vinç fazındayız: sürüş kilitli, vinç açık. */
  get craneMode(): boolean {
    return this.outriggers.fraction > 0.15;
  }

  /** Son kat değiştirme denemesinin sonucu — HUD gerekçeyi gösteriyor. */
  sonKatCevabi: { ok: boolean; neden: string } = { ok: true, neden: '' };

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
    if (input.toggleKat && craneMode) this.sonKatCevabi = this.crane.katDegistir();

    this.snaps.capture();

    // Ayaklar yerdeyken sürüş kilitli — gerçekte de öyle.
    this.truck.drive(craneMode ? { throttle: 0, handbrake: true } : input.drive);
    this.outriggers.update();

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
