/**
 * Başsız (headless) sahne sürücüsü — `npm run sahne`.
 *
 * Bu projede her fizik kararı ölçümle alındı; göz kararı defalarca yanlış
 * teşhis koydurdu (tork sanılan mafsal esnemesi, bom boyu sanılan LMI kilidi,
 * hız sanılan uyku kipi, kütle sanılan çağrı sırası). Tarayıcı açmadan aynı
 * `Scene`'i sürüp sayıları yazdırmak o teşhisleri saniyeler içinde yapıyor.
 *
 * Şimdi bölümün TAMAMINI oynuyor: sür, ayakları aç, dört yükü sırayla al ve
 * terasına koy. Dördü de konmazsa sıfırdan farklı kodla çıkıyor.
 */
import { Scene, IDLE, type SceneInput } from '../src/sim/scene';
import { SIM, factoryTerraces, FACTORY } from '../src/sim/world';
import { CRANE } from '../src/sim/crane';
import { capacityAt, OutriggerState } from '../src/sim/loadChart';
import { Mission } from '../src/game/mission';
import { TASKS } from '../src/game/tasks';

const DT = 1 / SIM.hz;

/** Oyuncunun yerine geçen basit servo: hedefe doğru bang-bang komut üretir. */
function toward(current: number, target: number, deadband: number): number {
  const e = target - current;
  if (Math.abs(e) <= deadband) return 0;
  return e > 0 ? 1 : -1;
}

class Rig {
  readonly scene = new Scene();
  readonly mission = new Mission(this.scene);
  t = 0;

  /** En yüksek LMI'nin nerede olduğunu da tutuyoruz — zirveyi bulmak için. */
  zirve = { lmi: 0, t: 0, etiket: '', R: 0, ton: 0, halat: 0 };
  /**
   * Arka pabucun toplam pabuç yükündeki EN DÜŞÜK payı ve o andaki LMI.
   *
   * Forklift riginde devrilme payı arka aksla ölçülüyor; vinçte karşılığı bu.
   * Gösterge yapmadan önce sorulacak soru: bu sayı gerçek yük altında
   * KIPIRDIYOR mu? Kıpırdamıyorsa okunacak bir şey yok demektir.
   */
  pabuc = { enAz: 1, lmi: 0, etiket: '', enCok: 0 };
  etiket = 'baslangic';

  /** Koşul sağlanana kadar sür; en fazla maxSec. Sağlandı mı döner. */
  runUntil(maxSec: number, done: (r: Rig) => boolean, input: (r: Rig) => Partial<SceneInput>): boolean {
    const steps = Math.round(maxSec / DT);
    for (let i = 0; i < steps; i++) {
      if (done(this)) return true;
      this.run(DT, input);
    }
    return done(this);
  }

  run(seconds: number, input: (r: Rig) => Partial<SceneInput>): void {
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i++) {
      this.scene.step({ ...IDLE, ...input(this) }, DT);
      this.mission.update(DT);
      this.t += DT;
      const pay = this.scene.outriggers.arkaPabucPayi;
      if (pay !== null) {
        if (pay < this.pabuc.enAz) {
          this.pabuc = { ...this.pabuc, enAz: pay, lmi: this.scene.crane.lmi.percent,
            etiket: this.etiket };
        }
        if (pay > this.pabuc.enCok) this.pabuc.enCok = pay;
      }
      const l = this.scene.crane.lmi;
      if (Number.isFinite(l.percent) && l.percent > this.zirve.lmi) {
        this.zirve = {
          lmi: l.percent, t: this.t, etiket: this.etiket,
          R: l.radiusM, ton: l.loadTonnes, halat: this.scene.crane.ropeM,
        };
      }
    }
  }

  tap(key: 'toggleOutriggers' | 'toggleHook', settle: number): void {
    this.scene.step({ ...IDLE, [key]: true }, DT);
    this.mission.update(DT);
    this.t += DT;
    this.run(settle, () => ({}));
  }

  /**
   * Bom ucunu (tx, ty) noktasına götüren açı ve boyu ANALİTİK çözer.
   *
   * Bom ucunun x'ini kovalamak işe yaramadı: teleskopu açmak ve bomu indirmek
   * ucu aynı yöne götürüyor ama yüksekliği zıt yönde değiştiriyor, dolayısıyla
   * tek eksenli bir kovalama kendi kuyruğunu yakalıyor. Hedef uç konumundan
   * L = |Δ| ve θ = atan2 doğrudan çıkıyor; iki ekseni de hedefine sürmek hem
   * kararlı hem de gerçek operatörün kafasındaki resim.
   */
  boomTo(tx: number, ty: number): { luff: number; telescope: number } {
    const pivot = this.scene.truck.chassis.getWorldPoint(CRANE.pivot);
    const dx = tx - pivot.x;
    const dy = ty - pivot.y;
    const L = Math.min(Math.max(Math.hypot(dx, dy), CRANE.boomBaseLengthM),
                       CRANE.boomBaseLengthM + CRANE.maxExtensionM);
    const th = Math.min(Math.max((Math.atan2(dy, dx) * 180) / Math.PI,
                                 CRANE.minAngleDeg), CRANE.maxAngleDeg);
    // Komutlar ORANSAL: aç/kapa sürüş hedefin etrafında çatırdıyor ve rijit
    // halat her çatırtıyı yüke darbe olarak geçiriyordu.
    const c = this.scene.crane;
    const band = (e: number, k: number): number => Math.max(-1, Math.min(1, e / k));
    return {
      luff: band(th - c.angleDeg, 3.0),
      telescope: band(L - c.lengthM, 0.8),
    };
  }

  /**
   * Aynı servo, ama kanca ucun altından kaçtıkça yavaşlıyor.
   *
   * Bom tam hızda toplanınca sarkaç geride kalıyor ve kanca en yakın terasa
   * düşüyor; beş katlı binada bu her dönüşte oluyordu (rijit halat 2 metreyken
   * kanca uçtan 11.5 metre uzakta kalıp 4. kat terasına oturdu). Gerçek
   * operatör de kancayı savurarak bom toplamaz.
   */
  boomToDamped(tx: number, ty: number): { luff: number; telescope: number } {
    const c = this.scene.crane;
    const kayma = Math.hypot(
      c.hook.getPosition().x - c.tipWorld.x,
      c.tipWorld.y - c.hook.getPosition().y - c.ropeM,
    );
    const kazanc = Math.max(0.10, Math.min(1, 1 - kayma / 1.2));
    const b = this.boomTo(tx, ty);
    return { luff: b.luff * kazanc, telescope: b.telescope * kazanc };
  }
}

const out: string[] = [];
const say = (s: string): void => { out.push(s); };

function durum(r: Rig, tag: string): void {
  const c = r.scene.crane;
  const l = r.scene.load.getPosition();
  say(`${tag.padEnd(8)} bom ${c.lengthM.toFixed(1)}m/${c.angleDeg.toFixed(0)}° R${c.radiusM.toFixed(1)}m`
    + `  yuk ${l.x.toFixed(2)},${l.y.toFixed(2)}`
    + `  LMI %${Math.min(999, c.lmi.percent).toFixed(0)}`
    + `  egim ${r.scene.tiltDeg.toFixed(2)}°`);
}

function main(): void {
  const r = new Rig();

  // 1) Takoza dayanana kadar sür, sonra ayakları aç.
  r.run(20, (rig) => ({ drive: { throttle: rig.scene.truck.speedKmh < 26 ? 1 : 0, handbrake: false } }));
  r.run(3, () => ({ drive: { throttle: 0, handbrake: true } }));
  // Ayaklar artık KADEMELİ: Q bir kademe ilerletiyor, tam açık için iki basış.
  r.tap('toggleOutriggers', 3);
  r.tap('toggleOutriggers', 6);
  say(`PARK+AYAK  ayak %${(r.scene.outriggers.fraction * 100).toFixed(0)}`
    + ` (${r.scene.outriggers.state})`
    + `  egim ${r.scene.tiltDeg.toFixed(2)}°`);

  // --- çalışma zarfı: park edilen yerden neye ulaşılıyor? ---
  const pivot = r.scene.truck.chassis.getWorldPoint(CRANE.pivot);
  say('--- calisma zarfi ---');
  factoryTerraces().forEach((t, i) => {
    const R = CRANE.pivotOffsetM + (t.x - pivot.x);
    const cap = capacityAt(R, OutriggerState.Full);
    const detay = TASKS.filter((g) => g.hedef === i)
      .map((g) => `${g.kod} %${(((g.tonnes + CRANE.hookTonnes) / cap) * 100).toFixed(0)}`)
      .join(' ');
    say(`  hedef${i}  x ${t.x.toFixed(1)} y ${t.y.toFixed(1)}  R ${R.toFixed(1)}m`
      + `  kap ${cap.toFixed(2)}t   ${detay || '(görev yok)'}`);
  });

  // 2) Dört görevi sırayla oyna.
  for (let n = 0; n < TASKS.length; n++) {
    const task = r.mission.task;
    const hedef = r.mission.target;
    if (!task || !hedef) break;
    const loadX = r.scene.load.getPosition().x;
    // Kancayı yükün üstünde SERBEST tut, üstüne oturtma: bir kez değince
    // sürtünme onu yanda kilitliyor ve halat eğik kalıyor.
    const asili = task.halfHeight * 2 + 1.15;

    const iz = (etiket: string): void => {
      if (!process.env['IZ']) return;
      const c = r.scene.crane;
      const l = r.scene.load.getPosition();
      say(`   iz ${etiket.padEnd(10)} bom ${c.lengthM.toFixed(1)}/${c.angleDeg.toFixed(0)}°`
        + ` uc ${c.tipWorld.x.toFixed(1)},${c.tipWorld.y.toFixed(1)} halat ${c.ropeM.toFixed(1)}`
        + ` kanca ${c.hook.getPosition().x.toFixed(1)},${c.hook.getPosition().y.toFixed(1)}`
        + ` yuk ${l.x.toFixed(2)},${l.y.toFixed(2)} bagli ${c.hasLoad ? 'E' : 'H'}`
        + ` salinim ${r.scene.salinimDeg().toFixed(0)}°`
        + ` LMI %${Math.min(999, c.lmi.percent).toFixed(0)}`);
    };

    // --- ALMA: bom ucunu yükün üstüne, kancayı serbest indir ---
    const almaUcY = () => r.scene.truck.chassis.getWorldPoint(CRANE.pivot).y + 5.5;
    iz('alma-basi');
    // **Önce kancayı topla, sonra bomu çevir.**
    //
    // Bir önceki yükü terasa bıraktıktan sonra kanca aşağıda kalıyor; bom
    // malzeme alanına dönerken kanca terasın üstünden sürtünerek geçip oraya
    // oturuyordu. Sonra 21 metre halat salındığı halde kanca kıpırdamıyor,
    // teras kenarına kayıyor ve alma "yan-cekme" ile reddediliyordu. Gerçek
    // operatör de yükü bırakır bırakmaz kancayı kafaya toplar.
    r.run(20, () => ({ crane: { uzat: 0, luff: 0, telescope: 0, winch: 1 } }));
    iz('kanca-toplandi');
    // **Önce binanın üstüne çık, sonra in.**
    //
    // Doğrudan malzeme alanına dönmek beş katlı binada çalışmıyor: bom
    // toplanırken uç aşağı iniyor, kanca 4. kat terasına değiyor ve teras
    // korkuluğunun (0.9 m) arkasında sıkışıyor. Halat rijit olduğu için
    // kısıt 11 metre ihlal ediliyor ama kanca korkuluğu aşamıyor — fizik
    // doğru, hamle yanlış. Operatör de yükü bıraktıktan sonra bomu dikleştirip
    // binanın üstünden döner.
    /**
     * Verilen x'te binanın yüksekliği. Kademeler iç içe: f. kademe
     * `left + setback*f` ten sağa doğru uzanıyor ve tepesi `floorHeight*(f+1)`.
     */
    const binaYuksekligi = (x: number): number => {
      let h = 0;
      for (let f = 0; f < FACTORY.floors; f++) {
        if (x >= FACTORY.left + FACTORY.setback * f) h = FACTORY.floorHeight * (f + 1);
      }
      return h;
    };
    // Kancanın aşması gereken kot: bulunduğu yerdeki bina + korkuluk + pay.
    // Kademeler sola doğru alçaldığı için malzeme alanına dönerken en yüksek
    // engel kancanın ŞU ANKİ x'i oluyor.
    const engelY = binaYuksekligi(r.scene.crane.hook.getPosition().x)
      + FACTORY.parapetHeight + 1.2;
    const temizY = engelY + 3.0;
    // **Bom hareket ederken halatı koru.** Teleskop açmak halat yiyor (gerçek
    // vinçte de öyle), o yüzden vinci boşta bırakmak iki-bloğa dayandırıyor.
    const halatKoru = (rig: Rig, hedefHalat: number): number =>
      Math.max(-1, Math.min(1, (rig.scene.crane.ropeM - hedefHalat) / 1.0));
    // **Dönüş boyunca halat KISA kalır.** 5 metreye salmak kancayı bom ucunun
    // 5 metre altına indiriyor ve o kot tam da 1. kat korkuluğunun (4.7 m)
    // hizası — kanca korkuluğa tünüyor, sonra 18 metre halat salınsa bile
    // kıpırdamıyordu. 3 metre ile kanca ucun hemen altında ve her şeyin
    // üstünde kalıyor.
    const DONUS_HALATI = 3.0;
    // Bu hamle SADECE kanca teraslar arasındayken gerekli — takılacağı bir şey
    // varsa. Ölçüt bom ucunun x'i DEĞİL: yol konumundaki bom zaten cephe
    // hizasında bitiyor ve koşul boş yere sağlanıyordu; ilk görevde bom
    // 11°'den 66°'ye çıkıp geri inince sarkaç 40 dereceye savruluyordu.
    // Kanca zaten engelin üstündeyse tırmanmaya gerek yok. Sabit "çatıyı aş"
    // kuralı 22 metreye çıkıp geri iniyordu ve o sweep sarkacı 40 dereceye
    // savuruyordu — üstelik aşılacak engel 3.8 metredeydi.
    if (r.scene.crane.hook.getPosition().y < engelY) {
    r.runUntil(60,
      (rig) => rig.scene.crane.tipWorld.y > temizY - 0.6
        && Math.abs(rig.scene.crane.tipWorld.x - loadX) < 1.5,
      (rig) => ({ crane: { uzat: 0,
        ...rig.boomToDamped(loadX, temizY), winch: halatKoru(rig, DONUS_HALATI),
      } }));
    iz('bom-yukseldi');
    }
    r.runUntil(60,
      (rig) => Math.abs(rig.scene.crane.tipWorld.x - loadX) < 0.12
        && rig.scene.crane.tipWorld.y < almaUcY() + 1.0,
      (rig) => ({ crane: { uzat: 0,
        ...rig.boomToDamped(loadX, almaUcY()), winch: halatKoru(rig, DONUS_HALATI),
      } }));
    iz('bom-dondu');
    // **İndirmeden önce kancanın ucun altına gelmesini bekle.**
    //
    // Bom dönerken kanca geride kalıyor; hemen halat salınca kanca binanın
    // üstündeyken iniyor ve terasa oturuyordu (ölçümde 18 metre halat salındı,
    // kanca 90 santim indi — çünkü 1. kat terasındaydı).
    r.runUntil(30,
      (rig) => Math.abs(rig.scene.crane.hook.getPosition().x - rig.scene.crane.tipWorld.x) < 0.4,
      (rig) => ({ crane: { uzat: 0, luff: 0, telescope: 0, winch: halatKoru(rig, DONUS_HALATI) } }));
    iz('kanca-oturdu');
    r.run(26, (rig) => ({ crane: { uzat: 0,
      ...rig.boomToDamped(loadX, almaUcY()),
      winch: toward(rig.scene.crane.hook.getPosition().y, asili, 0.05),
    } }));
    iz('kanca-indi');
    r.run(18, () => ({}));
    iz('indi');
    r.etiket = `${task.kod}-kalkis`;
    const kapi = r.scene.crane.attachCheck(r.scene.grabbables).reason;
    r.tap('toggleHook', 1.0);
    say(`${task.kod} AL    kapi ${kapi}  bagli ${r.scene.crane.hasLoad ? 'E' : 'H'}`
      + `  merkez farki ${Math.abs(loadX - r.scene.crane.hook.getPosition().x).toFixed(2)} m`);

    // --- TAŞIMA: bom ucunu hedefin üstüne, yükü korkuluğu aşacak kotta tut ---
    //
    // Uç, hedefin yükseklik + 3.5 m üstüne gidiyor; böylece halat hiç dibe
    // vurmuyor ve yükü düşeyde vinç yönetiyor. Bom indirilirken vinç toplanmazsa
    // yük binanın cephesine dayanıp kalıyor — ölçümde tam olarak bu oldu.
    r.etiket = `${task.kod}-tasima`;
    // Bom ucunu, halat rahat bir boyda kalacak şekilde seçiyoruz. Uç alçak
    // kalınca vinç dibe vuruyor, yük bom ucuna rijit bağlanıyor ve bomun her
    // ivmesi kuvvet zirvesine dönüşüyordu (ölçümde %286, 13.7 t).
    // Taşıma yüksekliğini BOM UCU belirliyor, vinç değil: vinci mutlak bir
    // yüksekliğe sürmek halatı dibe vurduruyordu ve oradan bir kilitlenme
    // çıkıyordu — halat kısaldıkça sarkaç kısalıyor, 20 santimlik bir kayma
    // 10 dereceye denk geliyor, salınım kapısı kapanıp bomu durduruyor, bom
    // durunca uç yükselmiyor ve halat kısa kalıyor. Vinç artık sadece halat
    // boyunu 4 metrede tutuyor.
    // Çalışma halatı 4 metre, ama uç o yüksekliğe çıkamıyorsa halatı kısaltmak
    // gerekiyor: üst teraslarda bomun 30 metrelik sınırı bağlayıcı oluyor ve
    // ulaşılamaz bir uç yüksekliği istemek rigi sonsuza kadar bekletiyordu.
    const tasimaY = hedef.y + task.halfHeight + 1.8;
    const istenenUc = tasimaY + task.halfHeight + CRANE.hookThroatM + 4.0;
    const pivotN = r.scene.truck.chassis.getWorldPoint(CRANE.pivot);
    const dxN = hedef.x - pivotN.x;
    const enUstUc = pivotN.y + Math.sqrt(Math.max(
      (CRANE.boomBaseLengthM + CRANE.maxExtensionM) ** 2 - dxN ** 2, 0));
    const ucY = Math.min(istenenUc, enUstUc - 0.4);
    const calismaHalati = Math.max(CRANE.minRopeM + 0.3,
      ucY - (tasimaY + task.halfHeight + CRANE.hookThroatM));
    // Bom hedefe OTURANA KADAR sür — sabit süre yetmiyordu: salınım kapısı
    // bomu sık sık durdurduğu için 80 saniyede yol yarıda kalıyor, yük de bir
    // alt terasa bırakılıyordu.
    const vardi = r.runUntil(240,
      (rig) => Math.abs(rig.scene.crane.tipWorld.x - hedef.x) < 0.15
        && Math.abs(rig.scene.crane.tipWorld.y - ucY) < 0.3,
      (rig) => {
        // **Salınıma göre ORANSAL yavaşla, durma.**
        //
        // Açık/kapalı kapı iki kez kilitlendi: bom durunca salınım sönene kadar
        // hiçbir şey ilerlemiyor, ama bom hareket halindeyken kancanın yarım
        // metre geride kalması zaten normal — yani kapı bir daha hiç açılmıyordu.
        // Kumanda kolu analog (luff/telescope sayı, sadece ±1 değil), o yüzden
        // kazancı sürekli kısmak hem mümkün hem de operatörün yaptığı şey.
        const c = rig.scene.crane;
        const kayma = Math.abs(c.hook.getPosition().x - c.tipWorld.x);
        const kazanc = Math.max(0.10, Math.min(1, 1 - kayma / 1.2));
        const b = rig.boomTo(hedef.x, ucY);
        void c;
        return { crane: { uzat: 0,
          luff: b.luff * kazanc,
          telescope: b.telescope * kazanc,
          winch: Math.max(-1, Math.min(1, (rig.scene.crane.ropeM - calismaHalati) / 1.0)),
        } };
      });
    iz(vardi ? 'vardi' : 'VARAMADI');
    r.run(14, () => ({}));

    // --- KOYMA: usulca indir, sonra bırak ---
    r.run(22, (rig) => ({ crane: { uzat: 0,
      luff: 0, telescope: 0,
      winch: toward(rig.scene.load.getPosition().y, hedef.y + task.halfHeight + 0.06, 0.04),
    } }));
    r.run(4, () => ({}));
    iz('kondu');
    r.tap('toggleHook', 3.0);
    durum(r, `${task.kod} KOY`);
    const ok = r.mission.sonTamamlanan;
    if (ok && ok.sira === r.mission.score.sapmalar.length) {
      say(`         ONAY PANELI: ${ok.kod} ${ok.ad} · sapma ${ok.sapmaCm.toFixed(0)} cm`
        + ` · maxLMI %${ok.maxLmi.toFixed(0)} · sure ${ok.sure.toFixed(0)}s · kalan ${ok.kalan}`);
    }
    const s = r.mission.score;
    say(`         tamamlanan ${s.sapmalar.length}/${TASKS.length}`
      + `  sapma ${(s.sapmalar[s.sapmalar.length - 1] ?? NaN).toFixed(2)} m`
      + `  maxLMI %${s.maxLmi.toFixed(0)}  kirmizi ${s.kirmiziSn.toFixed(1)}s`
      + `  salinim ${s.maxSalinim.toFixed(0)}°  carpma ${s.carpma}`);
  }

  const res = r.mission.result;
  const s = r.mission.score;
  say('--- sonuc ---');
  say(`  LMI zirvesi %${r.zirve.lmi.toFixed(0)} · ${r.zirve.etiket} · t=${r.zirve.t.toFixed(0)}s`
    + `  R ${r.zirve.R.toFixed(1)}m  kuvvet ${r.zirve.ton.toFixed(2)}t  halat ${r.zirve.halat.toFixed(1)}m`);
  say(`  arka pabuc payi: en az %${(r.pabuc.enAz * 100).toFixed(1)}`
    + `  en cok %${(r.pabuc.enCok * 100).toFixed(1)}`
    + `  (en az iken LMI %${Number.isFinite(r.pabuc.lmi) ? r.pabuc.lmi.toFixed(0) : '—'}`
    + ` · ${r.pabuc.etiket})`);
  say(`  faz ${r.mission.phase}  tamamlanan ${s.sapmalar.length}/${TASKS.length}`
    + `  sure ${s.sure.toFixed(0)}s  not ${res?.not ?? '-'} (${res?.puan.toFixed(0) ?? '-'})`
    + `  usta ${res?.usta ? 'E' : 'H'}`);

  console.log(out.join('\n'));
  if (s.sapmalar.length < TASKS.length) {
    throw new Error(`bölüm tamamlanamadı: ${s.sapmalar.length}/${TASKS.length} görev`);
  }
}

// Hata olursa node zaten yığın izini basıp sıfırdan farklı kodla çıkar.
main();
