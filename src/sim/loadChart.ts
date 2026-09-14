/**
 * YV-25 yük tablosu (load chart) ve yük momenti hesabı.
 *
 * Motor bağımsız: burada hiçbir fizik kütüphanesi import edilmez.
 * Sadece saf matematik — Phaser/Matter, Pixi/planck, Rapier fark etmez.
 */

export const G = 9.81;

/** Outrigger (ayak) açılma durumu. Kapasiteyi doğrudan çarpar. */
export enum OutriggerState {
  Stowed = 'stowed',   // lastik üstü — çok tehlikeli
  Half = 'half',       // yarı açık
  Full = 'full',       // tam açık
}

export const OUTRIGGER_FACTOR: Record<OutriggerState, number> = {
  [OutriggerState.Stowed]: 0.25,
  [OutriggerState.Half]: 0.6,
  [OutriggerState.Full]: 1.0,
};

/**
 * Yarıçap (m) → kapasite (ton), tam açık outrigger'da.
 * Moment kapasitesi de yarıçapla düşüyor (75 t·m @3m → 22 t·m @28m);
 * uzun bomda sınır sadece devrilme değil, bom mukavemeti ve sehimdir.
 */
export const LOAD_CHART: ReadonlyArray<readonly [number, number]> = [
  [3, 25.0], [4, 20.0], [5, 15.5], [6, 12.5], [8, 9.0], [10, 6.8],
  [12, 5.2], [14, 4.0], [16, 3.2], [18, 2.5], [20, 2.0], [24, 1.3], [28, 0.8],
];

/** Verilen yarıçapta ton cinsinden kapasite. Tablo dışında güvenli tarafa yuvarlar. */
export function capacityAt(radiusM: number, outriggers = OutriggerState.Full): number {
  const chart = LOAD_CHART;
  const factor = OUTRIGGER_FACTOR[outriggers];
  const first = chart[0];
  const last = chart[chart.length - 1];
  if (!first || !last) return 0;

  if (radiusM <= first[0]) return first[1] * factor;
  if (radiusM >= last[0]) return 0;

  for (let i = 0; i < chart.length - 1; i++) {
    const lo = chart[i];
    const hi = chart[i + 1];
    if (!lo || !hi) continue;
    if (radiusM >= lo[0] && radiusM <= hi[0]) {
      const t = (radiusM - lo[0]) / (hi[0] - lo[0]);
      return (lo[1] + t * (hi[1] - lo[1])) * factor;
    }
  }
  return 0;
}

export enum LmiZone {
  Green = 'green',
  Amber = 'amber',
  Red = 'red',
}

export interface LmiReading {
  /** Kapasitenin yüzdesi. 100'ün üstü aşırı yük. */
  percent: number;
  zone: LmiZone;
  capacityTonnes: number;
  loadTonnes: number;
  radiusM: number;
  /** Aktüatörlere uygulanacak hız çarpanı — sarıda yavaşlar. */
  speedScale: number;
  /** Kırmızıda yarıçapı artıran hareketler kilitlenir. */
  blockRadiusIncrease: boolean;
}

/**
 * Yük Moment Göstergesi. Gerçek bir vinçteki LMI/LMB ile aynı mantık:
 * anlık yük momentini o yarıçaptaki izin verilen momentle karşılaştırır.
 *
 * Moment oranı kütle oranına eşit olduğu için (aynı R ile çarpılıp bölünür)
 * yüzde doğrudan kütlelerden hesaplanır.
 */
export function computeLmi(
  radiusM: number,
  loadTonnes: number,
  hookTonnes: number,
  outriggers = OutriggerState.Full,
): LmiReading {
  const total = loadTonnes + hookTonnes;
  const capacity = capacityAt(radiusM, outriggers);
  const percent = capacity <= 0 ? Infinity : (total / capacity) * 100;

  let zone: LmiZone;
  let speedScale: number;
  if (percent > 100) {
    zone = LmiZone.Red;
    speedScale = 0.3;
  } else if (percent >= 80) {
    zone = LmiZone.Amber;
    speedScale = 0.6;
  } else {
    zone = LmiZone.Green;
    speedScale = 1.0;
  }

  return {
    percent,
    zone,
    capacityTonnes: capacity,
    loadTonnes: total,
    radiusM,
    speedScale,
    blockRadiusIncrease: zone === LmiZone.Red,
  };
}

/**
 * Halat kuvvetinden anlık yük (ton).
 *
 * LMI'yi kendi defterimizden değil solverdan okumamızın sebebi: sarkaç
 * salınırken halat gerilimi statik ağırlığın üstüne çıkar (40° salınımda +%46,
 * spikes/02 ile doğrulandı). Statik yükle hesaplanan bir LMI yalan söyler.
 *
 * @param cableForceNewtons planck: cable.getReactionForce(1/dt) büyüklüğü
 */
export function tonnesFromCableForce(cableForceNewtons: number): number {
  return cableForceNewtons / (G * 1000);
}

/** Solverdan okunan gerçek kuvvetle LMI. Oyunda kullanılacak olan bu. */
export function lmiFromCableForce(
  radiusM: number,
  cableForceNewtons: number,
  outriggers = OutriggerState.Full,
): LmiReading {
  return computeLmi(radiusM, tonnesFromCableForce(cableForceNewtons), 0, outriggers);
}

/** Devirici moment (t·m) — devrilme kontrolü için. */
export function overturningMoment(radiusM: number, totalTonnes: number): number {
  return totalTonnes * radiusM;
}

/**
 * Karşı moment (t·m). Devrilme dayanağı, yük tarafındaki ayağın bastığı nokta;
 * ayak açıkken kol uzar, lastik üstünde kısalır.
 */
export function resistingMoment(
  machineTonnes: number,
  outriggers = OutriggerState.Full,
): number {
  const leverArmM = { stowed: 1.1, half: 2.0, full: 3.0 }[outriggers];
  return machineTonnes * leverArmM;
}

/** Devrilme başladı mı? Scripted değil — moment dengesinden çıkar. */
export function isTipping(
  radiusM: number,
  totalTonnes: number,
  machineTonnes: number,
  outriggers = OutriggerState.Full,
): boolean {
  return overturningMoment(radiusM, totalTonnes) > resistingMoment(machineTonnes, outriggers);
}
