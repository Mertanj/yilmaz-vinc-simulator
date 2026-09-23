import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { worldText } from './text';
import { YUKLEME } from '../sim/kasaYukleme';
import { M } from '../ui/dil';

/**
 * Bölüm 2 dekoru — yapı malzemesi deposunun avlusu.
 *
 * Soldan sağa: depo cephesi (açık sarma kapı), kapının önünde bekleyen
 * paletler (onlar görünümde, görev sırasına göre çiziliyor), yükleme alanı
 * ve park cebi. Ölçüler `YUKLEME`'den; çizim ile fizik aynı sayıyı okuyor.
 */

/** Depo cephesi: oluklu sac, beton subasman, açık sarma kapı, tabela. */
export function drawDepoCephesi(): Container {
  const c = new Container();
  const g = new Graphics();
  const sag = YUKLEME.depoCephe;
  const sol = sag - 18;
  const H = 7.4;

  g.rect(sol, 0, sag - sol, H).fill(C.wallShade);
  // Oluklu sac: dikey dalgalar, ışığı alan ve gölgede kalan şerit.
  for (let x = sol + 0.15; x < sag - 0.1; x += 0.32) {
    g.rect(x, 0.7, 0.07, H - 0.7).fill({ color: C.concreteD, alpha: 0.32 });
    g.rect(x + 0.1, 0.7, 0.04, H - 0.7).fill({ color: 0xFFFFFF, alpha: 0.08 });
  }
  // Beton subasman ve saçak.
  g.rect(sol, 0, sag - sol, 0.7).fill(C.concreteD);
  g.rect(sol - 0.2, H, sag - sol + 0.7, 0.32).fill(C.roof);
  g.rect(sol - 0.2, H - 0.06, sag - sol + 0.7, 0.06).fill({ color: 0x000000, alpha: 0.25 });
  // Köşe dikmesi: cephe burada bitiyor.
  g.rect(sag - 0.18, 0, 0.18, H).fill(C.roof);

  // Açık sarma kapı: koyu iç, üstte sarılmış kepenk kutusu, sarı-siyah pervaz.
  const kSol = sag - 5.6;
  const kSag = sag - 0.9;
  const kH = 4.8;
  g.rect(kSol, 0, kSag - kSol, kH).fill(0x2A2F33);
  g.rect(kSol, kH - 0.9, kSag - kSol, 0.9).fill({ color: 0x000000, alpha: 0.25 });
  // İçeride raf silüeti — deponun derinliği.
  for (let x = kSol + 0.4; x < kSag - 0.5; x += 1.5) {
    g.rect(x, 0, 0.08, kH - 1.0).fill({ color: 0x4A5258, alpha: 0.9 });
    for (let y = 0.9; y < kH - 1.1; y += 1.1) {
      g.rect(x, y, 1.2, 0.07).fill({ color: 0x4A5258, alpha: 0.9 });
    }
  }
  g.rect(kSol - 0.2, kH, kSag - kSol + 0.4, 0.5).fill(C.roof);
  for (const x of [kSol - 0.14, kSag]) {
    for (let y = 0; y < kH; y += 0.4) {
      g.rect(x, y, 0.14, 0.2).fill(C.hazardY);
      g.rect(x, y + 0.2, 0.14, 0.2).fill(C.hazardK);
    }
  }

  // Tabela.
  const tSol = sol + 3.0;
  const tSag = kSol - 1.2;
  g.roundRect(tSol, H - 1.8, tSag - tSol, 1.05, 0.08).fill(0xF4F1E6);
  g.roundRect(tSol, H - 1.8, tSag - tSol, 1.05, 0.08)
    .stroke({ width: 0.06, color: C.roof, alpha: 0.9 });
  c.addChild(g);
  const t = worldText(M.dekor.yapiDepo, 0.44, { fill: C.liveryRed, letterSpacing: 1 });
  t.position.set((tSol + tSag) / 2, H - 1.27);
  c.addChild(t);
  return c;
}

/**
 * Yükleme alanı — forkliftin paleti bıraktığı zemin.
 *
 * Palet kamyona GÖRE yerleşiyor (kuyruğun 1.9 m arkası), kamyon da park
 * cebinin içinde ±1.2 m oynayabiliyor; yani çizilecek şey tek bir kare değil,
 * paletin düşebileceği bant. Bant cebin iki ucundaki kamyonun paletini de
 * kapsıyor.
 */
export function drawYuklemeAlani(): Container {
  const c = new Container();
  const g = new Graphics();
  const orta = YUKLEME.parkX + YUKLEME.malzemeYerel;
  const sol = orta - YUKLEME.parkPayiM - 0.6;
  const sag = orta + YUKLEME.parkPayiM + 0.6;
  g.rect(sol, 0, sag - sol, 0.02).fill({ color: 0xFFFFFF, alpha: 0.12 });
  for (let x = sol; x < sag - 0.1; x += 0.5) {
    g.moveTo(x, 0.02).lineTo(x + 0.3, 0.02)
      .stroke({ width: 0.12, color: 0xFFFFFF, alpha: 0.5 });
  }
  for (const x of [sol, sag]) {
    g.rect(x - 0.05, 0, 0.1, 0.04).fill({ color: 0xFFFFFF, alpha: 0.8 });
  }
  // Levha direkte, bandın sol ucunda: zemine yazılan yazı palet gelince
  // onun arkasında kalırdı.
  const direkX = sol - 0.35;
  g.rect(direkX - 0.04, 0, 0.08, 2.0).fill(C.roof);
  g.roundRect(direkX - 0.7, 2.0, 1.4, 0.44, 0.05).fill(C.hazardY);
  g.roundRect(direkX - 0.7, 2.0, 1.4, 0.44, 0.05).stroke({ width: 0.04, color: C.hazardK });
  c.addChild(g);
  const t = worldText(M.dekor.yukleme, 0.24, { fill: C.hazardK, letterSpacing: 1 });
  t.position.set(direkX, 2.22);
  c.addChild(t);
  return c;
}
