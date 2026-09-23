import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { worldText, kapla } from './text';
import { drawWheel } from './truckView';
import { SANTIYE } from '../sim/santiye';
import { M } from '../ui/dil';

/**
 * Şantiye teslimatı — vincin ikinci bölümünün dekoru.
 *
 * Ölçüler `SANTIYE`'den okunuyor, burada tekrar yazılmıyor: çizim ile fizik
 * ayrışırsa oyuncu var olmayan bir kalasın üstüne yük koymaya çalışır. Bu
 * depoda aynı sınıftan bir hata bir kez oldu (teras kotu) ve pahalıydı.
 */

function karistir(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16)
    | (Math.round(ag + (bg - ag) * t) << 8)
    | Math.round(ab + (bb - ab) * t);
}

/**
 * Arkada yükselen karkas bina ve kule vinç — tamamen dekor.
 *
 * Şantiyeyi şantiye yapan şey bu: sahaya inen malzemenin NEREYE gittiği.
 * Pusla gökyüzüne karışıyor, çünkü derinlikte; önündeki her şey onun
 * önünden geçiyor.
 */
export function drawSantiyeArka(): Container {
  const g = new Graphics();
  const pus = (renk: number, t = 0.42): number => karistir(renk, C.sky, t);
  const x0 = 28;
  const x1 = 56;
  const kat = 3.1;
  const katSayisi = 5;
  // Döşemeler ve kolonlar: beton iskelet, üst iki kat henüz açık.
  for (let k = 0; k < katSayisi; k++) {
    const y = k * kat;
    if (k < 3) {
      // Tuğla dolgu: alt katlar örülmüş
      g.rect(x0, y + 0.25, x1 - x0, kat - 0.25).fill(pus(0xA0664A, 0.5));
      for (let wx = x0 + 1.2; wx < x1 - 1.5; wx += 3.4) {
        g.rect(wx, y + 1.0, 1.6, 1.3).fill(pus(0x2E363C, 0.45));
      }
    }
    g.rect(x0 - 0.2, y + kat - 0.25, x1 - x0 + 0.4, 0.25).fill(pus(0x9CA3A8));
  }
  for (let cx = x0; cx <= x1; cx += 4) {
    g.rect(cx - 0.2, 0, 0.4, kat * katSayisi + 1.2).fill(pus(0x8E969B));
    // Filizler: kolonun tepesinden çıkan demir
    g.rect(cx - 0.12, kat * katSayisi + 1.2, 0.04, 0.9).fill(pus(C.rust, 0.35));
    g.rect(cx + 0.08, kat * katSayisi + 1.2, 0.04, 0.9).fill(pus(C.rust, 0.35));
  }
  // İskele: cephenin önünde, üst katlarda
  for (let y = kat * 2; y < kat * katSayisi; y += 1.0) {
    g.rect(x1 + 0.2, y, 1.2, 0.05).fill(pus(0xB7C0C5, 0.5));
  }
  for (const sx of [x1 + 0.2, x1 + 1.35]) {
    g.rect(sx, kat * 2, 0.05, kat * 3).fill(pus(0xB7C0C5, 0.5));
  }

  // Kule vinç: kafes kule, bom, karşı ağırlık — binanın ARKASINDA ve pusta.
  // İlk çizimde öndeki bir nesne gibi okunuyordu (parlak sarı, tam opak)
  // ve sarkan halatı vincin kendi halatıyla karışıyordu; bom artık binanın
  // üstünde bitiyor, halat da yok.
  const kx = 36;
  const ky = 27;
  const kule = pus(C.amber, 0.62);
  const kafes = pus(C.amberDark, 0.6);
  g.rect(kx - 0.5, 0, 1.0, ky).fill(kule);
  for (let y = 0; y < ky; y += 1.0) {
    g.moveTo(kx - 0.5, y).lineTo(kx + 0.5, y + 1.0).stroke({ width: 0.07, color: kafes });
  }
  g.rect(kx - 7, ky, 25, 0.8).fill(kule);
  for (let x = kx - 7; x < kx + 18; x += 1.3) {
    g.moveTo(x, ky).lineTo(x + 0.65, ky + 0.8).stroke({ width: 0.06, color: kafes });
  }
  g.rect(kx - 6.6, ky - 1.3, 3.0, 1.3).fill(pus(0x6E767C, 0.6));
  g.rect(kx - 0.8, ky + 0.8, 1.6, 1.3).fill(kule);
  g.rect(kx - 1.0, ky - 1.1, 2.0, 1.1).fill(pus(0x3A4046, 0.6));

  g.alpha = 0.85;
  return kapla(g);
}

/**
 * Stok sahası: kalaslar, jeneratör kaidesi ve kulübe tabanı — fizikteki
 * gövdelerin AYNISI — artı zemine boyalı yerler ve adları.
 */
export function drawStokSahasi(): Container {
  const g = new Graphics();
  const s = SANTIYE;
  const yazilar: Container[] = [];
  const etiket = (metin: string, x: number): void => {
    const et = worldText(metin, 0.28, { fill: 0xEBD79A });
    et.position.set(x, -0.16);
    yazilar.push(et);
  };

  // Sahanın zemini: sıkıştırılmış mıcır, takozdan çite kadar
  g.rect(s.kerbX + 0.4, -0.32, s.citX - s.kerbX - 0.4, 0.32).fill(0x7D776C);
  for (let x = s.kerbX + 0.6; x < s.citX; x += 0.37) {
    g.rect(x, -0.3 + ((x * 7.3) % 0.2), 0.08, 0.05).fill({ color: 0x5E5850, alpha: 0.7 });
  }

  // İstif yeri: iki kalas
  for (const x of s.takozlar) {
    g.rect(x - s.takozEn / 2, 0, s.takozEn, s.takozY).fill(0x9C7A48);
    g.rect(x - s.takozEn / 2, s.takozY - 0.04, s.takozEn, 0.04).fill(0xB8955E);
  }
  g.rect(s.istifX - 1.1, -0.06, 2.2, 0.06).fill({ color: C.hazardY, alpha: 0.9 });
  etiket(M.dekor.istif, s.istifX);

  // Jeneratör kaidesi: beton, kenarı pahlı
  g.rect(s.kaideSol, 0, s.kaideSag - s.kaideSol, s.kaideY).fill(C.concrete);
  g.rect(s.kaideSol, s.kaideY - 0.04, s.kaideSag - s.kaideSol, 0.04).fill(0xA7AEB2);
  etiket(M.dekor.kaide, (s.kaideSol + s.kaideSag) / 2);

  // Kulübe tabanı
  g.rect(s.kulubeSol, 0, s.kulubeSag - s.kulubeSol, s.kulubeY).fill(C.concreteD);
  etiket(M.dekor.kulube, (s.kulubeSol + s.kulubeSag) / 2);

  return kapla(g, ...yazilar);
}

/**
 * Şantiye çiti — kenarından görünüyor, yük bunun üstünden aşıyor.
 *
 * Yan görünümde çit tek bir ince şerit; okunabilsin diye tepesinde iş
 * güvenliği levhası ve kapı direği var. Levha çitin ÜSTÜNDE: yükü çitin
 * üstünden aşırmak zorunda olduğunu oyuncuya o söylüyor.
 */
export function drawCit(): Container {
  const g = new Graphics();
  const s = SANTIYE;
  const x = s.citX;
  g.rect(x, 0, s.citKalinlik, s.citY).fill(0x2E6B4E);
  for (let y = 0.2; y < s.citY; y += 0.45) {
    g.rect(x, y, s.citKalinlik, 0.05).fill({ color: 0x1E4A36, alpha: 0.9 });
  }
  // Kapı direği
  g.rect(x - 0.1, 0, 0.12, s.citY + 0.5).fill(0x3A4046);
  // Levha: direğin tepesinde, izleyiciye dönük
  g.roundRect(x - 1.15, s.citY + 0.5, 2.3, 0.72, 0.06).fill(0xF4F7F8);
  g.roundRect(x - 1.15, s.citY + 0.5, 2.3, 0.72, 0.06).stroke({ width: 0.05, color: C.liveryRed });
  const levha = worldText(M.dekor.baret, 0.22, { fill: C.liveryRed });
  levha.position.set(x, s.citY + 0.86);
  return kapla(g, levha);
}

/**
 * Teslimat kamyonu — dört akslı, açık kasa, kabini sokağın ucunda.
 *
 * Firma forkliftin dorsesini yükleyen firmayla AYNI: depodan çıkan mal
 * şantiyeye iniyor. Kabin gövdesi fizikte de var (bomun erişemeyeceği yerde
 * ama sallanan yük çarpabilir).
 */
export function drawTeslimatKamyonu(): Container {
  const c = new Container();
  const g = new Graphics();
  const s = SANTIYE;
  const tekerR = 0.52;

  // Sokak: çitin dışında asfalt ve kaldırım kenarı
  g.rect(s.citX + s.citKalinlik, -0.32, 60, 0.32).fill(0x4A5054);
  for (let x = s.citX + 2; x < s.citX + 60; x += 3) {
    g.rect(x, -0.2, 1.4, 0.06).fill({ color: 0xE8EEF0, alpha: 0.55 });
  }
  g.rect(s.citX + s.citKalinlik, -0.06, 0.4, 0.06).fill(0x8A9196);

  // Şasi ve kasa
  const boy = s.kasaOn - s.kasaArka;
  g.rect(s.kasaArka + 0.3, 0.72, boy + 2.2, 0.28).fill(0x23272C);
  g.rect(s.kasaArka, s.kasaY - s.kasaKalinlik - 0.28, boy, 0.3).fill(0x2F3E4C);
  g.rect(s.kasaArka, s.kasaY - s.kasaKalinlik, boy, s.kasaKalinlik).fill(C.deck);
  g.rect(s.kasaArka, s.kasaY - 0.04, boy, 0.04).fill(0x8B959B);
  // Yatık kapaklar: kasanın yanından sarkıyor
  for (let x = s.kasaArka + 0.1; x < s.kasaOn - 0.2; x += 2.05) {
    g.rect(x, s.kasaY - s.kasaKalinlik - 0.26, 1.95, 0.22).fill({ color: 0x3E5366, alpha: 0.9 });
  }
  // Arka tampon ve stop
  g.rect(s.kasaArka - 0.05, 0.5, 0.12, 0.55).fill(0x3A4046);
  g.rect(s.kasaArka - 0.02, 0.9, 0.1, 0.14).fill(0xC0282A);
  // Çamurluklar
  const arkaAks = [s.kasaArka + 2.6, s.kasaArka + 4.0];
  const onAks = [s.kabinSol + 0.8, s.kabinSol + 2.1];
  g.roundRect(arkaAks[0]! - 0.7, tekerR * 2 + 0.02, 2.8, 0.1, 0.04).fill(0x23272C);

  // Kabin: beyaz, kırmızı şerit — forkliftin dorsesini çeken firma
  const k0 = s.kabinSol;
  const k1 = s.kabinSag;
  g.roundRect(k0, 0.85, k1 - k0, s.kabinY - 0.85, 0.12).fill(0xE9ECEE);
  g.rect(k0, 0.85, 0.2, s.kabinY - 0.85).fill(0xC9CED2);
  g.roundRect(k1 - 1.0, 2.0, 0.85, 0.95, 0.06).fill(C.glass);
  g.rect(k1 - 0.95, 2.7, 0.75, 0.14).fill({ color: C.glassLight, alpha: 0.6 });
  g.rect(k1 - 0.1, 1.85, 0.1, 1.2).fill(C.glassLight);
  g.rect(k0, 1.35, k1 - k0, 0.2).fill(C.liveryRed);
  g.rect(k1 - 0.1, 0.35, 0.3, 0.6).fill(0x3A4046);
  g.rect(k1 + 0.02, 1.05, 0.12, 0.16).fill(0xF6EFC8);
  g.rect(k1, 2.55, 0.26, 0.05).fill(0x23272C);
  g.roundRect(k1 + 0.16, 2.2, 0.12, 0.5, 0.04).fill(0x23272C);
  for (const ax of onAks) {
    g.roundRect(ax - 0.66, tekerR * 2 + 0.02, 1.32, 0.1, 0.04).fill(0x23272C);
  }
  c.addChild(g);

  for (const ax of [...arkaAks, ...onAks]) {
    const t = drawWheel(tekerR);
    t.position.set(ax, tekerR);
    c.addChild(t);
  }
  const yazi = worldText('YILMAZ LOJİSTİK', 0.2, { fill: 0xE9ECEE, letterSpacing: 2 });
  yazi.position.set(s.kasaArka + boy * 0.5, s.kasaY - s.kasaKalinlik - 0.13);
  const kapi = worldText('YILMAZ', 0.18, { fill: C.liveryRed, letterSpacing: 1 });
  kapi.position.set(k1 - 0.9, 1.8);
  c.addChild(yazi, kapi);
  return c;
}
