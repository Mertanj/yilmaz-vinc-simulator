import { Box, type Body, type World } from 'planck';
import {
  createWorld, createGround, createFactoryBody, createKerb, scatterProps,
  Snapshotter, SIM,
} from './world';
import { Truck } from './truck';
import { Outriggers } from './outriggers';
import { Crane, NEUTRAL, type CraneInput, type Grabbable } from './crane';
import type { DriveInput } from '../input/keyboard';

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
  /**
   * Demo yükü 1.8 t — sayıyla seçildi, gözle değil.
   *
   * "Bom 2. kata yetmiyor" şikâyetinin sebebi bom DEĞİLDİ. Bom ucunun hedefin
   * tam üstünde olması gerektiği için L·cosθ = Δx, yani yarıçap yalnızca yatay
   * mesafeye bağlı — bom boyu ve açısı R'yi hiç değiştirmiyor. Park edilen
   * yerden üç hedefin de geometrisi rahat tutuyor (`npm run sahne` zarf
   * tablosunda hepsi "ulasir"); engelleyen yük tablosuydu.
   *
   * 2. kat R 17.6 m'de, kapasite 2.64 t. Yük + kanca:
   *   3.2 t → %143   2.4 t → %108   2.0 t → %93   1.8 t → %85
   * 1.8 t seçildi: statikte yeşilin üst ucu, salınım sırasındaki dinamik
   * sıçramalara pay kalıyor. Çatı (R 21.1 m, kap 1.81 t) bu yükle hâlâ kırmızı
   * — bölüm tasarımında ağır yük alt kata, hafif yük üst kata gidecek.
   */
  load: { x: 59.5, halfWidth: 1.15, halfHeight: 0.85, tonnes: 1.8 },
} as const;

/** Bir fizik adımının bütün girdisi. Klavye de, test de bunu üretir. */
export interface SceneInput {
  drive: DriveInput;
  crane: CraneInput;
  /** Bu karede ayakları aç/topla. */
  toggleOutriggers: boolean;
  /** Bu karede kancayı bağla/bırak. */
  toggleHook: boolean;
  /** Bu karede her şeyi başa al. */
  reset: boolean;
}

export const IDLE: SceneInput = {
  drive: { throttle: 0, handbrake: false },
  crane: NEUTRAL,
  toggleOutriggers: false,
  toggleHook: false,
  reset: false,
};

export class Scene {
  readonly world = createWorld();
  readonly snaps = new Snapshotter();
  readonly truck: Truck;
  readonly outriggers: Outriggers;
  readonly crane: Crane;
  readonly props: ReturnType<typeof scatterProps>;
  readonly load: Body;
  readonly grabbables: Grabbable[];

  constructor() {
    createGround(this.world);
    createFactoryBody(this.world);
    createKerb(this.world, SCENE.kerbX);
    this.truck = new Truck(this.world, this.snaps);
    this.outriggers = new Outriggers(this.world, this.truck.chassis, this.snaps);
    this.crane = new Crane(this.world, this.truck.chassis, this.snaps);
    this.props = scatterProps(this.world, this.snaps);

    const L = SCENE.load;
    this.load = this.world.createDynamicBody({ x: L.x, y: L.halfHeight + 0.05 });
    this.load.createFixture(new Box(L.halfWidth, L.halfHeight), {
      density: 1, friction: 0.85, restitution: 0.02,
    });
    this.load.setMassData({ mass: L.tonnes * 1000, center: { x: 0, y: 0 }, I: 1400 });
    this.load.setAngularDamping(0.5);
    this.snaps.track(this.load);

    this.grabbables = [
      { body: this.load, halfWidth: L.halfWidth, halfHeight: L.halfHeight },
      ...this.props.map((p) => ({ body: p.body, halfWidth: p.hw, halfHeight: p.hh })),
    ];

    assertNoSpawnOverlap(this.world);
  }

  /** Ayaklar yerdeyse vinç fazındayız: sürüş kilitli, vinç açık. */
  get craneMode(): boolean {
    return this.outriggers.fraction > 0.15;
  }

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
