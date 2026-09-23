import { Box, type Body, type World, type Contact } from 'planck';
import {
  createWorld, createGround, createKerb, scatterProps, Snapshotter, SIM,
} from './world';
import { Truck } from './truck';
import { Outriggers } from './outriggers';
import { Crane, CRANE, NEUTRAL, type CraneInput, type Grabbable } from './crane';
import type { DriveInput } from '../input/kumanda';
import type { Task } from '../game/tasks';
import { SANAYI, SANAYI_SITESI } from './sanayi';
import type { KonanYuk, VincBolum } from './vincBolum';
import { OutriggerState, capacityAt, halatKapasitesi } from './loadChart';
import type { Gosterge, OyunSahnesi, PanelSatiri, Uyari } from './sahne';
import { imzaliDerece, almaSatiri, tasimaSatiri } from './sahne';
import { Ret } from './ret';
import type { SimKipi } from './kip';
import { M, kumandaAdi } from '../ui/dil';

/**
 * Sahnenin fizik tarafı — tek kaynak.
 *
 * main.ts bunu çizer, tools/headless.ts aynısını klavyesiz sürer. Ayrı ayrı
 * kurulsalardı test ettiğimiz dünya ile oynanan dünya sessizce ayrışırdı; bu
 * projede her fizik kararı ölçümle alındığı için o ayrışma en pahalı hata olurdu.
 */
export const SCENE = {
  /** Birinci bölümün yerleşimi (bkz. `SANAYI`) — eski okuyucular için. */
  ...SANAYI,
  /** Bunun üstündeki normal impuls (N·s) çarpma sayılıyor. */
  carpmaEsigiNs: 9000,
} as const;

/**
 * Oyuncu bu karede bom kumandasına dokundu mu?
 *
 * Kilidi söyleyebilmek için gerekiyor: "hiçbir şey olmadı" ile "yanlış fazda
 * bir şey denedin" ancak girdiye bakarak ayrılıyor.
 */
export function bomGirdisiVar(input: SceneInput): boolean {
  const c = input.crane;
  return input.toggleHook || input.toggleKat
    || c.luff !== 0 || c.telescope !== 0 || c.uzat !== 0 || c.winch !== 0;
}

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

  constructor(readonly bolum: VincBolum = SANAYI_SITESI) {
    createGround(this.world);
    bolum.kur(this.world);
    createKerb(this.world, bolum.kerbX);
    this.truck = new Truck(this.world, this.snaps);
    this.outriggers = new Outriggers(this.world, this.truck.chassis, this.snaps);
    this.crane = new Crane(this.world, this.truck.chassis, this.snaps);
    this.props = scatterProps(this.world, this.snaps);

    this.spawnLoad(bolum.gorevler[0] ?? null);

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
    this.tasindi = false;
    if (this.bolum.kalici) { this.kaliciYukle(spec); return; }
    if (this.load) { this.world.destroyBody(this.load); this.snaps.birak(this.load); }
    this.loadSpec = spec;
    if (!spec) {
      this.grabbables = this.props.map((p) => ({ body: p.body, halfWidth: p.hw, halfHeight: p.hh }));
      return;
    }
    const body = this.yukGovdesi(spec);
    this.load = body;
    this.grabbables = [
      { body, halfWidth: spec.halfWidth, halfHeight: spec.halfHeight },
      ...this.props.map((p) => ({ body: p.body, halfWidth: p.hw, halfHeight: p.hh })),
    ];
  }

  /** Görevin yükünü doğduğu yerde, dinamik gövde olarak kurar. */
  private yukGovdesi(t: Task): Body {
    const body = this.world.createDynamicBody(this.bolum.yukYeri(t));
    body.createFixture(new Box(t.halfWidth, t.halfHeight), {
      density: 1, friction: 0.85, restitution: 0.02,
    });
    this.kutleyiYaz(body, t);
    body.setAngularDamping(0.5);
    this.snaps.track(body);
    return body;
  }

  /**
   * Atalet momenti kütleyle ölçekleniyor: sabit bırakılınca ağır yük hafif
   * yükten daha çabuk dönüyordu, ki bu tersine olmalı. `setType` kütleyi
   * sıfırladığı için statikten dinamiğe dönen yükte yeniden yazılıyor.
   */
  private kutleyiYaz(body: Body, t: Task): void {
    body.setMassData({
      mass: t.tonnes * 1000,
      center: { x: 0, y: 0 },
      I: (t.tonnes * 1000 * (t.halfWidth ** 2 + t.halfHeight ** 2)) / 3,
    });
  }

  /** Sırası gelmemiş, kasada bekleyen yükler — yalnız kalıcı bölümde. */
  private readonly bekleyenler = new Map<Task, Body>();
  /** Yerine konmuş yükler — görev kodu → gövde. Yalnız kalıcı bölümde. */
  private readonly konanGovdeler = new Map<string, { task: Task; body: Body }>();

  /**
   * Kalıcı bölümde yük akışı: bütün yükler baştan sahnede.
   *
   * Bölüm başında her görevin yükü kendi yerinde STATİK olarak kuruluyor —
   * kamyon beş yükle geliyor ve sırası gelmemiş yük kasada kıpırdamadan
   * duruyor, ama katı: sallanan yük ona çarparsa çarpma yazıyor. Sırası
   * gelen dinamiğe dönüyor; yerine konan yeniden statik oluyor ve orada
   * kalıyor, bir sonraki onun üstüne istiflenebiliyor.
   */
  private kaliciYukle(spec: Task | null): void {
    const bolumBasi = spec !== null && spec === this.bolum.gorevler[0];
    if (bolumBasi) {
      const yok = new Set<Body>([
        ...this.bekleyenler.values(),
        ...[...this.konanGovdeler.values()].map((k) => k.body),
      ]);
      if (this.load) yok.add(this.load);
      for (const b of yok) { this.world.destroyBody(b); this.snaps.birak(b); }
      this.bekleyenler.clear();
      this.konanGovdeler.clear();
      for (const t of this.bolum.gorevler) {
        const b = this.yukGovdesi(t);
        b.setType('static');
        this.bekleyenler.set(t, b);
      }
    } else if (this.load && this.loadSpec) {
      this.load.setType('static');
      this.konanGovdeler.set(this.loadSpec.kod, { task: this.loadSpec, body: this.load });
    }
    this.loadSpec = spec;
    const props = this.props.map((p) => ({ body: p.body, halfWidth: p.hw, halfHeight: p.hh }));
    const body = spec ? this.bekleyenler.get(spec) : undefined;
    if (!spec || !body) { this.grabbables = props; return; }
    this.bekleyenler.delete(spec);
    body.setType('dynamic');
    this.kutleyiYaz(body, spec);
    body.setAngularDamping(0.5);
    this.load = body;
    this.grabbables = [
      { body, halfWidth: spec.halfWidth, halfHeight: spec.halfHeight }, ...props,
    ];
  }

  /** Güncel yük bir kez olsun kancada kalktı mı? */
  private tasindi = false;

  /**
   * İşaret şu an yükün KENDİSİNİ mi gösteriyor?
   *
   * Şantiyede yük kasanın beş yerinden birinde ve birinci bölümdeki gibi
   * hep aynı noktada değil. Forklift rampasındaki kural: işaret her an
   * "şimdi nereye" sorusunun cevabı — önce yük, kalktıktan sonra hedef.
   */
  get isaretKaynakta(): boolean {
    return this.bolum.kalici && !this.tasindi && this.loadSpec !== null;
  }

  isaretNoktasi(t: Task): { x: number; y: number } | null {
    if (this.isaretKaynakta && t === this.loadSpec) {
      const p = this.load.getPosition();
      return { x: p.x, y: p.y - t.halfHeight };
    }
    return this.hedefNoktasi(t);
  }

  yeniYukYeri(): string | null {
    return this.bolum.kalici && this.loadSpec ? M.vinc.yer.kasa : null;
  }

  /** Güncel yük DIŞINDAKİ yükler — kasada bekleyenler ve konanlar. Çizim için. */
  get digerYukler(): Array<{ task: Task; body: Body }> {
    return [
      ...[...this.bekleyenler].map(([task, body]) => ({ task, body })),
      ...this.konanGovdeler.values(),
    ];
  }

  /** Konmuş yüklerin GERÇEK yerleri — istif hedefi bunlardan hesaplanıyor. */
  private get konanlar(): ReadonlyMap<string, KonanYuk> {
    const m = new Map<string, KonanYuk>();
    for (const [kod, { task, body }] of this.konanGovdeler) {
      const p = body.getPosition();
      m.set(kod, { x: p.x, y: p.y, hw: task.halfWidth, hh: task.halfHeight });
    }
    return m;
  }

  get gorevler(): readonly Task[] { return this.bolum.gorevler; }
  get hizEsikleri(): { tam: number; sifir: number } { return this.bolum.hizEsikleri; }
  hedefNoktasi(t: Task): { x: number; y: number } | null {
    return this.bolum.hedefNoktasi(t, this.konanlar);
  }
  yerlestirmeToleransi(t: Task): { x: number; y: number } {
    return this.bolum.yerlestirmeToleransi(t);
  }
  get sasiHizi(): number { return this.truck.chassis.getLinearVelocity().x; }
  get kameraOlcegi(): { yakin: number; uzak: number } { return this.bolum.kameraOlcegi; }
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
    const noktalar = [{ x: c.x, y: c.y + 2.2 }, this.crane.tipWorld, this.yukNoktasi];
    // Kasadaki yük kadrajda olsun: kamyon çitin ardında, vince 25 metre.
    // Tepesi DE tabanı da: yalnız tepeye bakınca yükün alt yarısı ekranın
    // altındaki tuş şeridinin arkasına düşüyordu (masaüstünde ölçüldü).
    if (this.isaretKaynakta) {
      const p = this.load.getPosition();
      const hh = this.loadSpec?.halfHeight ?? 0.5;
      noktalar.push({ x: p.x, y: p.y + hh + 0.8 }, { x: p.x, y: p.y - hh - 0.6 });
    }
    return noktalar;
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
      // Hangi kumanda kipindeyiz — detayda, çünkü oyuncu bunu seçim
      // ekranında zaten okudu; burada sadece hatırlatma.
      { detay: true, etiket: M.panel.kip,
        deger: this.kipAdi },
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

    // Ret EN ÖNDE, hatta çalışma modu denetiminden de önde: kilitli kumanda
    // uyarısının görüneceği tek yer SÜRÜŞ fazı. Üç buçuk saniye sonra kendi
    // kendine çekiliyor ve altındaki uyarı neyse o geri geliyor.
    const red = this.ret.aktif;
    if (red) return { zone: 'amber', carpiyor: false, ret: true, ...red };
    if (!this.craneMode) return null;

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
        // Uçtaki yükte bomu kaldırmak yükü kasadan koparamaz; orada tek
        // çare halat katı (klavyede).
        cozum: this.katOnerisi() ?? (kilitli ? u.asiriCozumKilitli : u.asiriCozum),
      };
    }
    if (r.zone === 'amber') {
      return {
        zone: 'amber', carpiyor: false,
        bas: u.yakinBas,
        govde: u.yakinGovde(r.loadTonnes.toFixed(2), r.capacityTonnes.toFixed(2),
          this.crane.radiusM.toFixed(1)),
        cozum: this.katOnerisi() ?? '',
      };
    }
    return null;
  }

  /**
   * Tek kat halata geçmek bu yükte ibreyi anlamlı düşürüyor mu? Düşürüyorsa
   * öneri cümlesi — yalnız klavyede, çünkü telefonda halat katı düğmesi yok.
   *
   * Karşılaştırma tablo ile halat sınırının KÜÇÜĞÜNE karşı: tek kat 2 tonda
   * duruyor, ağır yükte tek kat önermek yalan olurdu.
   */
  private katOnerisi(): string | null {
    const k = kumandaAdi();
    const t = this.loadTask;
    if (!k.kat || !t || !this.crane.hasLoad || this.crane.katSayisi === 1) return null;
    const blokSimdi = CRANE.hookTonnesByKat[this.crane.katSayisi] ?? CRANE.hookTonnes;
    const blokTek = CRANE.hookTonnesByKat[1] ?? blokSimdi;
    const sinir = Math.min(capacityAt(this.crane.radiusM, this.outriggers.state),
      halatKapasitesi(1));
    const yeni = (t.tonnes + blokTek) / sinir;
    const simdi = this.crane.lmi.percent / 100;
    if (!(yeni < 0.9 && yeni < simdi - 0.1)) return null;
    return M.vinc.uyari.katOnerisi(((blokSimdi - blokTek) * 1000).toFixed(0),
      (yeni * 100).toFixed(0), k.kat);
  }

  ipucu(): { metin: string; mod: 'drive' | 'crane' | 'ready' } {
    const i = M.vinc.ipucu;
    const k = kumandaAdi();
    if (!this.craneMode) {
      // **Doğru yerde olduğunu da söyle.** Bölüm boyunca oyuncuya sadece neyi
      // yanlış yaptığı söyleniyordu; "yanaş" satırı kamyon tam alanın ortasında
      // dururken de aynen duruyor ve oyuncu ayaklara ne zaman basacağını
      // tahmin ediyordu. Pencere çizilen sarı alanın kendisi.
      const x = this.truck.chassis.getPosition().x;
      if (Math.abs(x - this.bolum.setupX) <= this.bolum.setupYariEn) {
        return { metin: i.alanda(k), mod: 'ready' };
      }
      return { metin: i.surus(k), mod: 'drive' };
    }
    // Halat geçirme 14 saniye sürüyor ve o sırada makine hiçbir şey yapmıyor.
    // Geri sayım gösterge bloğunun alt satırında da var ama o satır dar
    // ekranda gizli; ipucu satırı her boyutta görünüyor.
    if (this.crane.reevingSuresi > 0) {
      return {
        metin: M.vinc.alt.reeving(this.crane.reevingSuresi.toFixed(0)),
        mod: 'crane',
      };
    }
    if (this.crane.hasLoad) {
      // Taşırken de yön ve mesafe — gerekçesi `tasimaSatiri`'nda.
      const t = this.loadTask;
      const h = t ? this.hedefNoktasi(t) : null;
      const yuk = this.load.getPosition();
      // Bölümün kendi engeli (şantiye çiti) genel yön satırından önce.
      const engel = t ? this.bolum.tasimaIpucu?.({
        x: yuk.x, y: yuk.y, yariEn: t.halfWidth, yariBoy: t.halfHeight,
      }) : null;
      if (engel) return { metin: engel, mod: 'crane' };
      const satir = t && h
        ? tasimaSatiri({ x: yuk.x, y: yuk.y - t.halfHeight }, h,
          this.yerlestirmeToleransi(t))
        : null;
      return { metin: satir ?? i.yukBagli(k), mod: 'crane' };
    }
    const { reason, sapma } = this.crane.attachCheck(this.grabbables);
    const say: Record<typeof reason, string> = {
      hazir: i.hazir(k),
      sallaniyor: i.sallaniyor,
      'yan-cekme': i.yanCekme,
      ortala: i.ortala,
      yukseklik: i.yukseklik,
      uzak: i.uzak,
    };
    // **Doygun eksen söyleniyor.** Vektör satırı "kancayı 0.9 m sola getir"
    // diyor ama yarıçapı iki eksen belirliyor; biri dibe vurunca tek çare
    // diğeri. Bölümün başında teleskop tam içeride ve oyuncu "sola" deyince
    // teleskopa basıp hiçbir şeyin olmadığını görüyor.
    let metin = almaSatiri(reason, sapma, say[reason]);
    if (sapma && (reason === 'ortala' || reason === 'uzak')) {
      // Sola = yarıçap küçülsün = teleskop içeri; olmuyorsa bom kalkacak.
      const yon = sapma.dx > 0 ? 1 : -1;
      if (!this.crane.teleskopGidebilir(yon)) metin += i.teleskopDoydu(yon < 0, k);
    }
    return { metin, mod: reason === 'hazir' ? 'ready' : 'crane' };
  }

  /** Reddedilen son komutun cevabı — gerekçesi `ret.ts`'te. */
  private readonly ret = new Ret();

  /** Şasi eğimi, derece. Ekranda gördüğümüz işaretle aynı. */
  get tiltDeg(): number {
    return (-this.truck.chassis.getAngle() * 180) / Math.PI;
  }

  kipiSec(k: SimKipi): void { this.kip = k; this.crane.kipiSec(k); }
  private kip: SimKipi = 'tam';
  private get kipAdi(): string {
    return this.kip === 'temel' ? M.secim.kipTemel : M.secim.kipTam;
  }

  step(input: SceneInput, dt: number): void {
    if (input.reset) {
      this.truck.reset();
      this.outriggers.reset(this.truck.chassis);
    }
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
    const craneMode = this.craneMode;
    if (craneMode && (input.drive.throttle !== 0 || input.drive.handbrake)) {
      this.ret.yaz({
        bas: u.surusKilitliBas, govde: u.surusKilitliGovde,
        cozum: u.surusKilitliCozum(kumandaAdi()),
      });
    }
    if (!craneMode && bomGirdisiVar(input)) {
      this.ret.yaz({
        bas: u.bomKilitliBas, govde: u.bomKilitliGovde,
        cozum: u.bomKilitliCozum(kumandaAdi()),
      });
    }

    if (input.toggleOutriggers) {
      // **Yük kancadayken ayak toplanmaz.** Toplanırsa `craneMode` düşüyor,
      // bom yol konumuna katlanıyor ve asılı yükü yanında sürüklüyor. Eskiden
      // bu SESSİZCE oluyordu: oyuncu ayak düğmesine basıyor, yük savruluyor,
      // hiçbir şey söylenmiyordu. Gerçek makinede de kilitli.
      if (this.crane.hasLoad) {
        this.ret.yaz({ bas: u.ayakBas, govde: u.ayakGovde, cozum: u.ayakCozum });
      } else {
        this.outriggers.toggle();
        this.ret.temizle();
      }
    }

    // **Kilitli kumanda artık sessiz değil.** Sürüş fazında bom tuşları
    // hiçbir şey yapmıyordu ve hiçbir şey de söylemiyordu; oyuncunun "yanlış
    // tuş" ile "oyun donmuş" arasını ayırmasının yolu yoktu.
    if (!craneMode && bomGirdisiVar(input)) {
      this.ret.yaz({
        bas: u.bomKilitliBas, govde: u.bomKilitliGovde,
        cozum: u.bomKilitliCozum(kumandaAdi()),
      });
    }
    this.crane.setStowed(!craneMode);
    if (input.toggleHook && craneMode) {
      const cevap = this.crane.requestToggleAttach();
      if (cevap.neden === 'havada') {
        this.ret.yaz({ bas: u.birakBas, govde: u.birakGovde, cozum: u.birakCozum });
      } else if (cevap.ok) {
        this.ret.temizle();
      }
    }
    if (input.toggleKat && craneMode) {
      const neden = this.crane.katDegistir().neden;
      if (neden === '') this.ret.temizle();
      else {
        this.ret.yaz({
          bas: u.katBas, govde: u.katGovde(neden),
          // "Zaten geçiriliyor" bir hata değil, bilgi: çözüm satırı yok.
          cozum: neden === 'suruyor' ? '' : u.katCozum,
        });
      }
    }
    this.ret.azalt(dt);

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
    if (this.crane.hasLoad) this.tasindi = true;

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
