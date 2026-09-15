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
  /** Halatın düşeyden en fazla saptığı açı (derece) — salınım ölçüsü. */
  maxSalinim: number;
  carpma: number;
  /** Her görevde hedef merkezine uzaklık (m). */
  sapmalar: number[];
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
 * Bu süreyi aşan her saniye puandan düşüyor.
 *
 * Başsız rigin dikkatli (salınımı söndüren, halatı dibe vurdurmayan) bir turu
 * 688 saniye sürüyor; dört kaldırma için gerçekçi taban bu. 300 saniyeyken
 * ceza tek başına 97 puandı ve her tamamlanmış tur D'ye düşüyordu.
 */
const HEDEF_SURE = 480;

export class Mission {
  private index = 0;
  private durulmaSn = 0;
  private bitti = false;
  private devrildi = false;
  /** Oyuncu R'ye bastıysa "tek seferde" rozeti yanar. */
  private sifirlandi = false;

  readonly score: Score = {
    sure: 0, maxLmi: 0, maxSalinim: 0, carpma: 0, sapmalar: [],
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
    this.score.maxSalinim = 0;
    this.score.carpma = 0;
    this.score.sapmalar.length = 0;
    this.scene.carpma = 0;
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
      if (Number.isFinite(lmi) && lmi > this.score.maxLmi) {
        this.score.maxLmi = Math.min(999, lmi);
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
    this.score.sapmalar.push(Math.abs(this.scene.load.getPosition().x - hedef.x));
    this.durulmaSn = 0;
    this.index++;
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
function degerlendir(score: Score, devrildi: boolean, sifirlandi: boolean): Result {
  let puan = 100;
  // Sarının üstü pahalı — %100'ü geçmek gerçek vinçte kilitlenme demek.
  puan -= Math.max(0, score.maxLmi - 90) * 1.0;
  puan -= score.carpma * 6;
  // Ortalama yerleştirme sapması — metre başına 12 puan.
  const ortSapma = score.sapmalar.length
    ? score.sapmalar.reduce((a, b) => a + b, 0) / score.sapmalar.length
    : 0;
  puan -= ortSapma * 12;
  puan -= Math.max(0, score.sure - HEDEF_SURE) * 0.06;
  // Salınım kendi başına ceza değil; sadece 30 dereceyi aşınca sayılıyor,
  // çünkü sarkaç oyunun becerisi, hatası değil.
  puan -= Math.max(0, score.maxSalinim - 30) * 0.6;
  // Yarım kalan bölüm tamamlanmış sayılmaz.
  puan -= (4 - score.sapmalar.length) * 20;
  if (devrildi) puan = Math.min(puan, 15);

  puan = Math.max(0, Math.min(100, puan));
  const not = puan >= 85 ? 'A' : puan >= 70 ? 'B' : puan >= 55 ? 'C' : 'D';
  const usta = !devrildi && !sifirlandi && score.carpma === 0 && score.maxLmi <= 90;
  return { not, puan, usta, score, devrildi };
}
