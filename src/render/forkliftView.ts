import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { worldText } from './text';
import { FORKLIFT } from '../sim/forklift';

/**
 * Forkliftin görünümü — vinçle aynı kural: prosedürel vektör, sprite yok.
 *
 * Makinenin üç parçası birbirinden bağımsız hareket ediyor ve çizim de o
 * ayrımı birebir taşıyor, çünkü fizikte de öyle:
 *
 *   şasi      — gövde, karşı ağırlık, kabin kafesi (gövdeyle döner)
 *   direk     — şasinin ön ucunda, kendi eğimiyle (±10°)
 *   taşıyıcı  — direğin içinde yükselen çatal
 *
 * Ölçüler `FORKLIFT`ten okunuyor, kopyalanmıyor: fizikteki bir sayıyı
 * değiştirince çizim de onunla birlikte kayıyor. Vinçte bu ayrım olmadığı
 * için bom uzunluğu iki yerde tutuluyordu ve bir kez ayrı düştü.
 */
const F = FORKLIFT;
/** Direğin şasi üstündeki dönme pimi — eğim buradan. */
const DIREK_PIM = { x: F.mastX, y: F.mastBaseY };
/**
 * Direk İKİ KADEMELİ ve gerçekten uzuyor.
 *
 * İlk sürümde direk sabit boydaydı ve taşıyıcı 4.9 metreye çıkınca direğin
 * bir metre üstünde havada kalıyordu — sahadan gelen "forklift en üste
 * çıkınca animasyon bozuluyor, çatal kayboluyor" bunun ta kendisi. Gerçek
 * makinede dış kanal sabittir, iç kanal serbest kalkıştan sonra yükselir ve
 * taşıyıcı hep onun içinde kalır.
 */
const DIS_KANAL = FORKLIFT.direkBoyM;
const IC_KANAL = FORKLIFT.direkBoyM + 0.3;
/** Serbest kalkış: taşıyıcı bu kota kadar iç kanalı hareket ettirmeden çıkar. */
const SERBEST_KALKIS = 1.4;

export class ForkliftView extends Container {
  /** Direk — kendi eğimiyle dönüyor. */
  readonly direk = new Container();
  /** İç kanal — serbest kalkıştan sonra yükselen kısım. */
  readonly icKanal = new Container();
  /** Taşıyıcı ve çatal — iç kanalın içinde yükseliyor. */
  readonly tasiyici = new Container();

  constructor() {
    super();
    this.addChild(drawGovde(), drawKafes());

    this.direk.position.set(DIREK_PIM.x, DIREK_PIM.y);
    this.direk.addChild(drawDisKanal());

    this.icKanal.addChild(drawIcKanal());
    this.direk.addChild(this.icKanal);

    this.tasiyici.addChild(drawCatal());
    this.direk.addChild(this.tasiyici);

    this.addChild(this.direk);
    this.setPose(F.minLiftM, 0);
  }

  /**
   * `liftM` çatalın YERDEN kotu, `tiltDeg` direğin eğimi (+ geriye).
   *
   * Taşıyıcının direk içindeki yeri, pimin zeminden yüksekliği çıkarılarak
   * bulunuyor: `lift` yerden ölçülüyor, çizim ise pimden.
   */
  setPose(liftM: number, tiltDeg: number): void {
    const pimden = liftM - FORKLIFT.minLiftM;
    this.direk.rotation = (tiltDeg * Math.PI) / 180;
    this.tasiyici.position.set(0, pimden);
    this.icKanal.position.set(0, Math.max(0, pimden - SERBEST_KALKIS));
  }
}

function drawGovde(): Graphics {
  const g = new Graphics();
  const L = F.chassisHalfLength;
  const H = F.chassisHalfHeight;

  // Karşı ağırlık — makinenin arka yarısı. Forkliftin tanımı bu kütle,
  // dolayısıyla görünürde de ağır durmalı: koyu, blok, yuvarlatılmış kuyruk.
  g.roundRect(-L - 0.1, -H - 0.14, 1.15, H * 2 + 0.2, 0.18).fill(C.forkDark);
  g.roundRect(-L - 0.1, -H - 0.14, 1.15, (H * 2 + 0.2) * 0.3, 0.16)
    .fill({ color: C.forkLight, alpha: 0.25 });

  // Gövde ve motor kapağı
  g.roundRect(-L + 0.9, -H, L * 2 - 0.9, H * 2, 0.1).fill(C.fork);
  g.roundRect(-L + 0.9, -H, L * 2 - 0.9, H * 0.7, 0.1)
    .fill({ color: C.forkLight, alpha: 0.55 });
  g.roundRect(-L + 0.9, H - 0.16, L * 2 - 0.9, 0.16, 0.05)
    .fill({ color: C.forkLine, alpha: 0.5 });

  // Motor kapağı çizgisi ve havalandırma — düz turuncu blok cansız duruyordu
  g.moveTo(-0.28, -H).lineTo(-0.28, H).stroke({ width: 0.035, color: C.forkLine, alpha: 0.7 });
  for (let i = 0; i < 4; i++) {
    g.rect(-1.12 + i * 0.17, -0.18, 0.07, 0.42).fill({ color: C.forkLine, alpha: 0.55 });
  }

  // Sürücü platformu ve koltuk
  g.rect(-0.95, H, 1.1, 0.06).fill(C.forkDark);
  g.roundRect(-0.9, H + 0.06, 0.42, 0.42, 0.08).fill(C.mast);       // sırtlık
  g.roundRect(-0.9, H + 0.06, 0.62, 0.14, 0.06).fill(C.mastLight);  // oturak
  // Direksiyon ve kolon
  g.moveTo(0.16, H + 0.06).lineTo(0.02, H + 0.62)
    .stroke({ width: 0.07, color: C.mast });
  g.circle(0.02, H + 0.64, 0.14).stroke({ width: 0.06, color: C.mastLight });

  // Ön aks gövdesi — tekerleğin oturduğu yer görünsün
  g.rect(F.frontAxleX - 0.3, -H - 0.1, 0.6, 0.18).fill(C.mast);
  g.rect(F.rearAxleX - 0.26, -H - 0.08, 0.52, 0.16).fill(C.mast);
  // Karşı ağırlığın eteği — fizikte de var, makinenin arkaya devrilmesini
  // durduran şey. Yerden açıklığı bilerek az.
  g.roundRect(-1.35, -H - 0.28, 0.7, 0.28, 0.06).fill(C.forkDark);

  // Giydirme: kamyonda ne varsa burada da. Aynı firma, başka makine.
  const logo = worldText('YILMAZ', 0.2, { fill: 0x2A1608, letterSpacing: 1 });
  logo.position.set(-0.05, -0.02);
  g.addChild(logo);

  return g;
}

/**
 * Kabin kafesi (FOPS) — düşen yükten koruyan tavan.
 *
 * Forkliti forklift yapan siluetin yarısı bu kafes. Olmayınca makine bir kutu
 * gibi görünüyordu.
 */
function drawKafes(): Graphics {
  const g = new Graphics();
  const H = F.chassisHalfHeight;
  const tavan = H + 1.24;
  for (const x of [-0.95, 0.62]) {
    g.moveTo(x, H).lineTo(x + (x < 0 ? 0.06 : -0.06), tavan)
      .stroke({ width: 0.085, color: C.mast });
  }
  g.roundRect(-1.0, tavan, 1.7, 0.1, 0.04).fill(C.mast);
  // Tavan ızgarası — camsız, çubuklu; gerçek makinede de öyle
  for (let i = 0; i < 5; i++) {
    g.rect(-0.9 + i * 0.32, tavan - 0.07, 0.06, 0.07).fill({ color: C.mastLight, alpha: 0.9 });
  }
  // Tepe lambası
  g.roundRect(0.16, tavan + 0.1, 0.22, 0.14, 0.06).fill(C.hazardY);
  return g;
}

function drawDisKanal(): Graphics {
  const g = new Graphics();
  g.rect(-0.11, 0, 0.22, DIS_KANAL).fill(C.mast);
  g.rect(-0.11, 0, 0.07, DIS_KANAL).fill({ color: C.mastLight, alpha: 0.85 });
  g.rect(0.07, 0, 0.04, DIS_KANAL).fill({ color: 0x14171C, alpha: 0.9 });
  // Eğim silindiri — direği şasiye bağlayan, eğimi yapan parça
  g.moveTo(-0.09, 0.55).lineTo(-0.62, 0.2).stroke({ width: 0.1, color: C.hydraulic });
  g.circle(-0.09, 0.55, 0.06).fill(C.mastLight);
  // Taban pimi
  g.circle(0, 0.08, 0.07).fill(C.mastLight);
  return g;
}

function drawIcKanal(): Graphics {
  const g = new Graphics();
  g.rect(-0.07, 0, 0.14, IC_KANAL).fill(C.mastLight);
  g.rect(-0.07, 0, 0.05, IC_KANAL).fill({ color: 0x5A616C, alpha: 0.9 });
  // Kaldırma silindiri ve zinciri
  g.rect(0.08, 0, 0.07, IC_KANAL * 0.92).fill(C.hydraulic);
  g.rect(0.095, 0, 0.03, IC_KANAL * 0.92).fill({ color: C.chrome, alpha: 0.4 });
  // Tepedeki zincir makarası
  g.circle(0.115, IC_KANAL * 0.92, 0.09).fill(C.mast);
  g.circle(0.115, IC_KANAL * 0.92, 0.04).fill(C.mastLight);
  return g;
}

function drawCatal(): Graphics {
  const g = new Graphics();
  const sirt = F.sirtlikM;
  // Taşıyıcı plakası
  g.rect(-0.12, 0, 0.24, sirt + 0.08).fill(C.mastLight);
  g.rect(-0.12, 0, 0.24, 0.1).fill(C.mast);
  g.rect(-0.12, sirt - 0.02, 0.24, 0.1).fill(C.mast);
  // Yük sırtlığı — yükün geriye devrilmesini engelleyen ızgara
  g.rect(0.02, 0.06, 0.06, sirt).fill(C.blade);
  for (let i = 0; i * 0.18 + 0.12 < sirt; i++) {
    g.rect(0.02, 0.12 + i * 0.18, 0.4, 0.045).fill({ color: C.bladeDark, alpha: 0.8 });
  }
  // Çatal bıçağı: fizikteki kutuyla aynı kalınlıkta, ucu inceliyor
  const k = F.bicakKalinligiM;
  g.moveTo(0.0, 0).lineTo(F.forkLengthM - 0.12, 0)
    .lineTo(F.forkLengthM, k * 0.45).lineTo(F.forkLengthM, k)
    .lineTo(0.0, k).fill(C.blade);
  g.moveTo(0.0, 0).lineTo(F.forkLengthM - 0.12, 0).lineTo(F.forkLengthM, k * 0.45)
    .lineTo(0.0, k * 0.4).fill({ color: C.bladeDark, alpha: 0.75 });
  return g;
}

/** Tekerlek — kamyondakinden küçük ve sağır (dolgu lastik). */
export function drawForkliftWheel(r: number): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill(C.tyre);
  g.circle(0, 0, r * 0.98).stroke({ width: r * 0.06, color: C.tyreLight, alpha: 0.6 });
  g.circle(0, 0, r * 0.52).fill(C.rim);
  g.circle(0, 0, r * 0.2).fill(C.mast);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.circle(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, r * 0.06).fill(C.mast);
  }
  return g;
}
