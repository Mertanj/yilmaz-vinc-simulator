import { Box, Polygon, Vec2, type Body, type Contact, type World } from 'planck';
import { createWorld, createGround, KATEGORI, MASKE, Snapshotter, SIM } from './world';
import { Forklift, forkliftKapasitesi, FORKLIFT, FORKLIFT_NEUTRAL } from './forklift';
import type { Grabbable } from './crane';
import { LmiZone, type LmiReading } from './loadChart';
import {
  PALET_AYAK, RAF_DERINLIK, SEVKIYAT_KORIDORU, TESLIM_HIZI, ZEMIN_BANDI,
} from '../game/forkliftTasks';
import {
  DORSE_ARALIGI, DORSE_PAYI, adresKotu, adresX, dorseSiraMerkezi, katAdi,
  type Dorse, type ForkliftBolum, type ForkliftGorevi,
} from '../game/forkliftBolum';
import type { Task } from '../game/tasks';
import type { SceneInput } from './scene';
import type { Gosterge, OyunSahnesi, PanelSatiri, Uyari } from './sahne';
import { imzaliDerece, tasimaSatiri } from './sahne';
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
/**
 * Kaldırma kilidinin devreye girdiği bant (m): kirişin bu kadar altı.
 *
 * Temasın hemen öncesi olmalı — daha geniş bant meşru yerleştirmeyi de
 * kilitliyor, daha dar bant krikoyu durdurmaya yetişmiyor.
 */
const KILIT_BANDI = 0.25;

export function createRaf(world: World, b: ForkliftBolum): Body {
  const body = world.createBody();
  const filtre = { filterCategoryBits: KATEGORI.raf, filterMaskBits: MASKE.raf };
  for (const on of b.adaX) {
    const arka = on + RAF_DERINLIK;
    for (const kot of b.katlar) {
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
 * Deponun iki ucundaki duvarlar.
 *
 * **Bunlar yokken bölüm 20 saniyede bitiyordu.** Ölçüldü: başlangıçtan
 * itibaren sadece geri vitese basmak yeterli — makine 65 metre batıya
 * gidiyor, çizilmiş deponun dışına çıkıyor ve x = −61'de zemin plakasının
 * ucundan düşüyor (`SIM.groundLeft` −60). Sonuç: hiçbir uyarı almadan,
 * görünürde hiçbir şeye çarpmadan `ARAÇ DEVRİLDİ`, 0 puan.
 *
 * Duvar hem dürüst hem ucuz: depo KAPALI bir mekân, arka duvarı ve çatısı
 * zaten çiziliyordu; eksik olan yalnızca iki uçtaki sınırdı. Makineyle,
 * yükle ve çatalla çarpışıyor.
 */
export function createDepoDuvarlari(world: World, b: ForkliftBolum): Body {
  const body = world.createBody();
  const yukseklik = 9;
  for (const x of [b.bati, b.dogu]) {
    body.createFixture(
      new Box(0.4, yukseklik, new Vec2(x + (x < 0 ? -0.4 : 0.4), yukseklik), 0),
      { friction: 0.4, restitution: 0 },
    );
  }
  return body;
}

/**
 * Dorsenin ön duvarı — paletlerin dayandığı yer.
 *
 * Yalnız ön duvar fizikte; taban depo zeminiyle aynı kotta olduğu için
 * zemin plakası zaten onu taşıyor (bkz. `Dorse`). Duvar HER ŞEYLE çarpışıyor,
 * çatal dahil: boş çatalla duvara sürmek sahada da duvara sürmektir. Bu
 * yüzden dibe giden ilk palet çataldan DERİN olmak zorunda — sığ bir
 * paletin önünden taşan bıçak ucu duvara dayanır ve palet dibe varamaz
 * (bölüm verisi bunu kuruyor, sahne değil).
 */
export const ON_DUVAR = { kalinlik: 0.14, yukseklik: 2.4 } as const;

export function createDorse(world: World, d: Dorse): Body {
  const body = world.createBody();
  body.createFixture(
    new Box(ON_DUVAR.kalinlik / 2, ON_DUVAR.yukseklik / 2,
      new Vec2(d.on + ON_DUVAR.kalinlik / 2, ON_DUVAR.yukseklik / 2), 0),
    { friction: 0.6, restitution: 0 },
  );
  return body;
}

/**
 * Paletin çarpışmasını aç ya da kapat.
 *
 * Her fikstürün asıl maskesi kendi `userData`sında duruyor; kapatınca maske
 * sıfır oluyor (`MASKE.stok` ile aynı anlam: hiçbir şeye değmiyor), açınca
 * asıl maskeye dönüyor. Maskeyi burada yeniden yazmak, `spawnLoad`'daki
 * filtreyle sessizce ayrışabilecek ikinci bir kopya olurdu.
 */
function carpisma(body: Body, acik: boolean): void {
  for (let f = body.getFixtureList(); f; f = f.getNext()) {
    const asil = f.getUserData();
    if (typeof asil === 'number') f.setFilterMaskBits(acik ? asil : 0);
  }
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
  /**
   * Palet nerede?
   *
   * - `bekliyor`/`iniyor`: konveyörde ya da iniyor;
   * - `rafta`: raf gözünün derinliğinde — makine henüz batısına geçmedi;
   * - `hazir`: alınabilir.
   */
  private teslim: 'bekliyor' | 'iniyor' | 'rafta' | 'hazir' = 'hazir';

  constructor(readonly bolum: ForkliftBolum = SEVKIYAT_KORIDORU) {
    createGround(this.world);
    createRaf(this.world, bolum);
    createDepoDuvarlari(this.world, bolum);
    if (bolum.dorse) createDorse(this.world, bolum.dorse);
    this.forklift = new Forklift(this.world, this.snaps);
    this.spawnLoad(bolum.gorevler[0] ?? null);

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
  readonly stok: Array<{
    task: Task; x: number; y: number; a: number;
    /**
     * Rafa konan palet gözün DERİNLİĞİNE itilmiş sayılıyor ve çizimde
     * kaydırılıyor; dorseye konan olduğu yerde duruyor.
     */
    derin: boolean;
  }> = [];

  /**
   * Dorseye konmuş paletlerin gövdeleri — **katı ve statik.**
   *
   * Rafa konan palet çarpışmayı bırakıyor (derinliğe itildi, koridordan
   * çıktı). Dorsede bu doğru olmazdı: konan palet orada, bir sonrakinin
   * önünde duruyor. İkinci bölümün dersi tam da bu — ilk palet en dibe,
   * sonrakiler ona dayanarak. Kötü konan palet bir sonrakinin yerini
   * gerçekten kapatıyor.
   */
  private readonly katilar: Body[] = [];

  spawnLoad(spec: Task | null): void {
    // `gorevler[0]` ile çağrılmak bölümün BAŞI demek: ya ilk açılış ya da
    // yeniden başlatma. İkisinde de depo boş sayfadan başlamalı.
    const bolumBasi = spec !== null && spec === this.bolum.gorevler[0];
    if (bolumBasi) {
      this.stok.length = 0;
      for (const g of this.katilar) { this.world.destroyBody(g); this.snaps.birak(g); }
      this.katilar.length = 0;
    }
    if (this.load) {
      // Bölüm ortasında yeni görev geliyorsa öncekini oyuncu YERİNE KOYDU;
      // sahnede kalsın. Başta ise eskisini temizliyoruz.
      const onceki = this.loadSpec;
      if (!bolumBasi && onceki) {
        const p = this.load.getPosition();
        const dorsede = this.gorev(onceki).varis.tur === 'dorse';
        this.stok.push({
          task: onceki, x: p.x, y: p.y, a: this.load.getAngle(), derin: !dorsede,
        });
        if (dorsede) {
          this.load.setType('static');
          // **Çatal dorsedeki palete DEĞMİYOR.** Bıçak 1.35 metre ve dar
          // paletlerden uzun: dibine kadar sokulmuş bıçağın ucu paletin
          // önünden 30 santim taşıyor. Komşu palet çatalla çarpışsaydı uç
          // ona dayanır, taşınan palet komşusuna hiç yanaşamazdı — sıkı
          // istif, dersin kendisi, imkânsız olurdu. Gerçekte de bıçağın ucu
          // öndeki paletin cebine girer. Paletler birbirine yine değiyor.
          for (let f = this.load.getFixtureList(); f; f = f.getNext()) {
            const m = f.getFilterMaskBits() & ~KATEGORI.catal;
            f.setFilterMaskBits(m);
            f.setUserData(m);
          }
          this.katilar.push(this.load);
        } else {
          this.world.destroyBody(this.load);
          this.snaps.birak(this.load);
        }
      } else {
        this.world.destroyBody(this.load);
        this.snaps.birak(this.load);
      }
    }
    this.loadSpec = spec;
    this.tasindi = false;
    if (!spec) { this.grabbables = []; return; }

    const kaynak = this.gorev(spec).kaynak;
    const yerKotu = spec.halfHeight + PALET_AYAK;
    let x: number;
    let y: number;
    if (kaynak.tur === 'raf') {
      // **Palet gözün ön kenarında, kirişe AYAKLARIYLA oturmuş doğuyor** —
      // birinci bölümde oyuncunun onu bıraktığı yerin tam aynısı. Tam oturma
      // kotunda doğması şart: birkaç santim yukarıda doğsa kirişe düşüp
      // sekiyor, oyuncu daha dokunmadan yerinden oynuyordu.
      const kot = adresKotu(this.bolum, kaynak.adres) ?? 0;
      const on = adresX(this.bolum, kaynak.adres) ?? 0;
      x = on + spec.halfWidth + 0.06;
      y = kot + yerKotu;
      this.teslim = this.rafaUlasir(x - spec.halfWidth) ? 'hazir' : 'rafta';
    } else {
      // **Palet ancak makine yükleme karesinin BATISINDAYKEN iniyor.**
      // Forklift dönemediği için paleti alabilmek hep onun batısında olmak
      // demek; oysa önceki paleti rafa bırakınca makine doğuda kalıyor.
      // Palet önceden yerde dursaydı makine batıya dönerken onu önüne
      // katardı (ölçüldü: palet 1.7 metre süründü, çatal cebe hiç girmedi).
      // Mal kabul konveyörü sahada da tam olarak bunu yapıyor: sen yerine
      // geçince indirir.
      const mk = this.bolum.malKabul;
      if (!mk) throw new Error(`${this.bolum.id}: konveyör kaynağı var, mal kabul yok`);
      const acik = this.forklift.forkTip.x < mk.beklemeCizgisi;
      this.teslim = acik ? 'hazir' : 'bekliyor';
      x = mk.x;
      y = acik ? yerKotu : mk.teslimKotu + spec.halfHeight;
    }
    const body = this.world.createDynamicBody({ x, y });
    if (this.teslim === 'bekliyor') body.setType('kinematic');
    // Yükün kendisi: her şeye değiyor.
    body.createFixture(new Box(spec.halfWidth, spec.halfHeight), {
      density: 1, friction: 0.9, restitution: 0.01,
      filterCategoryBits: KATEGORI.yuk, filterMaskBits: MASKE.yuk,
      userData: MASKE.yuk,
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
          filterMaskBits: MASKE.paletAyagi & MASKE.yuk,
          userData: MASKE.paletAyagi & MASKE.yuk },
      );
    }
    this.load = body;
    this.kutleyiYaz(spec);
    body.setAngularDamping(0.6);
    this.snaps.track(body);
    if (this.teslim === 'rafta') {
      // Rafın derinliğinde: hiçbir şeye değmiyor, düşmüyor, alınamıyor.
      carpisma(body, false);
      body.setType('static');
      this.grabbables = [];
      return;
    }
    this.grabbables = [{
      body, halfWidth: spec.halfWidth, halfHeight: spec.halfHeight, ayakM: PALET_AYAK,
    }];
  }

  /**
   * Makine raftaki palete ulaşabilir mi — yani TAMAMEN batısında mı?
   *
   * **Sorunun kendisi 2B'den doğuyor.** Çatal doğuya bakıyor ve dorse
   * doğuda; yani palet her seferinde doğudan geri gelen bir makinenin
   * önünde. Palet baştan katı olsaydı makine ona arkasından çarpardı:
   * zemin gözündekini direk ve sırtlık itiyor, 2.80'deki paletin tabanı
   * (3.16 m) ise direğin tepesinden (3.30 m) alçakta — geri geri gelen
   * makine onu kirişten süpürürdü.
   *
   * Yan görünümün baştan beri kullandığı sözleşme bunu zaten çözüyor: raf
   * koridorun DERİNLİĞİNDE duruyor ve makine onun önünden geçiyor (kirişler
   * de bu yüzden makineye değmiyor). Palet de makine adanın batısına
   * geçene kadar o derinlikte bekliyor; çatalın ucu paletin önüne çıkınca
   * gözün önüne geliyor. O anda makinenin hiçbir parçası paletle üst üste
   * değil — çatalın ucu makinenin en doğu noktası.
   */
  private rafaUlasir(paletBatisi: number): boolean {
    return this.forklift.forkTip.x < paletBatisi - 0.05;
  }

  /** Raftaki palet gözün önüne geldi: artık katı, düşebilir, alınabilir. */
  private raftanCikar(spec: Task): void {
    this.load.setType('dynamic');
    carpisma(this.load, true);
    this.load.setLinearVelocity({ x: 0, y: 0 });
    this.load.setAngularVelocity(0);
    this.kutleyiYaz(spec);
    this.teslim = 'hazir';
    this.grabbables = [{
      body: this.load, halfWidth: spec.halfWidth, halfHeight: spec.halfHeight,
      ayakM: PALET_AYAK,
    }];
  }

  yeniYukYeri(): string | null {
    const t = this.loadSpec;
    if (!t) return null;
    const k = this.gorev(t).kaynak;
    return k.tur === 'raf' ? M.forklift.yer.raf(katAdi(this.bolum, k.adres))
      : M.forklift.yer.konveyor;
  }

  /** Palet hâlâ rafın derinliğinde mi? Çizim bunu soruyor. */
  get paletRafta(): boolean { return this.teslim === 'rafta'; }

  /**
   * Sırası henüz gelmemiş, rafta bekleyen paletler — tamamen çizim için.
   *
   * Fizik gövdeleri yok: yalnız GÜNCEL görevin paleti gövde. Gerisi rafın
   * derinliğinde duruyor ve sırası gelince gözün önüne geçiyor.
   */
  get bekleyenPaletler(): Array<{ task: Task; x: number; y: number }> {
    const gorevler = this.bolum.gorevler;
    const i = this.loadSpec ? gorevler.indexOf(this.loadSpec as ForkliftGorevi) : -1;
    if (i < 0) return [];
    const liste: Array<{ task: Task; x: number; y: number }> = [];
    for (const g of gorevler.slice(i + 1)) {
      if (g.kaynak.tur !== 'raf') continue;
      const kot = adresKotu(this.bolum, g.kaynak.adres);
      const on = adresX(this.bolum, g.kaynak.adres);
      if (kot === undefined || on === undefined) continue;
      liste.push({
        task: g, x: on + g.halfWidth + 0.06, y: kot + PALET_AYAK + g.halfHeight,
      });
    }
    return liste;
  }

  /** Forklift bölümü — depo. Hedefler raf katları. */
  get gorevler(): readonly Task[] { return this.bolum.gorevler; }
  /**
   * Ölçülen tur: görev başına 25–90 s.
   *
   * Eşik 22/70'ten 30/95'e çıktı ve sebebi bölümün kendisi: depo tek rafken
   * her görev 7 metrelik bir şeritte geçiyordu, şimdi üç adaya yayılmış
   * durumda ve en uzun tur 18 metre gidip 18 metre dönüyor. Eski eşikle
   * başsız rig iki görevde sıfır hız bonusu alıyordu — yani puan artık
   * sürüşün kalitesini değil, sadece mesafeyi ölçüyordu.
   */
  get hizEsikleri(): { tam: number; sifir: number } { return this.bolum.hizEsikleri; }
  /**
   * Görevin forkliftteki hâli: nereden, nereye.
   *
   * `Mission` görevleri ortak `Task` olarak tanıyor; bu sahne yalnız kendi
   * bölümünün görevlerini alıyor, dolayısıyla elindeki her `Task` aslında bir
   * `ForkliftGorevi`. Yine de alanlar eksikse (eski veri, başka bir çağıran)
   * birinci bölümün yolunu varsayıyor: konveyörden `hedef` adresine.
   */
  private gorev(t: Task): ForkliftGorevi {
    const g = t as Partial<ForkliftGorevi> & Task;
    return {
      ...t,
      kaynak: g.kaynak ?? { tur: 'konveyor' },
      varis: g.varis ?? { tur: 'raf', adres: t.hedef },
    };
  }

  hedefNoktasi(t: Task): { x: number; y: number } | null {
    const v = this.gorev(t).varis;
    if (v.tur === 'raf') {
      const kot = adresKotu(this.bolum, v.adres);
      const on = adresX(this.bolum, v.adres);
      if (kot === undefined || on === undefined) return null;
      // **Adanın ORTASI değil, ÖN KENARI.** Paleti dibine kadar sokmak çatalı
      // bir buçuk metre rafın içine sokmak demek; geri çekilirken bıçak kirişe
      // takılıyor ve makine şahlanıyordu. Sahada da palet gözün ön kenarına
      // konur — çatal ancak paletin boyu kadar içeri girer.
      // Palet rafa AYAKLARIYLA oturuyor: tabanı kirişin `PALET_AYAK` üstünde.
      // Zemin gözünde kot 0, yani palet doğrudan betona oturuyor — formül aynı.
      return { x: on + t.halfWidth + 0.06, y: kot + PALET_AYAK };
    }
    if (v.tur === 'dorse') {
      const x = this.dorseHedefX(t, v.sira);
      // Dorse tabanı zeminle aynı kotta: palet ayaklarıyla tabana oturuyor.
      return x === undefined ? null : { x, y: PALET_AYAK };
    }
    // Konveyör bir varış noktası değil, yalnız kaynak.
    return null;
  }

  /**
   * Dorse sırasının hedefi — **bir önceki paletin GERÇEK yerine göre.**
   *
   * Sabit sıralar kötü bir kuralı cezalandırırdı: ilk palet 15 santim geride
   * kalırsa her sonraki palet de 15 santim geride kalmak ZORUNDA (öndeki
   * palet katı ve yolu kapatıyor), ve hata beş palet boyunca birikip son
   * paleti dorseden taşırırdı. Gerçek yüklemede de her palet bir öncekine
   * dayanarak konur. Hedef bu yüzden kayıyor — ama her palet KENDİ
   * komşusuna sıkı oturmak zorunda; ders bu.
   */
  private dorseHedefX(t: Task, sira: number): number | undefined {
    const d = this.bolum.dorse;
    if (!d) return undefined;
    if (sira > 0) {
      const onceki = this.stok.find((s) => {
        const v = this.gorev(s.task).varis;
        return v.tur === 'dorse' && v.sira === sira - 1;
      });
      if (onceki) {
        return onceki.x - onceki.task.halfWidth - DORSE_ARALIGI - t.halfWidth;
      }
    }
    return dorseSiraMerkezi(this.bolum, sira) ?? d.on - DORSE_PAYI - t.halfWidth;
  }

  /**
   * Hedef işareti kirişin ÜSTÜNDE dursun, paletin tabanında değil.
   *
   * **Raftan alınacak palet henüz alınmadıysa işaret ONU gösteriyor.**
   * Birinci bölümde palet hep konveyörde, gözün önündeydi; burada ise
   * dolu bir rafın içinde, stok paletlerin arasında. İşaret her an "şimdi
   * nereye" sorusunun cevabı olmalı: önce palet, sonra dorse.
   */
  /** İşaret şu an paletin KENDİSİNİ mi gösteriyor (henüz alınmadı)? */
  get isaretKaynakta(): boolean {
    const t = this.loadSpec;
    return t !== null && this.gorev(t).kaynak.tur === 'raf' && !this.tasindi;
  }

  isaretNoktasi(t: Task): { x: number; y: number } | null {
    const k = this.gorev(t).kaynak;
    if (k.tur === 'raf' && !this.tasindi && t === this.loadSpec) {
      const kot = adresKotu(this.bolum, k.adres);
      const on = adresX(this.bolum, k.adres);
      if (kot !== undefined && on !== undefined) {
        return { x: on + t.halfWidth + 0.06, y: kot };
      }
    }
    const h = this.hedefNoktasi(t);
    if (!h) return null;
    const v = this.gorev(t).varis;
    const kot = v.tur === 'raf' ? adresKotu(this.bolum, v.adres) ?? 0 : 0;
    return { x: h.x, y: kot };
  }
  /**
   * Gözün içine oturmalı. Vinçteki 2 metrelik pencere burada anlamsız olurdu
   * — teras geniş bir düzlem, raf gözü ise paletten birkaç on santim büyük.
   */
  yerlestirmeToleransi(t: Task): { x: number; y: number } {
    if (this.gorev(t).varis.tur === 'dorse') {
      // Dorsede pencere DAR ve bilerek: hedef zaten bir önceki paletin
      // gerçek yerinden hesaplanıyor, yani bu pay yalnız "komşuna sıkı
      // otur" dersinin toleransı. Gevşek bırakılsa sıkı istif öğretilmezdi.
      return { x: 0.22, y: 0.32 };
    }
    // Yük adanın derinliğine sığmalı: geniş palette hata payı 30 cm'e iniyor.
    return { x: Math.max(0.2, (RAF_DERINLIK - t.halfWidth * 2) / 2), y: 0.32 };
  }
  get sasiHizi(): number { return this.forklift.chassis.getLinearVelocity().x; }
  /** Küçük makine, dar koridor: vinçten belirgin biçimde daha yakın. */
  get kameraOlcegi(): { yakin: number; uzak: number } { return this.bolum.kameraOlcegi; }
  /** Depo kapalı bir mekân: kamera duvarların dışını göstermiyor. */
  get kameraSiniri(): { sol: number; sag: number } {
    return { sol: this.bolum.bati, sag: this.bolum.dogu };
  }
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

  /**
   * Kaldırmayı kilitleyen raf kirişinin kotu — yoksa `null`.
   *
   * **Ölçümle bulundu ve oyunun en sinsi kaza sebebiydi.** Makine bir adanın
   * altındayken (örn. x = 24.2, A adası 23.0–25.6) çatalı kaldırmak kirişe
   * dayanıyor; kriko gibi çalışıp aracı kaldırıyor. Ölçüm: kot 2.29'da her
   * şey normal, 2.69'da eğim 15.1°, arka aks %8 — ve **hiçbir uyarı yok.**
   * Ana gösterge bu sırada %71 "GÜVENLİ" diyor, çünkü yük tablosu doğru:
   * makineyi deviren şey yük değil, RAF.
   *
   * Fizik doğru ve kalıyor; eksik olan şey oyuncuya söylenmesiydi. Kiriş
   * altında kaldırmanın meşru bir hali yok — göze koymak için aynen sahada
   * olduğu gibi önce KORİDORDA kaldırıp sonra içeri sürmek gerekiyor, ipucu
   * da bunu söylüyor. O yüzden uyarı değil, kilit: vinçteki iki-blok
   * kilidinin forklift karşılığı.
   *
   * Kilit YALNIZCA temasın hemen öncesinde devrede (kirişin 25 cm altı),
   * yoksa gözün önünde meşru kaldırmayı da engellerdi. Bant 40 cm iken
   * oyun testinde gözün tam önünde, doğru kotta, indirmeye hazır oyuncuya
   * "önce gözden geri çık" diyordu — yani tam yaptığı şeyi yapmamasını.
   */
  get kirisAltinda(): number | null {
    const f = this.forklift;
    const yuk = this.hasLoad ? this.loadSpec : null;
    // Kirişe ilk dokunacak iki aday: sırtlığın tepesi (taşıyıcıda, dar) ve
    // bıçağın/yükün üstü (çatal boyunca).
    //
    // **Taşınan yükün kutusu BIÇAĞIN ÜSTÜNDE duruyor**, ayakları bıçağın iki
    // yanından aşağı sarkıyor. Burada bir ara `PALET_AYAK` yazıyordu ve yük
    // 30 santim yüksek sanılıyordu: raftan alan oyuncu, paleti kirişten
    // daha 13 santim kaldırmışken "kiriş altında, kaldırma kilitli" uyarısı
    // alıyordu — üstteki kirişle arasında gerçekte 55 santim varken.
    const topuk = f.forkWorld.x;
    const adaylar: Array<{ x0: number; x1: number; ust: number }> = [
      { x0: topuk - 0.1, x1: topuk + 0.1, ust: f.liftM + FORKLIFT.sirtlikM },
      yuk
        ? { x0: topuk, x1: topuk + yuk.halfWidth * 2,
            ust: f.liftM + FORKLIFT.bicakKalinligiM + yuk.halfHeight * 2 }
        : { x0: topuk, x1: f.forkTip.x, ust: f.liftM + FORKLIFT.bicakKalinligiM },
    ];
    for (const on of this.bolum.adaX) {
      const arka = on + RAF_DERINLIK;
      for (const kot of this.bolum.katlar) {
        if (kot <= 0.001) continue;
        const alt = kot - 0.16;
        for (const a of adaylar) {
          if (a.x1 < on || a.x0 > arka) continue;
          if (a.ust > alt - KILIT_BANDI && a.ust <= alt) return kot;
        }
      }
    }
    return null;
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
      // **Sıradaki palet rafta bekliyorsa o da kadraja giriyor.** Rampa
      // bölümünde makine dorseden 26 metre geri dönüyor ve palet ekranın
      // dışında kalıyordu: oyuncu işareti değil yalnız ipucu satırını
      // görüyordu. Taşırken hedefi zaten `main.ts` ekliyor.
      ...(this.isaretKaynakta && !this.hasLoad ? [{
        x: this.load.getPosition().x,
        y: this.load.getPosition().y + (this.loadSpec?.halfHeight ?? 0.5) + 0.6,
      }] : []),
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
    // Kaldırma iki sebeple kilitlenebiliyor: aşırı yük (tablo) ve raf kirişi
    // (geometri). İkisi de aynı kanaldan geçiyor; hangisi olduğunu `uyari()`
    // ayırt ediyor.
    this.forklift.update(
      { lift: input.crane.luff, tilt: input.crane.telescope },
      dt, this.olcum.blockRadiusIncrease || this.kirisAltinda !== null,
      this.grabbables,
    );

    this.teslimiYurut();

    this.world.step(dt, SIM.velocityIterations, SIM.positionIterations);
    this.world.clearForces();

    if (this.forklift.hasLoad) this.tasindi = true;

    // Ölçüm: çatalda ne varsa onun ağırlığı.
    const ham = this.forklift.yukTonu;
    this.olcumTon += (ham - this.olcumTon) * Math.min(1, dt / 0.2);
  }

  /** Yükleme karesine palet indirme akışı; raftaki paleti gözün önüne alma. */
  private teslimiYurut(): void {
    const spec = this.loadSpec;
    if (!spec || this.teslim === 'hazir') return;
    if (this.teslim === 'rafta') {
      const p = this.load.getPosition();
      if (this.rafaUlasir(p.x - spec.halfWidth)) this.raftanCikar(spec);
      return;
    }
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
    this.load.setTransform({ x: this.bolum.malKabul?.x ?? this.load.getPosition().x,
      y: yerKotu }, 0);
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
   * (bkz. `MalKabul.beklemeCizgisi`). Oyuncunun göremediği bir kural, kural değil.
   */
  private teslimKapisi(): number {
    return this.bolum.malKabul?.beklemeCizgisi ?? Number.NEGATIVE_INFINITY;
  }

  /** Palet yere indi mi? HUD ve rig bunu soruyor. */
  get paletHazir(): boolean { return this.teslim === 'hazir'; }

  /** Bu palet bir kez olsun çatala bindi mi? */
  private tasindi = false;

  /**
   * Yerleştirme, paletin ÇATALA BİNMİŞ olmasını şart koşuyor.
   *
   * Zemin gözünün kirişi yok, dolayısıyla paleti önüne katıp itmek onu
   * gözün içine sokmaya yetiyordu: oyun testinde bölümün ilk görevi, hiç
   * `W`'ye basılmadan, sadece gaza basılarak 21 saniyede bitirildi. Tam
   * Tur'un ilk görevi böylece bedavaydı.
   */
  yerlesebilir(): boolean { return this.tasindi; }

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

    const kiris = this.kirisAltinda;
    if (kiris !== null) {
      return {
        zone: 'red', carpiyor: kilitli,
        bas: u.kirisBas,
        govde: u.kirisGovde(kiris.toFixed(2), this.forklift.liftM.toFixed(2)),
        cozum: u.kirisCozum,
      };
    }
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
    const kaynak = this.loadSpec ? this.gorev(this.loadSpec).kaynak : null;
    const kaynakAdi = kaynak?.tur === 'raf' ? katAdi(this.bolum, kaynak.adres) : null;
    if (this.teslim === 'rafta' && kaynakAdi) {
      return { metin: i.rafta(kaynakAdi), mod: 'drive' };
    }
    if (!this.paletHazir) {
      return {
        metin: this.teslim === 'iniyor' ? i.teslimIniyor : i.teslimBekle,
        mod: 'drive',
      };
    }
    const durum = this.forklift.durum(this.grabbables);
    const k = kumandaAdi();
    const dorseye = this.loadSpec !== null
      && this.gorev(this.loadSpec).varis.tur === 'dorse';
    const say: Record<typeof durum, string> = {
      yuklu: dorseye ? i.yukluDorse : i.yuklu, hazir: i.hazir(k), sig: i.sig, yuksek: i.yuksek(k),
      alcak: i.alcak(k), yanas: i.yanas, kot: i.kot(k),
      // Konveyörün cümlesi raftaki palet için yalan olurdu.
      uzak: kaynakAdi ? i.uzakRaf(kaynakAdi) : i.uzak,
    };
    let metin = say[durum];
    const t = this.loadSpec;
    const hedef = t ? this.hedefNoktasi(t) : null;

    if (t && hedef && this.hasLoad) {
      // **Hedefin nerede olduğunu SÖYLE.** Depo üç adaya yayılınca satır tek
      // başına yetmez oldu: oyun testinde üç rafın da önünden geçip deponun
      // doğu ucuna çıkan oyuncuya HUD 24 adım boyunca aynı cümleyi tekrarladı
      // ("gözün önüne gel, kaldır…"), hedefin arkada kaldığını söylemedi.
      // Vinç bölümü bunu zaten yapıyor; satırı aynı yerden alıyoruz.
      // **Ölçülen şey YÜKÜN kendisi, çatalın ucu değil.**
      //
      // Oyun testi bunu tam sayıyla yakaladı: ipucu çatal ucunu, `Mission`
      // ise yükün merkezini ölçüyordu. Bıçak dibine kadar girdiğinde yük
      // merkezi çatal ucunun (1.35 − yarıEn) kadar gerisinde kalıyor,
      // kabul penceresi ise (1.30 − yarıEn); aradaki fark HER GÖREVDE
      // sabit 5 santim ve pencerenin DIŞINDA. Yani ipucuna harfiyen uyan
      // oyuncu paleti hep gözün 5 santim batısına bırakıyordu — en dar
      // toleranslı iki görevde (D3 0.42 m, D4 0.35 m) hiç yerleşmiyordu.
      const yukYeri = this.load.getPosition();
      const yon = tasimaSatiri(
        { x: yukYeri.x, y: yukYeri.y - t.halfHeight },
        hedef, this.yerlestirmeToleransi(t),
      );
      if (yon) metin = `${metin} · ${yon}`;
    } else if (t && hedef && this.kacirildi(t, hedef)) {
      // **Işıksız bir hata olmasın.** Palet gözün yanına düştüğünde oyun hiçbir
      // şey söylemiyordu: HUD sessizce alma ipucuna dönüyordu ve oyuncu neyi
      // yanlış yaptığını hiç öğrenemiyordu.
      metin = `${dorseye ? i.kacirdiDorse : i.kacirdi} · ${metin}`;
    }

    return {
      metin,
      mod: durum === 'hazir' ? 'ready' : durum === 'yuklu' ? 'crane' : 'drive',
    };
  }

  /**
   * Palet yükleme karesinden çıkmış ama gözüne de girmemiş mi?
   *
   * Ölçüm: paletin yükleme karesinin doğusunda olması (yani oyuncu onu bir
   * kez taşımış) ve hedef pencerenin dışında durması.
   */
  private kacirildi(t: Task, hedef: { x: number; y: number }): boolean {
    // Ölçüm: palet bir kez çatala binmiş (yani oyuncu onu taşıdı), şimdi
    // çatalda değil ve hedef pencerenin dışında duruyor. Eskiden "palet
    // yükleme karesinden çıktı mı" diye bakılıyordu; o yalnız konveyörden
    // gelen paletler için anlamlıydı, raftan alınan palet için değil.
    if (this.hasLoad || !this.paletHazir || !this.tasindi) return false;
    const p = this.load.getPosition();
    const tol = this.yerlestirmeToleransi(t);
    return Math.abs(p.x - hedef.x) > tol.x
      || Math.abs(p.y - (hedef.y + t.halfHeight)) > tol.y;
  }


  reset(): void { this.forklift.reset(); }
}

export { FORKLIFT_NEUTRAL, RAF_DERINLIK };
