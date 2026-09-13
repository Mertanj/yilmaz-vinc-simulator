/**
 * Valf rampası — oyuncu girdisini hidrolik hissi veren bir komuta çevirir.
 *
 * NOT: Bu sınıf artık gövdeyi konumlandırmıyor. Fizik spike'ından sonra mimari
 * değişti — bom açısı, bom boyu ve outrigger'lar planck'in motorlu joint'leriyle
 * solverın İÇİNDE sürülüyor (bkz. docs/01-oyun-tasarimi.md §5.5). Böylece yükün
 * ağırlığı boma ve kamyona geri tepiyor, devrilme ile yük momenti kendiliğinden
 * çıkıyor.
 *
 * Buranın işi sadece girdiyi yumuşatmak: ham tuş basımı 0/1'dir, hidrolik valf
 * öyle davranmaz. Çıkan değer doğrudan joint.setMotorSpeed()'e verilir.
 */

export interface ActuatorConfig {
  min: number;
  max: number;
  /** Tam açık valfte birim/saniye. */
  maxSpeed: number;
  /** Sıfırdan tam hıza çıkma süresi (s). */
  rampUpSec: number;
  /** Tam hızdan durma süresi (s). */
  rampDownSec: number;
}

export class Actuator {
  value: number;
  /** Anlık hız (birim/s). Rampa yüzünden komuta anında uymaz. */
  velocity = 0;

  constructor(private readonly cfg: ActuatorConfig, initial: number) {
    this.value = clamp(initial, cfg.min, cfg.max);
  }

  /**
   * @param command -1..+1 arası valf komutu (oyuncu girdisi)
   * @param dt saniye
   * @param speedScale LMI'den gelen hız çarpanı (sarıda 0.6, kırmızıda 0.3)
   */
  update(command: number, dt: number, speedScale = 1): void {
    const { maxSpeed, rampUpSec, rampDownSec, min, max } = this.cfg;

    const target = clamp(command, -1, 1) * maxSpeed * speedScale;
    // Hızlanırken yavaş, dururken daha hızlı — hidroliğin hissi bu.
    const accelerating = Math.abs(target) > Math.abs(this.velocity);
    const rampSec = accelerating ? rampUpSec : rampDownSec;
    const maxDelta = (maxSpeed / Math.max(rampSec, 1e-4)) * dt;

    const diff = target - this.velocity;
    this.velocity += clamp(diff, -maxDelta, maxDelta);

    this.value = clamp(this.value + this.velocity * dt, min, max);

    // Sınıra dayandıysak hız birikmesin.
    if (this.value <= min || this.value >= max) this.velocity = 0;
  }

  get atMin(): boolean { return this.value <= this.cfg.min + 1e-6; }
  get atMax(): boolean { return this.value >= this.cfg.max - 1e-6; }
  /** 0..1 arası normalize konum — HUD çubukları için. */
  get normalized(): number {
    return (this.value - this.cfg.min) / (this.cfg.max - this.cfg.min);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
