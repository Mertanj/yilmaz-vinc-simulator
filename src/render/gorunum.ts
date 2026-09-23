import { Container } from 'pixi.js';
import type { Task } from '../game/tasks';
import type { OyunSahnesi } from '../sim/sahne';
import { SIM } from '../sim/world';
import { Scene, SCENE } from '../sim/scene';
import { ForkliftSahnesi } from '../sim/forkliftSahne';
import { DirsekliSahne } from '../sim/dirsekliSahne';
import { PALET_AYAK } from '../game/forkliftTasks';
import { TRUCK } from '../sim/truck';
import { FORKLIFT } from '../sim/forklift';
import { drawLoad, TargetMarker } from './missionView';
import { TruckView, drawWheel, drawContactShadow } from './truckView';
import { OutriggerView } from './outriggerView';
import { CableView, drawHookBlock } from './craneView';
import { ForkliftView, drawForkliftWheel } from './forkliftView';
import {
  drawRaf, drawDepoZemin, drawDepoIci, drawPalet, drawDepoArkaPlan, drawKonveyor,
  derinlige, drawSevkiyatAlani, drawDisari, drawDorse, CepGostergesi, TozBulutu,
} from './depo';
import {
  drawGround, drawFactory, drawFarSkyline, drawEntranceSign, drawPropBox,
  drawSetupZone, drawKerb, drawSky,
} from './scenery';
import { drawAnaBom, drawKolon, KirmaBomView } from './dirsekliView';
import {
  drawSantiyeArka, drawStokSahasi, drawCit, drawTeslimatKamyonu,
} from './santiyeView';
import {
  drawBahceDuvari, drawParkCebi, drawSokakSirasi, drawYarimEv,
} from './avluView';
import { RIG } from './truckView';
import { DIRSEKLI } from '../sim/dirsekli';

/**
 * Bir aracın görünümü.
 *
 * `main.ts` artık hangi makineyi çizdiğini bilmiyor: dekoru, aktörleri ve
 * kare başına güncellemeyi bu arayüz veriyor. Yük ve hedef işareti ORTAK,
 * çünkü ikisi de göreve ait, makineye değil — o yüzden burada, taban sınıfta
 * duruyorlar ve üçüncü araç eklenirken tekrar yazılmayacaklar.
 */
export abstract class SahneGorunumu {
  /** Hareketli her şey; dünya katmanına bir kez ekleniyor. */
  readonly aktorler = new Container();
  protected readonly marker = new TargetMarker();
  private loadViewFor: Task | null = null;
  protected loadView: Container = new Container();
  /** Hedef işaretinin direk boyu (m) — raf katı terastan alçak. */
  protected isaretBoyu = 1.15;

  constructor(protected readonly sahne: OyunSahnesi) {}

  /** Sabit dekor — dünya katmanı. */
  abstract dekor(): Container[];
  /** Paralaks katmanı; boş olabilir. */
  uzak(): Container[] { return []; }
  /**
   * Kameradan bağımsız arka plan.
   *
   * Vinçte gökyüzü, forkliftte deponun iç hacmi. Ekran boyutuna bağlı olduğu
   * için her yeniden boyutlandırmada yeniden çiziliyor.
   */
  abstract arkaPlan(w: number, h: number): Container;
  /** Kameranın açılıştaki bakış noktası. */
  abstract baslangicOdak(): { x: number; y: number };
  /** Makineye özgü kare güncellemesi. */
  protected abstract makine(alpha: number): void;

  /** Aktörleri kur. Alt sınıf kendi parçalarını ekledikten SONRA çağırıyor. */
  protected yukuKur(): void {
    this.loadViewFor = this.sahne.loadTask;
    this.loadView = this.loadViewFor ? drawLoad(this.loadViewFor) : new Container();
    this.aktorler.addChild(this.marker, this.loadView);
  }

  ciz(alpha: number, hedef: { x: number; y: number } | null, hedefHw: number,
      frameDt = 1 / 60): void {
    void frameDt;
    this.makine(alpha);

    // Görev değiştiyse yük çizimini yenile: her yükün ölçüsü ve türü farklı.
    if (this.sahne.loadTask !== this.loadViewFor) {
      this.loadViewFor = this.sahne.loadTask;
      const yeni = this.loadViewFor ? this.yukCiz(this.loadViewFor) : new Container();
      this.aktorler.addChildAt(yeni, this.aktorler.getChildIndex(this.loadView));
      this.loadView.destroy({ children: true });
      this.loadView = yeni;
    }
    if (this.loadViewFor) {
      const l = this.sahne.snaps.interpolate(this.sahne.load, alpha);
      this.loadView.position.set(l.x, l.y);
      this.loadView.rotation = l.a;
    }

    // Hedef işareti yük havadayken parlıyor: kör kaldırmada aranan şey o.
    this.marker.update(hedef, hedefHw, this.sahne.hasLoad, this.isaretBoyu);
  }

  /** Yükün çizimi; forklift altına palet ekliyor. */
  protected yukCiz(t: Task, etiket = true): Container { return drawLoad(t, { etiket }); }
}

/** Vinç sahnesi — sanayi sitesi avlusu. */
export class VincGorunumu extends SahneGorunumu {
  private readonly shadow = drawContactShadow(TRUCK.chassisHalfLength * 0.92);
  private readonly truckView = new TruckView();
  private readonly wheelViews: Container[];
  private readonly propViews: Container[];
  private readonly outriggerView = new OutriggerView();
  private readonly cableView = new CableView();
  private readonly hookView = drawHookBlock();

  /**
   * Güncel yük dışındaki yükler: kasada bekleyenler ve sahaya konanlar.
   * Birinci bölümde boş; şantiyede görev değişince yeniden çiziliyor —
   * gövdeleri statik, yerleri de değişmiyor.
   */
  private readonly digerKatman = new Container();
  private digerGorevi: Task | null | undefined = undefined;

  constructor(private readonly s: Scene) {
    super(s);
    this.wheelViews = s.truck.wheels.map(() => drawWheel(TRUCK.wheelRadius));
    this.propViews = s.props.map((p) => drawPropBox(p.hw, p.hh));
    this.aktorler.addChild(this.shadow, ...this.propViews, this.digerKatman);
    this.yukuKur();
    this.aktorler.addChild(
      ...this.wheelViews, this.outriggerView, this.truckView,
      this.cableView, this.hookView,
    );
  }

  dekor(): Container[] {
    const b = this.s.bolum;
    const ortak = [
      drawSetupZone(b.setupX, b.setupYariEn), drawKerb(b.kerbX), drawEntranceSign(-14),
    ];
    if (b.id === 'santiye') {
      return [
        drawGround(SIM.groundLeft, SIM.groundRight),
        drawSantiyeArka(), ...ortak,
        drawStokSahasi(), drawCit(), drawTeslimatKamyonu(),
      ];
    }
    return [
      drawGround(SIM.groundLeft, SIM.groundRight),
      drawFactory(SCENE.factoryX), ...ortak,
    ];
  }

  override ciz(alpha: number, hedef: { x: number; y: number } | null,
               hedefHw: number, frameDt = 1 / 60): void {
    // Şantiyede işaret önce kasadaki yükü gösteriyor: ok yükün ÜSTÜNDE
    // olmalı, yoksa yükün arkasında kalıyor (forklift rampasındaki ders).
    const t = this.s.loadTask;
    this.isaretBoyu = this.s.isaretKaynakta && t ? t.halfHeight * 2 + 0.4 : 1.15;
    super.ciz(alpha, hedef, hedefHw, frameDt);
    this.digerleriGuncelle();
  }

  private digerleriGuncelle(): void {
    const t = this.s.loadTask;
    if (t === this.digerGorevi) return;
    this.digerGorevi = t;
    for (const c of this.digerKatman.removeChildren()) c.destroy({ children: true });
    for (const { task, body } of this.s.digerYukler) {
      const v = this.yukCiz(task, false);
      const p = body.getPosition();
      v.position.set(p.x, p.y);
      v.rotation = body.getAngle();
      this.digerKatman.addChild(v);
    }
  }

  override uzak(): Container[] { return [drawFarSkyline()]; }

  arkaPlan(w: number, h: number): Container { return drawSky(w, h); }

  baslangicOdak(): { x: number; y: number } {
    const p = this.s.truck.position;
    return { x: p.x, y: p.y + 3 };
  }

  protected makine(alpha: number): void {
    const { snaps, truck, crane, outriggers, props } = this.s;
    const c = snaps.interpolate(truck.chassis, alpha);
    this.truckView.position.set(c.x, c.y);
    this.truckView.rotation = c.a;
    this.shadow.position.set(c.x, 0.05);
    this.truckView.boom.setPose(crane.angleDeg, crane.extensionM);

    truck.wheels.forEach((body, i) => {
      const view = this.wheelViews[i];
      if (!view) return;
      const w = snaps.interpolate(body, alpha);
      view.position.set(w.x, w.y);
      view.rotation = w.a;
    });
    props.forEach((p, i) => {
      const view = this.propViews[i];
      if (!view) return;
      const s = snaps.interpolate(p.body, alpha);
      view.position.set(s.x, s.y);
      view.rotation = s.a;
    });

    const h = snaps.interpolate(crane.hook, alpha);
    this.hookView.position.set(h.x, h.y);
    this.hookView.rotation = h.a;
    this.cableView.update(crane.tipWorld, { x: h.x, y: h.y });
    this.outriggerView.update(outriggers.geometry(truck.chassis));
  }
}

/**
 * Dirsekli bom sahnesi — dar sokak.
 *
 * Kamyon gövdesi vinçle ORTAK (`TruckView`, teleskopik üst yapı kapalı);
 * ayrışan tek şey kol takımı. Kollar kamyonun çocuğu değil, ayrı aktörler:
 * fizikte de ayrı kinematik gövdeler ve konumlarını doğrudan Snapshotter'ın
 * ara değerlerinden alıyorlar. Aynı açıyı görünüm tarafında ikinci kez
 * hesaplamak teleskopik bomda bir kez ters işaretle yazılmış ve bom yere
 * doğru çizilmişti.
 */
export class DirsekliGorunumu extends SahneGorunumu {
  private readonly shadow = drawContactShadow(TRUCK.chassisHalfLength * 0.92);
  private readonly truckView = new TruckView(false);
  private readonly wheelViews: Container[];
  private readonly outriggerView = new OutriggerView();
  private readonly anaBomView = drawAnaBom();
  private readonly kirmaBomView = new KirmaBomView();
  private readonly cableView = new CableView();
  private readonly hookView = drawHookBlock();

  constructor(private readonly s: DirsekliSahne) {
    super(s);
    this.isaretBoyu = 0.8;
    this.wheelViews = s.truck.wheels.map(() => drawWheel(TRUCK.wheelRadius));
    // Kolon kamyonun çocuğu, çünkü şasiyle birlikte dönüyor ve kasaya
    // cıvatalı. Kollar değil: onların açısı şasininkinden bağımsız.
    const kolon = drawKolon();
    kolon.position.set(DIRSEKLI.pivot.x, RIG.deckTop);
    this.truckView.addChild(kolon);

    this.aktorler.addChild(this.shadow);
    this.yukuKur();
    this.aktorler.addChild(
      ...this.wheelViews, this.outriggerView, this.truckView,
      this.anaBomView, this.kirmaBomView, this.cableView, this.hookView,
    );
  }

  dekor(): Container[] {
    return [
      drawGround(SIM.groundLeft, SIM.groundRight),
      drawYarimEv(), drawBahceDuvari(), drawParkCebi(),
    ];
  }

  override uzak(): Container[] { return [drawSokakSirasi()]; }

  arkaPlan(w: number, h: number): Container { return drawSky(w, h); }

  baslangicOdak(): { x: number; y: number } {
    const p = this.s.truck.position;
    return { x: p.x - 2, y: p.y + 2.4 };
  }

  protected makine(alpha: number): void {
    const { snaps, truck, bom } = this.s;
    const c = snaps.interpolate(truck.chassis, alpha);
    this.truckView.position.set(c.x, c.y);
    this.truckView.rotation = c.a;
    this.shadow.position.set(c.x, 0.05);

    truck.wheels.forEach((body, i) => {
      const view = this.wheelViews[i];
      if (!view) return;
      const w = snaps.interpolate(body, alpha);
      view.position.set(w.x, w.y);
      view.rotation = w.a;
    });

    // Teleskop çizimi ara değerden DEĞİL, anlık durumdan: uzama fizikte
    // kinematik, yani zaten kare başına sürülüyor ve interpolasyona konu
    // olan tek şey gövdenin konumu.
    this.kirmaBomView.setUzama(bom.uzamaBoyuM);
    for (const [govde, view] of [
      [bom.anaBom, this.anaBomView] as const,
      [bom.kirmaBom, this.kirmaBomView] as const,
    ]) {
      const t = snaps.interpolate(govde, alpha);
      view.position.set(t.x, t.y);
      view.rotation = t.a;
    }

    const h = snaps.interpolate(bom.hook, alpha);
    this.hookView.position.set(h.x, h.y);
    this.hookView.rotation = h.a;
    this.cableView.update(bom.tipWorld, { x: h.x, y: h.y });
    this.outriggerView.update(this.s.outriggers.geometry(truck.chassis));
  }
}

/** Forklift sahnesi — kapalı depo. */
export class ForkliftGorunumu extends SahneGorunumu {
  private readonly shadow = drawContactShadow(FORKLIFT.chassisHalfLength * 0.95);
  private readonly makineView = new ForkliftView();
  private readonly wheelViews: Container[];

  constructor(private readonly s: ForkliftSahnesi) {
    super(s);
    this.isaretBoyu = 0.55;
    this.wheelViews = s.forklift.wheels.map(() => drawForkliftWheel(FORKLIFT.wheelRadius));
    this.aktorler.addChild(this.shadow);
    // Tekerler gövdenin ÜSTÜNDE: forkliftte davlumbaz yok, lastik açıkta
    // duruyor. Kamyondaki sıra (teker altta) burada makineyi kızak gibi
    // gösteriyordu. Yük ise EN ÜSTTE, çünkü çatalda taşınan yük direğin
    // önünde duruyor — arkasında değil.
    // Stok katmanı yükün ve makinenin ALTINDA: konan palet gözün
    // derinliğinde duruyor, koridordaki her şey onun önünden geçiyor.
    // Sırası gelmemiş paletler stoktan da geride: hâlâ rafın derinliğindeler.
    this.aktorler.addChild(this.bekleyenKatmani, this.stokKatmani);
    this.aktorler.addChild(this.makineView, ...this.wheelViews);
    this.yukuKur();
    // Cep göstergesi ve toz EN ÜSTTE: ikisi de makinenin önünde geçiyor.
    this.aktorler.addChild(this.toz, this.cepGostergesi);
  }

  /** Oyuncunun yerine koyduğu paletler — sahnede kalıyorlar. */
  private readonly stokKatmani = new Container();
  private cizilenStok = 0;
  /** Rafta sırasını bekleyen paletler; görev değişince yeniden çiziliyor. */
  private readonly bekleyenKatmani = new Container();
  private bekleyenlerGorevi: Task | null | undefined = undefined;
  private readonly cepGostergesi = new CepGostergesi();
  private readonly toz = new TozBulutu();
  private oncekiDusus = 0;

  dekor(): Container[] {
    const b = this.s.bolum;
    return [
      drawDisari(b),
      drawDepoIci(b.bati, b.dorse?.arka ?? b.dogu, b.dorse !== undefined),
      // Hazırlık alanı mal kabulün ya da ilk adanın koridorunun batısında
      // bitiyor: dorse bölümünde konveyör yok, ilk ada da daha batıda.
      drawSevkiyatAlani(b.bati,
        b.malKabul ? b.malKabul.x - 2 : (b.adaX[0] ?? b.bati) - 3.4),
      drawDepoZemin(b),
      drawRaf(b), drawKonveyor(b), drawDorse(b),
    ];
  }

  /**
   * Konan paletleri çiz. Kare başına yeniden kurmuyor: sahne listeye yeni
   * bir kayıt eklediğinde bir kez çiziliyor ve orada kalıyor.
   */
  private stoguGuncelle(): void {
    const liste = this.s.stok;
    // Bölüm yeniden başladıysa liste boşalıyor; çizim de boşalmalı.
    if (liste.length < this.cizilenStok) {
      for (const c of this.stokKatmani.removeChildren()) c.destroy({ children: true });
      this.cizilenStok = 0;
    }
    for (let i = this.cizilenStok; i < liste.length; i++) {
      const kayit = liste[i];
      if (!kayit) continue;
      const kutu = this.yukCiz(kayit.task, false);
      kutu.position.set(kayit.x, kayit.y);
      kutu.rotation = kayit.a;
      // Rafa konan gözün derinliğine itiliyor; dorseye konan yerinde kalıyor.
      this.stokKatmani.addChild(kayit.derin ? derinlige(kutu) : kutu);
    }
    this.cizilenStok = liste.length;
  }

  /** Rafta bekleyen paletleri görev değişince yeniden çiz. */
  private bekleyenleriGuncelle(): void {
    const t = this.s.loadTask;
    if (t === this.bekleyenlerGorevi) return;
    this.bekleyenlerGorevi = t;
    for (const c of this.bekleyenKatmani.removeChildren()) c.destroy({ children: true });
    for (const p of this.s.bekleyenPaletler) {
      const kutu = this.yukCiz(p.task, false);
      kutu.position.set(p.x, p.y);
      this.bekleyenKatmani.addChild(derinlige(kutu));
    }
  }

  /**
   * Yük çiziminin sırası: raftayken makinenin ARKASINDA, sonra önünde.
   *
   * Taşınan yük direğin önünde duruyor, o yüzden yük normalde en üstte.
   * Ama rafın derinliğinde bekleyen paletin önünden makine geçiyor — üstte
   * çizilse makine paletin arkasından geçiyormuş gibi görünürdü. Sıra
   * değiştiği anda makine paletin tamamen batısında (bkz. `rafaUlasir`),
   * yani ikisi üst üste değil ve geçiş görünmüyor.
   */
  private yukSirasi(): void {
    const a = this.aktorler;
    const yuk = this.loadView;
    const arkada = a.getChildIndex(yuk) < a.getChildIndex(this.makineView);
    if (this.s.paletRafta === arkada) return;
    a.removeChild(yuk);
    if (this.s.paletRafta) a.addChildAt(yuk, a.getChildIndex(this.makineView));
    else a.addChildAt(yuk, a.getChildIndex(this.marker) + 1);
  }

  override ciz(alpha: number, hedef: { x: number; y: number } | null,
               hedefHw: number, frameDt = 1 / 60): void {
    // İşaret raftaki paleti gösterirken ok paletin ÜSTÜNDE olmalı: 0.55
    // metrelik direkle ok paletin arkasında kalıyor, yan direkler de rafın
    // sarı dikme koruyucularına karışıyordu — işaret vardı ama görünmüyordu.
    const t = this.s.loadTask;
    this.isaretBoyu = this.s.isaretKaynakta && t
      ? PALET_AYAK + t.halfHeight * 2 + 0.3 : 0.55;
    super.ciz(alpha, hedef, hedefHw, frameDt);
    this.stoguGuncelle();
    this.bekleyenleriGuncelle();
    this.yukSirasi();
    this.cepGostergesi.guncelle(this.s.forklift.cep(this.s.grabbables));
    this.tozuSur(frameDt);
  }

  /**
   * Yük oturunca toz kaldır.
   *
   * Ölçüm burada: yükün düşey hızı belirgin şekilde eksiyken sıfıra
   * dönüyorsa yere değmiştir. "Bırakma tuşuna basıldı" diye bakmak yanlış
   * olurdu — forkliftte bırakma tuşu yok, palet çatal inerken kendiliğinden
   * oturuyor; zaten oyuncunun hissetmek istediği an da o.
   */
  private tozuSur(frameDt: number): void {
    const t = this.s.loadTask;
    if (t && !this.s.hasLoad) {
      const v = this.s.load.getLinearVelocity().y;
      if (this.oncekiDusus < -0.35 && v > -0.08) {
        const p = this.s.load.getPosition();
        this.toz.patlat(p.x, p.y - t.halfHeight - PALET_AYAK,
          t.halfWidth * 1.8, Math.min(1, -this.oncekiDusus / 1.6));
      }
      this.oncekiDusus = v;
    } else this.oncekiDusus = 0;
    this.toz.sur(frameDt);
  }

  /** Kapalı mekân: gökyüzü yok, deponun loş iç hacmi var. */
  arkaPlan(w: number, h: number): Container { return drawDepoArkaPlan(w, h); }

  baslangicOdak(): { x: number; y: number } {
    const p = this.s.forklift.chassis.getPosition();
    return { x: p.x, y: p.y + 2 };
  }

  /** Forklift yükü paletten alıyor; palet yükün altında çiziliyor. */
  protected override yukCiz(t: Task, etiket = true): Container {
    const c = new Container();
    const yuk = drawLoad(t, { etiket });
    const palet = drawPalet(t.halfWidth);
    palet.position.set(0, -t.halfHeight);
    c.addChild(palet, yuk);
    return c;
  }

  protected makine(alpha: number): void {
    const { snaps, forklift } = this.s;
    const c = snaps.interpolate(forklift.chassis, alpha);
    this.makineView.position.set(c.x, c.y);
    this.makineView.rotation = c.a;
    // Direk pimi şasi içinde zemin hizasında; `lift` zaten yerden kot,
    // dolayısıyla taşıyıcının yerel y'si doğrudan o.
    this.makineView.setPose(forklift.liftM, forklift.tiltDeg);
    this.shadow.position.set(c.x, 0.05);

    forklift.wheels.forEach((body, i) => {
      const view = this.wheelViews[i];
      if (!view) return;
      const w = snaps.interpolate(body, alpha);
      view.position.set(w.x, w.y);
      view.rotation = w.a;
    });
  }
}
