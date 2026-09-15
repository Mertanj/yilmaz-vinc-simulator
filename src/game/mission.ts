import { factoryTerraces } from '../sim/world';
import type { Scene } from '../sim/scene';
import { TASKS, type Task } from './tasks';

/**
 * Bölüm akışı, puanlama ve not.
 *
 * Fazlar oyuncunun ne yaptığından TÜRETİLİYOR, ayrı bir durum makinesi
 * tutmuyoruz: ayaklar yerdeyse vinç fazındayız, dördüncü yük terasa konduysa
 * bölüm bitti. Böylece oyuncunun "geri dönmesi" (ayakları toplayıp yeniden
 * park etmesi) kendiliğinden çalışıyor ve senkron bozulacak ikinci bir gerçek
 * kaynağı olmuyor.
 */
export type Phase = 'surus' | 'kurulum' | 'gorev' | 'bitti' | 'devrildi';

export interface Score {
  /** Saniye. */
  sure: number;
  /** Görülen en yüksek LMI yüzdesi. */
  maxLmi: number;
  /**
   * Kırmızıda (LMI > %100) geçirilen süre (s).
   *
   * Puanlamanın asıl ölçüsü bu, zirve değil. Salınan bir yükte halat gerilimi
   * saliseler için statiğin 1.7 katına çıkabiliyor ve zirve %140 okuyor; oysa
   * bu, kırmızıda park etmiş bir vinçle aynı şey değil. Gerçek bir değerlendirme
   * de "aşırı yükte ne kadar kaldın" diye sorar.
   */
  kirmiziSn: number;
  /** Halatın düşeyden en fazla saptığı açı (derece) — salınım ölçüsü. */
  maxSalinim: number;
  carpma: number;
  /** Her görevde hedef merkezine uzaklık (m). */
  sapmalar: number[];
  /** Toplanan puan. */
  puan: number;
}

/** Bir yerleştirmeden kazanılan puanın dökümü. */
export interface Puan {
  temel: number;
  isabet: number;
  hiz: number;
  ceza: number;
  toplam: number;
}

/** Biten bir görevin özeti — yerleştirme onay ekranı bunu gösteriyor. */
export interface Tamamlanan {
  /** Bu yerleştirmeden kazanılan puan. */
  puan: Puan;
  kod: string;
  ad: string;
  /** Hedef merkezine yatay uzaklık (cm). */
  sapmaCm: number;
  /** Bu görev boyunca görülen en yüksek LMI. */
  maxLmi: number;
  /** Bu göreve harcanan süre (s). */
  sure: number;
  /** Sırada kaç görev kaldı. */
  kalan: number;
  /** Kaçıncı görev — aynı özetin iki kez gösterilmemesi için. */
  sira: number;
}

export interface Result {
  not: 'A' | 'B' | 'C' | 'D';
  puan: number;
  usta: boolean;
  score: Score;
  devrildi: boolean;
}

/** Devrilme sayılan eğim. Ayaklar yarım açıkken ağır yükte gerçekten oluyor. */
const DEVRILME_DEG = 8;
/**
 * Yerleştirme başına puan.
 *
 * Sahadan gelen istek: "sapmadan puan kırmak yerine her yerleştirmeye puan
 * verelim, öyle daha eğlenceli." Haklı — ceza tabanlı bir sistem iyi oynayınca
 * hiçbir şey hissettirmiyor, sadece kötü oynayınca acıtıyor. Şimdi her yükü
 * yerine koymak puan KAZANDIRIYOR, isabet ve hız da üstüne biniyor.
 */
export const PUAN = {
  /** Yükü yerine koymanın kendisi. Bitirmek her zaman kazandırır. */
  temel: 1000,
  /** Tam ortaya koyarsan bu kadar; sapma büyüdükçe doğrusal azalır. */
  isabetTam: 600,
  /** Bu sapmada (m) isabet bonusu sıfırlanır. */
  isabetSifir: 2.0,
  /** Bu süreden (s) hızlı bitirirsen tam hız bonusu. */
  hizTamSn: 90,
  /** Bu süreden yavaşsa hız bonusu sıfır. */
  hizSifirSn: 240,
  hizTam: 400,
  /** Kırmızıda geçen saniye başına kesinti. */
  kirmiziCezasi: 40,
  /** Çarpma başına kesinti. */
  carpmaCezasi: 150,
} as const;

/** Bir görevden alınabilecek en yüksek puan — not bunun oranından çıkıyor. */
const GOREV_MAX = PUAN.temel + PUAN.isabetTam + PUAN.hizTam;


export class Mission {
  private index = 0;
  private durulmaSn = 0;
  /** Bu görevin başladığı an ve o andan beri görülen en yüksek LMI. */
  private gorevBasi = 0;
  private gorevMaxLmi = 0;
  private gorevKirmiziSn = 0;
  private gorevCarpmaBasi = 0;
  /** Son biten görevin özeti. main.ts `sira` değişince paneli gösteriyor. */
  sonTamamlanan: Tamamlanan | null = null;
  private bitti = false;
  private devrildi = false;
  /** Oyuncu R'ye bastıysa "tek seferde" rozeti yanar. */
  private sifirlandi = false;

  readonly score: Score = {
    sure: 0, maxLmi: 0, kirmiziSn: 0, maxSalinim: 0, carpma: 0, sapmalar: [], puan: 0,
  };

  private readonly teraslar = factoryTerraces();

  constructor(private readonly scene: Scene) {}

  get task(): Task | null { return TASKS[this.index] ?? null; }
  get taskNo(): number { return Math.min(this.index + 1, TASKS.length); }
  get taskCount(): number { return TASKS.length; }

  /** Güncel görevin bırakma noktası. */
  get target(): { x: number; y: number } | null {
    const t = this.task;
    if (!t) return null;
    return this.teraslar[t.hedef] ?? null;
  }

  get phase(): Phase {
    if (this.devrildi) return 'devrildi';
    if (this.bitti) return 'bitti';
    if (!this.scene.craneMode) return this.index === 0 ? 'surus' : 'gorev';
    return 'gorev';
  }

  /** Bölüm bittiyse sonuç, yoksa null. */
  get result(): Result | null {
    if (!this.bitti && !this.devrildi) return null;
    return degerlendir(this.score, this.devrildi, this.sifirlandi);
  }

  markReset(): void {
    this.sifirlandi = true;
    this.devrildi = false;
    this.bitti = false;
    this.index = 0;
    this.durulmaSn = 0;
    this.score.sure = 0;
    this.score.maxLmi = 0;
    this.score.kirmiziSn = 0;
    this.score.maxSalinim = 0;
    this.score.carpma = 0;
    this.score.sapmalar.length = 0;
    this.scene.carpma = 0;
    this.gorevBasi = 0;
    this.gorevMaxLmi = 0;
    this.gorevKirmiziSn = 0;
    this.gorevCarpmaBasi = 0;
    this.score.puan = 0;
    this.sonTamamlanan = null;
    this.scene.spawnLoad(TASKS[0] ?? null);
  }

  /** Her fizik adımında, scene.step()'ten SONRA. */
  update(dt: number): void {
    if (this.bitti || this.devrildi) return;
    this.score.sure += dt;
    this.score.carpma = this.scene.carpma;

    if (Math.abs(this.scene.tiltDeg) > DEVRILME_DEG) {
      this.devrildi = true;
      return;
    }

    if (this.scene.craneMode) {
      const lmi = this.scene.crane.lmi.percent;
      if (Number.isFinite(lmi)) {
        if (lmi > this.score.maxLmi) this.score.maxLmi = Math.min(999, lmi);
        if (lmi > this.gorevMaxLmi) this.gorevMaxLmi = Math.min(999, lmi);
        if (lmi > 100) {
          this.score.kirmiziSn += dt;
          this.gorevKirmiziSn += dt;
        }
      }
      const s = Math.abs(this.salinimDeg());
      if (s > this.score.maxSalinim) this.score.maxSalinim = s;
    }

    const t = this.task;
    const hedef = this.target;
    if (!t || !hedef) return;

    if (this.yerinde(t, hedef)) {
      this.durulmaSn += dt;
      // Yarım saniye durması şart: sekerken geçen bir kare "kondu" sayılmamalı.
      if (this.durulmaSn >= 0.5) this.tamamla(hedef);
    } else {
      this.durulmaSn = 0;
    }
  }

  /**
   * Halatın düşeyden sapma açısı — salınımın doğrudan ölçüsü.
   *
   * Halat 1.5 metrenin altındaysa sıfır sayılıyor. Sebebi geometrik: kanca bom
   * ucuna dayanmışken (iki-blok, halat 1.2 m) 11 santimlik bir kayma 5 dereceye
   * denk geliyor, yani ölçü anlamını yitiriyor. Bir kontrol döngüsü tam da bu
   * yüzden kilitlendi — "salınım geniş" deyip beklemeye geçti, oysa kanca
   * ucun dibindeydi ve bekleyerek değişecek bir şey yoktu.
   */
  salinimDeg(): number {
    const tip = this.scene.crane.tipWorld;
    const h = this.scene.crane.hook.getPosition();
    const dy = tip.y - h.y;
    if (dy < 1.5) return 0;
    return (Math.atan2(h.x - tip.x, dy) * 180) / Math.PI;
  }

  private yerinde(t: Task, hedef: { x: number; y: number }): boolean {
    if (this.scene.crane.hasLoad) return false;
    const p = this.scene.load.getPosition();
    const v = this.scene.load.getLinearVelocity();
    return Math.abs(p.x - hedef.x) <= 2.0
      && Math.abs(p.y - (hedef.y + t.halfHeight)) <= 0.4
      && Math.hypot(v.x, v.y) < 0.25;
  }

  private tamamla(hedef: { x: number; y: number }): void {
    const sapma = Math.abs(this.scene.load.getPosition().x - hedef.x);
    const biten = TASKS[this.index];
    const gorevSure = this.score.sure - this.gorevBasi;
    const gorevCarpma = this.scene.carpma - this.gorevCarpmaBasi;
    this.score.sapmalar.push(sapma);
    this.durulmaSn = 0;
    this.index++;
    if (biten) {
      const puan = puanla(sapma, gorevSure, this.gorevKirmiziSn, gorevCarpma);
      this.score.puan += puan.toplam;
      this.sonTamamlanan = {
        puan,
        kod: biten.kod, ad: biten.ad,
        sapmaCm: sapma * 100,
        maxLmi: this.gorevMaxLmi,
        sure: gorevSure,
        kalan: TASKS.length - this.index,
        sira: this.index,
      };
    }
    this.gorevBasi = this.score.sure;
    this.gorevMaxLmi = 0;
    this.gorevKirmiziSn = 0;
    this.gorevCarpmaBasi = this.scene.carpma;
    const sonraki = TASKS[this.index];
    if (sonraki) {
      // Konan yük sahnede kalsın istiyoruz ama malzeme alanı tek gövde
      // tutuyor; konan yükü artık kancalanabilir olmaktan çıkarıp yenisini
      // getiriyoruz. (Konanları da sahnede tutmak Sprint 5 işi — o zaman
      // her görev kendi gövdesini bırakacak.)
      this.scene.spawnLoad(sonraki);
    } else {
      this.bitti = true;
    }
  }
}

/**
 * Ağırlıklar başsız rigin gerçek turuna göre ayarlandı.
 *
 * Referans tur: dört görev de tamam, 2 çarpma, LMI kısa süre %109, salınım 33°,
 * yerleştirme 15 cm, 688 saniye. Bu "işi bitirmiş ama pürüzlü" bir tur ve C
 * vermesi gerekiyor; kusursuz bir tur (çarpma yok, LMI sarıda kalıyor) A.
 */
/** Bir yerleştirmenin puan dökümü. */
function puanla(
  sapmaM: number, sureSn: number, kirmiziSn: number, carpma: number,
): Puan {
  const temel = PUAN.temel;
  const isabet = Math.round(
    PUAN.isabetTam * Math.max(0, 1 - sapmaM / PUAN.isabetSifir),
  );
  const hizOran = (PUAN.hizSifirSn - sureSn) / (PUAN.hizSifirSn - PUAN.hizTamSn);
  const hiz = Math.round(PUAN.hizTam * Math.max(0, Math.min(1, hizOran)));
  const ceza = Math.round(kirmiziSn * PUAN.kirmiziCezasi + carpma * PUAN.carpmaCezasi);
  // Yerleştirme asla eksi puan yazmıyor: bitirmek her zaman ilerleme demek.
  const toplam = Math.max(0, temel + isabet + hiz - ceza);
  return { temel, isabet, hiz, ceza, toplam };
}

/**
 * Bölüm notu, toplanan puanın alınabilecek en yüksek puana oranından.
 *
 * Eskiden 100'den ceza düşülüyordu ve iyi oynamak hiçbir şey hissettirmiyordu;
 * şimdi not doğrudan kazanılan puanın yüzdesi. Yarım kalan bölüm kendiliğinden
 * düşük not alıyor, ayrıca ceza vermeye gerek yok — konulmayan yükün puanı yok.
 */
function degerlendir(score: Score, devrildi: boolean, sifirlandi: boolean): Result {
  const enYuksek = GOREV_MAX * TASKS.length;
  let oran = enYuksek > 0 ? (score.puan / enYuksek) * 100 : 0;
  if (devrildi) oran = Math.min(oran, 15);
  const puan = Math.max(0, Math.min(100, oran));
  const not = puan >= 85 ? 'A' : puan >= 70 ? 'B' : puan >= 55 ? 'C' : 'D';
  const usta = !devrildi && !sifirlandi && score.carpma === 0
    && score.kirmiziSn === 0 && score.sapmalar.length === TASKS.length;
  return { not, puan, usta, score, devrildi };
}
