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
/** Direğin toplam boyu: çatal en üste çıktığında da içinde kalmalı. */
const DIREK_BOY = F.maxLiftM * 0.62 + 0.9;

export class ForkliftView extends Container {
  /** Direk — kendi eğimiyle dönüyor. */
  readonly direk = new Container();
  /** Taşıyıcı ve çatal — direğin içinde yükseliyor. */
  readonly tasiyici = new Container();

  constructor() {
    super();
    this.addChild(drawGovde(), drawKafes());

    this.direk.position.set(DIREK_PIM.x, DIREK_PIM.y);
    this.direk.addChild(drawDirek());

    this.tasiyici.addChild(drawCatal());
    this.direk.addChild(this.tasiyici);

    this.addChild(this.direk);
    this.setPose(F.minLiftM, 0);
  }

  /** `liftM` çatalın YERDEN kotu, `tiltDeg` direğin eğimi (+ geriye). */
  setPose(liftM: number, tiltDeg: number): void {
    this.direk.rotation = (tiltDeg * Math.PI) / 180;
    this.tasiyici.position.set(0, liftM);
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

function drawDirek(): Graphics {
  const g = new Graphics();
  // İki kanal: dış (sabit) ve iç (uzayan). Yan görünümde üst üsteler, o yüzden
  // iç kanal biraz daha açık renkle ayrılıyor.
  g.rect(-0.1, 0, 0.2, DIREK_BOY).fill(C.mast);
  g.rect(-0.1, 0, 0.07, DIREK_BOY).fill({ color: C.mastLight, alpha: 0.85 });
  g.rect(-0.05, 0.1, 0.1, DIREK_BOY - 0.2).fill({ color: C.mastLight, alpha: 0.5 });
  // Kaldırma silindiri
  g.rect(0.11, 0.05, 0.09, DIREK_BOY * 0.8).fill(C.hydraulic);
  g.rect(0.13, 0.05, 0.04, DIREK_BOY * 0.8).fill({ color: C.chrome, alpha: 0.35 });
  // Eğim silindiri — direği şasiye bağlayan, eğimi yapan parça
  g.moveTo(-0.08, 0.55).lineTo(-0.62, 0.2).stroke({ width: 0.1, color: C.hydraulic });
  g.circle(-0.08, 0.55, 0.06).fill(C.mastLight);
  return g;
}

function drawCatal(): Graphics {
  const g = new Graphics();
  // Taşıyıcı plakası
  g.rect(-0.12, 0, 0.24, 0.92).fill(C.mastLight);
  g.rect(-0.12, 0, 0.24, 0.1).fill(C.mast);
  g.rect(-0.12, 0.82, 0.24, 0.1).fill(C.mast);
  // Yük sırtlığı — yükün geriye devrilmesini engelleyen ızgara
  g.rect(0.1, 0.08, 0.06, 0.86).fill(C.blade);
  for (let i = 0; i < 3; i++) {
    g.rect(0.1, 0.16 + i * 0.3, 0.42, 0.05).fill({ color: C.bladeDark, alpha: 0.8 });
  }
  // Çatal bıçağı: dikey topuk + yatay bıçak, ucu inceliyor
  g.moveTo(0.04, 0.9)
    .lineTo(0.16, 0.9).lineTo(0.16, 0.09)
    .lineTo(F.forkLengthM, 0.03).lineTo(F.forkLengthM, -0.005)
    .lineTo(0.04, -0.005)
    .fill(C.blade);
  g.moveTo(0.04, -0.005).lineTo(F.forkLengthM, -0.005).lineTo(F.forkLengthM, 0.03)
    .lineTo(0.04, 0.045).fill({ color: C.bladeDark, alpha: 0.8 });
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
