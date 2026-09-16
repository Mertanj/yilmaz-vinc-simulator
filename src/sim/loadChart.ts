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

/**
 * Halat kat sayısı (parts of line / kat / fall).
 *
 * Kanca bloğunu taşıyan halat parçası sayısı. Dört şey birden değişiyor:
 *   kapasite = N × tek kat çekme × verim(N)   — verim N büyüdükçe DÜŞER
 *   kanca hızı = halat hızı ÷ N
 *   kullanılabilir kanca yolu = halat boyu ÷ N
 *   kanca bloğu ağırlaşır ve bu ağırlık yükten düşülür
 *
 * Maeda MC285C-3'ün kataloğu bunu birebir yazıyor: 4 kat 2.820 kg, 2 kat
 * 1.410 kg, tek kat 710 kg. Tam olarak 1:2:4.
 *
 * **Vinçte iki bağımsız sınır var ve küçüğü geçerli:** yük tablosu (devrilme
 * ve bom mukavemeti) ile halatın kendisi. Kısa yarıçapta halat bağlar, uzun
 * yarıçapta tablo bağlar. Gerçek LMI de bu ikisinin min()'ini alır.
 */
export const KAT_SECENEKLERI = [1, 2, 4] as const;
export type KatSayisi = (typeof KAT_SECENEKLERI)[number];

/**
 * Tek kat halat çekme kuvveti (ton).
 *
 * **Oyun dengesi için seçildi, ölçüldü.** 3.5 t (National NBT30H'ın gerçek
 * değeri) denendi ve mekaniği öldürdü: bölümdeki en ağır yük 3.1 t olduğu için
 * tek kat her göreve yetiyordu ve tek kat hem daha hızlı hem bloğu daha hafif —
 * yani seçim diye bir şey kalmıyordu, oyuncu her zaman tek kat kullanırdı.
 *
 * 2.0 t ile yükler sınırın iki yanına düşüyor: ağır üç görev (2.3 / 3.1 / 2.2 t)
 * iki kat ZORUNLU, hafif iki görev (1.5 / 1.05 t) tek katla yapılabiliyor ve
 * kanca iki kat hızlanıyor. Karşılığında halatı yeniden geçirmek süre yiyor.
 * Karar gerçek ve sonucu yakın — iyi bir mekaniğin istediği tam da bu.
 *
 * Sahada bu makine sınıfı için 2 ton düşük değil: aile vincinde (HIDROKON
 * HK 90) standart ırgatın tek kat çekmesi 1.937 ton.
 */
export const TEK_KAT_TON = 2.0;

/**
 * N kat halatın taşıyabileceği yük (ton).
 *
 * Verim makara sürtünmesiyle düşüyor, o yüzden kapasite tam olarak N katı
 * değil. Liebherr'in kendi tablosunda kat başına pay 6.30'dan 5.67 tona
 * geriliyor (−%10, 1'den 12 kata) — buradaki 0.985^(N−1) o eğriye oturuyor.
 */
export function halatKapasitesi(kat: KatSayisi): number {
  return TEK_KAT_TON * kat * Math.pow(0.985, kat - 1);
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
  /** Geçerli sınır: tablo ile halat kapasitesinin küçüğü. */
  capacityTonnes: number;
  /** Yük tablosundan gelen sınır (devrilme / bom mukavemeti). */
  chartTonnes: number;
  /** Halattan gelen sınır (kat sayısı × tek kat çekme). */
  ropeTonnes: number;
  /** Hangisi bağlıyor — panelde bunu söylemek gerekiyor. */
  limitedBy: 'tablo' | 'halat';
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
  kat: KatSayisi = 2,
): LmiReading {
  const total = loadTonnes + hookTonnes;
  const chart = capacityAt(radiusM, outriggers);
  const rope = halatKapasitesi(kat);
  // İki bağımsız sınır, küçüğü geçerli.
  const capacity = Math.min(chart, rope);
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
    chartTonnes: chart,
    ropeTonnes: rope,
    limitedBy: rope < chart ? 'halat' : 'tablo',
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
