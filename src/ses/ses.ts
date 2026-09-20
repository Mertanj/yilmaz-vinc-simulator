import { oku, yaz } from '../ui/kayit';

/**
 * Oyunun ses katmanı — tamamı SENTEZ, tek bir ses dosyası yok.
 *
 * **Neden sentez:** oyunun geri kalanı da prosedürel (bütün çizim vektör,
 * tek bir PNG yok) ve aynı kararı sürdürmek burada bedava değil, KÂRLI:
 * motor sesinin devri gaza, hidrolik uğultusunun perdesi aktüatör hızına
 * bağlanabiliyor. Kaydedilmiş bir döngü bunu yapamaz, sadece açılıp kapanır.
 * Ayrıca 0 KB indirme ve lisans derdi yok.
 *
 * **Neden hiç yoktu ve neden şimdi var:** oyun testi raporunun "his" bölümünün
 * tamamı buraya çıkıyordu — kodda `AudioContext` araması hiçbir şey bulmuyor.
 * En değerlisi de en ucuzu: yük momenti sarıya/kırmızıya girerken YÜKSELEN bir
 * ton. İnsan bir sesin perdesine, bir yüzdeyi okuyup anlamaktan çok daha hızlı
 * tepki veriyor; rapor da tam bunu söylüyor.
 *
 * **Tarayıcı kuralı:** `AudioContext` ancak bir kullanıcı hareketinden sonra
 * çalışmaya başlıyor. Bu yüzden bağlam TEMBEL kuruluyor ve `ac()` makine seçim
 * kartına basıldığında çağrılıyor — oyuna girmenin zaten tek yolu o.
 *
 * **Sim'e hiç dokunmuyor.** Bu modülü yalnız `main.ts` çağırıyor; `src/sim`
 * altında ses diye bir şey yok. Başsız rigler node'da koşuyor ve orada
 * `AudioContext` yok — ayrım kazayla değil, bu yüzden.
 */

/** Her karede verilen süregelen durum. */
export interface SesDurumu {
  /** Motor gazı, 0–1 (mutlak değer). */
  gaz: number;
  /** En hızlı aktüatörün oranı, 0–1 — hidrolik uğultusunu bu sürüyor. */
  hidrolik: number;
  /** Yük momenti bölgesi; uyarı tonunu bu seçiyor. */
  zone: 'green' | 'amber' | 'red';
}

/** Bir kerelik olaylar. */
export type SesOlayi =
  | 'bagla' | 'birak' | 'carpma' | 'kondu' | 'ayak' | 'ret';

const ANAHTAR = 'yv.ses';

/**
 * Uyarı tonunun bölgeye göre ayarı.
 *
 * Kırmızı hem daha tiz hem daha sık: aciliyet iki eksende birden artıyor,
 * çünkü tek eksende artan bir uyarı (sadece sıklık) gürültülü bir sahnede
 * fark edilmiyor. Sarı bilerek seyrek — sürekli bip çalan bir oyun
 * kapatılıyor, ki o zaman uyarı hiç yok demektir.
 *
 * **Perde bir oktav indi ve dalga yumuşadı.** İlk ayar 620/940 Hz ve kare
 * dalgaydı; sahadan gelen tek cümle *"kaldırırken verilen uyarılar da çok
 * tiz"* idi. Kare dalga tek sayılı harmoniklerin hepsini taşıyor ve 940'ta
 * delici oluyor. Üçgen dalga aynı perdeyi çok daha az harmonikle veriyor;
 * 330/495 ise makinenin kendi gürültüsünün üstünde, ama kulağı tırmalamadan.
 */
const UYARI = {
  amber: { hz: 330, sure: 0.12, arayis: 1.05, ses: 0.15, tip: 'triangle' },
  red: { hz: 495, sure: 0.10, arayis: 0.34, ses: 0.22, tip: 'triangle' },
} as const satisfies Record<string, {
  hz: number; sure: number; arayis: number; ses: number; tip: OscillatorType;
}>;

export class Ses {
  private ctx: AudioContext | null = null;
  private ana: GainNode | null = null;
  private gurultu: AudioBuffer | null = null;

  /** Ateşleme darbelerini üreten LFO — perdesi devri belirliyor. */
  private pulsOsc: OscillatorNode | null = null;
  /** Gövde uğultusu: darbelerin altındaki alçak sinüs. */
  private govdeOsc: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private motorFiltre: BiquadFilterNode | null = null;

  private hidrolikOsc: OscillatorNode | null = null;
  private hidrolikGain: GainNode | null = null;
  private hidrolikFiltre: BiquadFilterNode | null = null;

  /** Bir sonraki uyarı bipine kalan süre (s). */
  private bipSayaci = 0;

  private _kapali: boolean;

  constructor() {
    this._kapali = oku(ANAHTAR) === 'kapali';
  }

  get kapali(): boolean { return this._kapali; }

  /**
   * Sesi aç/kapat ve tercihi sakla.
   *
   * Ana kazanç sıfırlanıyor, bağlam durdurulmuyor: durdurulan bir bağlamı geri
   * açmak yeniden kullanıcı hareketi istiyor ve `M` tuşu bunu sağlamıyor.
   */
  degistir(): boolean {
    this._kapali = !this._kapali;
    yaz(ANAHTAR, this._kapali ? 'kapali' : 'acik');
    this.anaSesiYaz();
    return this._kapali;
  }

  private anaSesiYaz(): void {
    if (!this.ana || !this.ctx) return;
    this.ana.gain.setTargetAtTime(this._kapali ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  /**
   * Bağlamı kurar. Kullanıcı hareketinin İÇİNDEN çağrılmalı.
   *
   * Birden çok kez çağrılması zararsız: zaten kuruluysa yalnız `resume`
   * deneniyor, çünkü sekme arka plana alınıp geri gelince bağlam askıya
   * alınmış olabiliyor.
   */
  ac(): void {
    if (this.ctx) { void this.ctx.resume().catch(() => { /* önemsiz */ }); return; }
    type Pencere = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as Pencere).webkitAudioContext;
    if (!Ctor) return;                       // ses yoksa oyun yine çalışsın
    const ctx = new Ctor();
    this.ctx = ctx;

    const ana = ctx.createGain();
    ana.gain.value = this._kapali ? 0 : 0.9;
    ana.connect(ctx.destination);
    this.ana = ana;

    // Beyaz gürültü bir kez üretiliyor; darbe sesleri bunu kırpıp kullanıyor,
    // motor ise DÖNGÜLÜ çalıyor. İki saniye: yarım saniyelik bir döngünün
    // 2 Hz'lik dikişi ateşleme darbelerinin arasından duyuluyordu.
    const n = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const veri = buf.getChannelData(0);
    for (let i = 0; i < n; i++) veri[i] = Math.random() * 2 - 1;
    this.gurultu = buf;

    this.motoruKur(ctx, ana);
    this.hidrolikKur(ctx, ana);
    void ctx.resume().catch(() => { /* önemsiz */ });
  }

  /**
   * Dizel: ATEŞLEME DARBELERİ, sürekli bir ton değil.
   *
   * İlk hâli iki hafifçe akortsuz testere dalgasıydı ve sahadan gelen cümle
   * *"araç sesi gibi gelmiyor"* idi. Haklı, ve sebebi yapısal: bir dizel
   * sürekli bir perde çalmıyor, saniyede onlarca kez PATLIYOR. Kulağın
   * "motor" diye tanıdığı şey o darbe treninin hızı — perde değil, RİTİM.
   * Sabit bir testere dalgası ne kadar filtrelenirse filtrelensin vızıltı
   * kalıyor.
   *
   * Şimdi: geniş bantlı gürültü alçak geçirenden geçip, ateşleme frekansında
   * bir testere LFO'suyla kapıdan geçiriliyor — her çevrimde sert bir atak,
   * sonra sönüm. Altında gövde uğultusu için alçak bir sinüs var. Gaz hem
   * darbe hızını hem de süzgeci açıyor: rölantide yavaş ve boğuk, yüklenince
   * hızlı ve parlak.
   *
   * Darbe hızı gerçek ateşleme sayısı değil, kulağın "büyük motor" dediği
   * bant: rölantide 13 Hz, tam gazda 39. Gerçek bir 6 silindirli 700 d/d'da
   * saniyede 35 kez ateşliyor ama o hız kulakta ayrı darbeler değil pürüzlü
   * bir perde olarak duyuluyor; oyunda istediğimiz çalışan bir makinenin
   * TANINMASI.
   */
  private motoruKur(ctx: AudioContext, ana: GainNode): void {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(ana);
    this.motorGain = g;

    // Darbe kapısı: DC 0.55, LFO ±0.45 -> 0.10 ile 1.00 arasında salınıyor.
    const kapi = ctx.createGain();
    kapi.gain.value = 0.55;
    kapi.connect(g);
    const puls = ctx.createOscillator();
    puls.type = 'sawtooth';
    puls.frequency.value = 13;
    const derinlik = ctx.createGain();
    derinlik.gain.value = 0.45;
    puls.connect(derinlik);
    derinlik.connect(kapi.gain);
    puls.start();
    this.pulsOsc = puls;

    // Yanma gürültüsü — döngülü beyaz gürültü, alçak geçirenden.
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 300;
    f.Q.value = 1.2;
    f.connect(kapi);
    this.motorFiltre = f;
    const kaynak = ctx.createBufferSource();
    kaynak.buffer = this.gurultu;
    kaynak.loop = true;
    kaynak.connect(f);
    kaynak.start();

    // Gövde: darbelerin altındaki alçak uğultu. Kapının DIŞINDA, çünkü
    // gövde titreşimi ateşlemeler arasında da sürüyor.
    const gov = ctx.createOscillator();
    gov.type = 'sine';
    gov.frequency.value = 42;
    const govG = ctx.createGain();
    govG.gain.value = 0.5;
    gov.connect(govG); govG.connect(g);
    gov.start();
    this.govdeOsc = gov;
  }

  /** Hidrolik: dar bantlı testere — pompanın uğultusu. */
  private hidrolikKur(ctx: AudioContext, ana: GainNode): void {
    const g = ctx.createGain();
    g.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 380;
    f.Q.value = 4.5;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 190;
    o.connect(f); f.connect(g); g.connect(ana);
    o.start();
    this.hidrolikOsc = o; this.hidrolikGain = g; this.hidrolikFiltre = f;
  }

  /**
   * Her RENDER karesinde. Fizik adımında değil: ses sunum katmanı ve sabit
   * adıma bağlanması için hiçbir sebep yok.
   */
  guncelle(d: SesDurumu, dt: number): void {
    const ctx = this.ctx;
    if (!ctx || this._kapali) return;
    const t = ctx.currentTime;
    const yumusat = 0.08;

    // Motor: gazla hem devir hem ses yükseliyor. Rölantide de duyuluyor —
    // sessiz bir kamyon çalışmıyor demektir.
    const gaz = clamp01(d.gaz);
    this.pulsOsc?.frequency.setTargetAtTime(13 + gaz * 26, t, yumusat);
    this.govdeOsc?.frequency.setTargetAtTime(42 + gaz * 30, t, yumusat);
    this.motorFiltre?.frequency.setTargetAtTime(300 + gaz * 620, t, yumusat);
    this.motorGain?.gain.setTargetAtTime(0.10 + gaz * 0.13, t, yumusat);

    // Hidrolik: kol ne kadar açıksa o kadar yüksek ve tiz. Kol boştayken
    // tamamen susuyor, yoksa bütün bölüm boyunca bir uğultu kalıyor.
    const h = clamp01(d.hidrolik);
    this.hidrolikOsc?.frequency.setTargetAtTime(140 + h * 110, t, yumusat);
    this.hidrolikFiltre?.frequency.setTargetAtTime(380 + h * 260, t, yumusat);
    this.hidrolikGain?.gain.setTargetAtTime(h < 0.02 ? 0 : 0.012 + h * 0.05, t, yumusat);

    // Uyarı bipi — raporun en çok istediği şey.
    if (d.zone === 'green') { this.bipSayaci = 0; return; }
    const u = d.zone === 'red' ? UYARI.red : UYARI.amber;
    this.bipSayaci -= dt;
    if (this.bipSayaci <= 0) {
      this.bipSayaci = u.arayis;
      this.ton(u.hz, u.sure, u.ses, u.tip);
    }
  }

  /**
   * Süregelen sesleri sustur — bölümden çıkarken.
   *
   * Bağlam araçlar arasında YAŞIYOR (her makinede yeni bir `AudioContext`
   * açmak tarayıcının bağlam kotasını tüketir), ama `guncelle` yalnız oyun
   * döngüsü koşarken çağrılıyor. Esc'e basınca döngü duruyor, kazançlar ise
   * son değerlerinde kalıyordu: seçim ekranında motor sesi çalmaya devam
   * ediyordu. Olayları kapatmıyor, sadece sürekli sesleri indiriyor.
   */
  bosta(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.motorGain?.gain.setTargetAtTime(0, t, 0.08);
    this.hidrolikGain?.gain.setTargetAtTime(0, t, 0.05);
    this.bipSayaci = 0;
  }

  /** Bir kerelik olaylar. */
  olay(o: SesOlayi): void {
    if (!this.ctx || this._kapali) return;
    switch (o) {
      // Kancanın çeliği: kısa, tiz, hemen sönen bir tık.
      case 'bagla': this.ton(520, 0.07, 0.20, 'triangle'); this.darbe(0.05, 900, 0.12); break;
      case 'birak': this.ton(390, 0.09, 0.15, 'triangle'); break;
      // Çarpma: geniş bantlı, alçak, sert. Oyuncunun içi gitsin.
      case 'carpma': this.darbe(0.20, 320, 0.55); this.ton(90, 0.16, 0.3, 'sine'); break;
      // Yerleştirme onayı: yükselen iki nota. Bölümün tek olumlu sesi.
      case 'kondu':
        this.ton(523, 0.10, 0.20, 'sine');
        window.setTimeout(() => { this.ton(784, 0.16, 0.20, 'sine'); }, 105);
        break;
      // Ayak: hidrolik nefes.
      case 'ayak': this.darbe(0.35, 700, 0.14); break;
      // Ret: kısa, alçak, olumsuz.
      case 'ret': this.ton(165, 0.13, 0.20, 'triangle'); break;
    }
  }

  /** Zarflı kısa ton. */
  private ton(hz: number, sure: number, ses: number, tip: OscillatorType): void {
    const ctx = this.ctx; const ana = this.ana;
    if (!ctx || !ana) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = tip;
    o.frequency.value = hz;
    const g = ctx.createGain();
    // Ani başlayan bir kazanç "tık" diye çatlıyor; 8 ms'lik rampa yetiyor.
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(ses, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g); g.connect(ana);
    o.start(t);
    o.stop(t + sure + 0.02);
  }

  /** Alçak geçiren süzgeçten geçmiş gürültü patlaması — darbe/çarpma. */
  private darbe(sure: number, kesim: number, ses: number): void {
    const ctx = this.ctx; const ana = this.ana; const buf = this.gurultu;
    if (!ctx || !ana || !buf) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(kesim, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, kesim * 0.25), t + sure);
    const g = ctx.createGain();
    g.gain.setValueAtTime(ses, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    src.connect(f); f.connect(g); g.connect(ana);
    src.start(t);
    src.stop(t + sure + 0.02);
  }
}

function clamp01(v: number): number {
  return !Number.isFinite(v) ? 0 : v < 0 ? 0 : v > 1 ? 1 : v;
}
