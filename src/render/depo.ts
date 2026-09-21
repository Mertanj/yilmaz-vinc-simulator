import { Container, Graphics } from 'pixi.js';
import type { CepOlcumu } from '../sim/forklift';
import { C } from './palette';
import { worldText, kapla } from './text';
import {
  ADA_X, RAF_KATLARI, RAF_DERINLIK, GIRIS_X, PALET_AYAK, TESLIM_KOTU,
  BEKLEME_CIZGISI, RAF_STOGU, ZEMIN_BANDI, adresIndeksi, adresKotu, adresX,
  katAdi,
} from '../game/forkliftTasks';
import { drawLoad } from './missionView';
import { M } from '../ui/dil';

/**
 * Depo dekoru.
 *
 * Vinç sahnesinde mekân bir sanayi avlusuydu; burada kapalı bir depo. Fark
 * kozmetik değil: forkliftin bütün zorluğu YATAY mesafede (yük merkezi) ve
 * DÜŞEY kotta (raf katı) olduğu için dekorun da bu iki ekseni okunur kılması
 * gerekiyor. Raf katlarının kotu fizikten okunuyor, tekrar yazılmıyor.
 */

/**
 * Rafların çizimi — üç ada, fizikteki kirişlerle aynı kotlarda.
 *
 * Kotlar `RAF_KATLARI`'ndan okunuyor, burada tekrar yazılmıyor: bu depoda
 * aynı sınıftan bir hata bir kez oldu (görev metni iki yerde durup sessizce
 * ayrıştı), ve rafın çizimi ile rafın fiziği ayrışırsa oyuncu var olmayan
 * bir kirişin üstüne palet koymaya çalışır.
 */
export function drawRaf(): Container {
  const c = new Container();
  const g = new Graphics();
  const ust = (RAF_KATLARI[RAF_KATLARI.length - 1] ?? 4.8) + 1.1;

  ADA_X.forEach((on, ada) => {
    const arka = on + RAF_DERINLIK;

    // Dikmeler — delikli çelik profil, önde ve arkada
    for (const x of [on - 0.1, arka + 0.1]) {
      g.rect(x - 0.1, 0, 0.2, ust).fill(C.rack);
      g.rect(x - 0.1, 0, 0.07, ust).fill({ color: C.rackLight, alpha: 0.85 });
      for (let y = 0.3; y < ust; y += 0.32) {
        g.rect(x - 0.035, y, 0.07, 0.11).fill({ color: C.rackDark, alpha: 0.85 });
      }
      g.rect(x - 0.19, 0, 0.38, 0.09).fill(C.rackDark);
      // Dikme koruyucusu: her depoda vardır, sarıdır, çarpmadan yer.
      g.rect(x - 0.15, 0, 0.3, 0.42).fill({ color: C.hazardY, alpha: 0.9 });
      g.rect(x - 0.15, 0.16, 0.3, 0.06).fill({ color: 0x1D2226, alpha: 0.5 });
    }
    // Çaprazlar — iki dikme arasında, derinlik hissi
    for (let y = 0.3; y < ust - 0.8; y += 1.05) {
      g.moveTo(on, y).lineTo(arka, y + 0.62)
        .stroke({ width: 0.055, color: C.rackDark, alpha: 0.42 });
      g.moveTo(arka, y).lineTo(on, y + 0.62)
        .stroke({ width: 0.055, color: C.rackDark, alpha: 0.28 });
    }

    RAF_KATLARI.forEach((kot, kat) => {
      const i = adresIndeksi(ada, kat);
      if (kot > 0.001) {
        g.rect(on, kot - 0.16, RAF_DERINLIK, 0.16).fill(C.rack);
        g.rect(on, kot - 0.16, RAF_DERINLIK, 0.05).fill({ color: C.rackLight, alpha: 0.9 });
        g.rect(on, kot - 0.04, RAF_DERINLIK, 0.04).fill(C.rackDark);
        // Arka dayanak
        g.rect(arka - 0.07, kot, 0.14, 0.52).fill(C.rackDark);
      }
      // **Göz adresi: yalnızca ADRES, kot değil.**
      //
      // Önce "A1 · 3.00 m" yazıyordu ve iki kez çakıştı: kirişin üstünde
      // paletin arkasına giriyor, altında ise sarı hedef üçgeninin tam
      // üstüne düşüyordu — oyuncu işaretin hangi katı gösterdiğini yazıdan
      // ayırt edemiyordu. Gerçek rafta da gözün üstünde ADRES yazar, kot
      // değil; kotu zaten brifing ve HUD söylüyor ("B1, 3.00 m").
      //
      // Yeri gözün ARKA ucu: en geniş palet (yarı en 0.95) ön yüzden
      // 2.00 metreye kadar uzanıyor, etiket 2.25'te başlıyor.
      const et = worldText(katAdi(i), 0.3, { fill: 0xD6E2EA });
      et.anchor.set(0.5, 0);
      et.scale.y = -Math.abs(et.scale.y);
      et.position.set(on + RAF_DERINLIK - 0.35, Math.max(kot, 0.02) + 0.1);
      c.addChild(et);
    });

    // Ada harfi — dikmenin üstünde, uzaktan okunacak kadar büyük.
    const harf = worldText(katAdi(adresIndeksi(ada, 1)).slice(0, 1), 0.62,
      { fill: C.hazardY });
    harf.position.set(on + RAF_DERINLIK / 2 - 0.2, ust + 0.25);
    c.addChild(harf);
  });

  c.addChildAt(g, 0);
  // Önceden konmuş stok EN ARKADA: gözün derinliğinde duruyor.
  c.addChildAt(drawStok(), 0);
  return c;
}

/**
 * Bir paleti "gözün derinliğinde" gösteren dönüşüm.
 *
 * Konan palet artık hiçbir şeyle çarpışmıyor (bkz. `MASKE.stok`) ve bunun
 * görsel karşılığı olmalı, yoksa makine paletin içinden geçiyormuş gibi
 * görünür. Derinliğe itilmiş bir şey biraz yukarıda, biraz sağda, biraz
 * küçük ve biraz loş görünür — üç tanesi birden, çünkü tek başına hiçbiri
 * yetmiyor.
 */
export function derinlige(c: Container): Container {
  c.position.set(c.position.x + 0.42, c.position.y + 0.2);
  c.scale.set(0.93);
  c.alpha = 0.72;
  return c;
}

/** Bölüm başlamadan önce raflarda duran mal. Tamamen dekor. */
function drawStok(): Container {
  const c = new Container();
  for (const s of RAF_STOGU) {
    const kot = adresKotu(s.hedef);
    const on = adresX(s.hedef);
    if (kot === undefined || on === undefined) continue;
    const kutu = new Container();
    const yuk = drawLoad({
      kod: '', ad: '', tonnes: 0, kind: s.kind, hedef: s.hedef,
      halfWidth: s.halfWidth, halfHeight: s.halfHeight, brif: '',
    }, { etiket: false });
    const palet = drawPalet(s.halfWidth);
    palet.position.set(0, -s.halfHeight);
    kutu.addChild(palet, yuk);
    kutu.position.set(on + s.halfWidth + 0.06, kot + PALET_AYAK + s.halfHeight);
    c.addChild(derinlige(kutu));
  }
  return c;
}

/**
 * Depo zemini — **boyalı**.
 *
 * Sahadan gelen şikâyet: *"harita tam net değil."* Zemin tek parça düz
 * betondu; ne koridorun nerede olduğu, ne nerede durulacağı, ne de hangi
 * gözün hangisi olduğu okunuyordu. Gerçek bir depoda bunların hepsi
 * ZEMİNE BOYALIDIR ve operatör yolunu oradan bulur.
 *
 * Yan görünümde zemin çizgisi tek bir çizgi; boya nereye gidecek? Sahnenin
 * zaten kullandığı sözleşmeyi sürdürüyoruz: **y = 0'ın ALTI, izleyiciye
 * doğru uzanan zemin.** Beton derzleri en baştan böyle çiziliyordu. Boyalar
 * da o bandın içinde, uzaklaştıkça incelerek duruyor — yani bant bir
 * perspektif şeridi gibi okunuyor.
 */
export function drawDepoZemin(left: number, right: number): Container {
  const g = new Graphics();
  const yazilar: Container[] = [];
  // Zeminin kendisi ve kenar pahı
  g.rect(left, -8, right - left, 8).fill(C.depoFloor);
  g.rect(left, -0.06, right - left, 0.06).fill(C.depoFloorD);
  // **Boyalı bandın ALTI karartılıyor.** Telefonda ölçüldü: ekran kumandası
  // için ayrılan alt pay (166 px) artı bandın sonu, dikey telefonda ekranın
  // %28'ini düz gri bir alan yapıyordu — oyun alanı ortada ince bir şerit
  // gibi duruyordu. Karartma o şeridi "bitmiş zemin" yerine kadrajın kenarı
  // gibi okutuyor ve düğmelerin kontrastını da artırıyor.
  const bant = 14;
  for (let i = 0; i < bant; i++) {
    const t = i / (bant - 1);
    g.rect(left, ZEMIN_BANDI * -1 - (5.7 * (i + 1)) / bant,
      right - left, 5.7 / bant + 0.02)
      .fill(karistir(C.depoFloor, 0x0B0F12, t));
  }
  // Beton derzleri — döküm kareleri
  for (let x = Math.ceil(left / 4) * 4; x < right; x += 4) {
    g.moveTo(x, 0).lineTo(x, -2.3).stroke({ width: 0.04, color: C.depoFloorD, alpha: 0.7 });
  }
  g.moveTo(left, -2.3).lineTo(right, -2.3)
    .stroke({ width: 0.04, color: C.depoFloorD, alpha: 0.5 });

  // --- 1. Koridor şeritleri: sürüş yolunun iki kenarı ---
  // İkisi arasındaki bant makinenin yeri; rafın önündeki dar şerit ise
  // yaya değil, çalışma alanı.
  for (const [y, kalinlik, alfa] of [[-0.30, 0.09, 0.85], [-1.62, 0.09, 0.7]] as const) {
    g.rect(left, y, right - left, kalinlik).fill({ color: C.hazardY, alpha: alfa });
  }

  // --- 2. Yaya yolu: yeşil boya, beyaz kenar — her modern depoda var ---
  g.rect(left, -2.22, right - left, 0.52).fill({ color: 0x2C6E4A, alpha: 0.75 });
  for (const y of [-2.24, -1.74]) {
    g.rect(left, y, right - left, 0.045).fill({ color: 0xE8EEF0, alpha: 0.65 });
  }

  // --- 3. Yön okları: koridor tek yönlü ---
  for (let x = left + 4; x < right - 2; x += 7) {
    okCiz(g, x, -0.96, 0.62);
  }

  // --- 4. Adaların önündeki taralı çalışma alanı ---
  // Sarı-siyah tarama "burada durma, burası makinenin çalışma alanı" demek.
  ADA_X.forEach((on, ada) => {
    taraliAlan(g, on - 2.9, on - 0.2, -0.22, -0.62);
    // Zemin gözünün ayak izi: paletin konacağı dikdörtgen.
    const zeminAdres = adresIndeksi(ada, 0);
    g.rect(on, -0.16, RAF_DERINLIK, 0.07).fill({ color: C.hazardY, alpha: 0.9 });
    for (const x of [on, on + RAF_DERINLIK - 0.07]) {
      g.rect(x, -1.05, 0.07, 0.95).fill({ color: C.hazardY, alpha: 0.9 });
    }
    g.rect(on, -1.05, RAF_DERINLIK, 0.07).fill({ color: C.hazardY, alpha: 0.9 });
    // Gözün adresi zemine stensille yazılır; rafın üstündekiyle AYNI dizeden.
    // Arkasında koyu bir plaka var: yazı tam sarı koridor şeridinin üstüne
    // denk geliyordu ve çizgiyle kesişince okunmuyordu.
    g.roundRect(on + RAF_DERINLIK / 2 - 0.55, -0.86, 1.1, 0.46, 0.05)
      .fill({ color: 0x141A1E, alpha: 0.55 });
    const et = worldText(katAdi(zeminAdres), 0.42, { fill: 0xEBD79A });
    et.position.set(on + RAF_DERINLIK / 2, -0.62);
    et.anchor.set(0.5, 0.5);
    et.scale.y = Math.abs(et.scale.y) * -0.55;
    et.scale.x = Math.abs(et.scale.x);
    yazilar.push(et);
  });

  // --- 5. Yükleme karesi: paletler buraya iniyor ---
  g.rect(GIRIS_X - 1.6, -0.16, 3.2, 0.08).fill({ color: C.hazardY, alpha: 0.95 });
  g.rect(GIRIS_X - 1.6, -1.15, 3.2, 0.08).fill({ color: C.hazardY, alpha: 0.95 });
  for (const x of [GIRIS_X - 1.6, GIRIS_X + 1.52]) {
    g.rect(x, -1.15, 0.08, 1.07).fill({ color: C.hazardY, alpha: 0.95 });
  }
  taraliAlan(g, GIRIS_X - 1.52, GIRIS_X + 1.52, -0.24, -1.07, 0.3);

  // --- 6. Bekleme çizgisi: paletin inmesi için buranın batısında dur ---
  // Kural zaten vardı ama GÖRÜNMÜYORDU: oyuncuya "yükleme karesinin
  // batısına geç" deniyor, nereye kadar olduğu söylenmiyordu.
  g.rect(BEKLEME_CIZGISI - 0.07, -2.3, 0.14, 2.3)
    .fill({ color: 0xE8EEF0, alpha: 0.9 });
  for (let y = -2.25; y < -0.1; y += 0.34) {
    g.rect(BEKLEME_CIZGISI - 0.07, y, 0.14, 0.17)
      .fill({ color: C.liveryRed, alpha: 0.95 });
  }
  const bekle = worldText('DUR', 0.36, { fill: 0xE8EEF0 });
  bekle.position.set(BEKLEME_CIZGISI - 0.95, -0.52);
  bekle.anchor.set(0.5, 0.5);
  bekle.scale.y = Math.abs(bekle.scale.y) * -0.55;
  bekle.scale.x = Math.abs(bekle.scale.x);
  yazilar.push(bekle);

  return kapla(g, ...yazilar);
}

/** Zemine boyalı tek yönlü ok. */
function okCiz(g: Graphics, x: number, y: number, boy: number): void {
  const w = boy * 0.5;
  g.moveTo(x, y - w).lineTo(x + boy * 0.55, y - w)
    .lineTo(x + boy * 0.55, y - w * 1.5)
    .lineTo(x + boy, y)
    .lineTo(x + boy * 0.55, y + w * 1.5)
    .lineTo(x + boy * 0.55, y + w)
    .lineTo(x, y + w)
    .fill({ color: C.hazardY, alpha: 0.5 });
}

/** Sarı-siyah tarama: "makinenin çalışma alanı, yaya girmez". */
function taraliAlan(g: Graphics, x0: number, x1: number, y0: number, y1: number,
                    alfa = 0.34): void {
  const h = y0 - y1;
  for (let x = x0; x < x1; x += 0.42) {
    const w = Math.min(0.2, x1 - x);
    g.moveTo(x, y0).lineTo(x + w, y0).lineTo(x + w - h, y1).lineTo(x - h, y1)
      .fill({ color: C.hazardY, alpha: alfa });
  }
}

/**
 * Arka duvar, çatı makasları ve sevkiyat kapısı.
 *
 * Duvar KAMERANIN görebileceğinden yüksek: ilk sürümde 9.2 metrede bitiyordu
 * ve ekranın üst yarısı boş kalıyordu — kapalı bir mekânda bu, deponun
 * tavanının olmadığı izlenimi veriyordu.
 */
export function drawDepoIci(left: number, right: number): Container {
  const c = new Container();
  const g = new Graphics();
  const tavan = 7.4;
  const ust = 22;

  // Arka duvar — sandviç panel, tavana kadar
  g.rect(left, 0, right - left, tavan).fill(C.depoWall);
  for (let x = left; x < right; x += 1.2) {
    g.rect(x, 0, 0.05, tavan).fill({ color: C.depoWallD, alpha: 0.6 });
  }
  // Tavan boşluğu: makasların arası, yukarı doğru koyulaşıyor
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    g.rect(left, tavan + ((ust - tavan) * i) / 10, right - left, (ust - tavan) / 10 + 0.05)
      .fill(karistir(0x6F767C, 0x262D33, t));
  }
  g.rect(left, tavan - 0.34, right - left, 0.34).fill(C.depoWallD);

  // Çatı makasları
  for (let x = Math.ceil(left / 6) * 6; x < right; x += 6) {
    g.moveTo(x, tavan).lineTo(x, tavan + 2.1)
      .stroke({ width: 0.11, color: C.roof, alpha: 0.9 });
    g.moveTo(x - 3, tavan + 1.2).lineTo(x + 3, tavan + 1.2)
      .stroke({ width: 0.09, color: C.roof, alpha: 0.75 });
    // Çapraz
    g.moveTo(x - 3, tavan + 1.2).lineTo(x, tavan + 2.1)
      .stroke({ width: 0.06, color: C.roof, alpha: 0.5 });
  }
  g.rect(left, tavan + 2.1, right - left, 0.4).fill(C.roof);
  // Aydınlatma armatürleri — tavandan sarkan sıra
  for (let x = Math.ceil(left / 5) * 5; x < right; x += 5) {
    g.rect(x - 0.05, tavan + 1.5, 0.1, 0.6).fill(C.roof);
    g.roundRect(x - 0.42, tavan + 1.28, 0.84, 0.22, 0.08).fill(0xF5F0DC);
  }

  // Işıklıklar — düz duvar ölü duruyordu
  for (let x = left + 2; x < right - 2; x += 5) {
    g.rect(x, 4.5, 2.2, 1.5).fill({ color: 0xE9F1F4, alpha: 0.55 });
    g.rect(x, 4.5, 2.2, 1.5).stroke({ width: 0.05, color: C.depoWallD, alpha: 0.7 });
  }

  // **Koridorun iki ucundaki duvarlar.** Fizikte vardı (makine orada
  // duruyor) ama çizilmiyordu: oyun testinde batı ucunda ekranın %43'ü
  // bomboş gri kalıyor ve makine görünmeyen bir kenara dayanıp duruyordu.
  for (const [x, yon] of [[left, 1], [right, -1]] as const) {
    g.rect(x - (yon > 0 ? 0.55 : 0), 0, 0.55, tavan).fill(C.depoWallD);
    g.rect(x + (yon > 0 ? 0 : -0.14), 0, 0.14, tavan)
      .fill({ color: 0x6E767C, alpha: 0.9 });
    // Çarpma bariyeri: her deponun duvar dibinde vardır, sarı-siyahtır.
    for (let i = 0; i < 5; i++) {
      g.rect(x + (yon > 0 ? 0.14 : -0.5), i * 0.22, 0.36, 0.11)
        .fill({ color: i % 2 === 0 ? C.hazardY : 0x1D2226, alpha: 0.95 });
    }
  }

  // Sevkiyat kapısı — soldaki giriş
  g.rect(left + 1.4, 0, 3.6, 4.2).fill(C.depoWallD);
  for (let y = 0.2; y < 4.1; y += 0.42) {
    g.rect(left + 1.5, y, 3.4, 0.34).fill({ color: 0x9AA2A7, alpha: 0.95 });
  }

  const tabela = worldText(M.dekor.sevkiyat, 0.5, { fill: C.liveryRed });
  // Tabela doğuya kaydırıldı: yatay telefonda kadrajın sol kenarından taşıp
  // yarısı kesiliyordu (ölçüm: görünen alan x −4.7…13.7, tabela −5.6).
  tabela.position.set(left + 9.5, 5.0);
  c.addChild(tabela);

  c.addChildAt(g, 0);
  return c;
}

/**
 * Mal kabul konveyörü — paletler buradan iniyor.
 *
 * Oyuncuya "yeni palet nereden gelecek" sorusunun cevabını veriyor. Palet
 * makine yükleme karesinin batısına geçince iniyor; ağzın altındaki sarı kare
 * de nereye ineceğini söylüyor.
 */
export function drawKonveyor(): Container {
  const c = new Container();
  const g = new Graphics();
  const y = TESLIM_KOTU + 0.5;
  // Tavandan sarkan askılar
  for (const x of [GIRIS_X - 1.5, GIRIS_X + 1.5]) {
    g.rect(x - 0.05, y + 0.3, 0.1, 2.6).fill(C.roof);
  }
  // Konveyör gövdesi ve rulolar
  g.rect(GIRIS_X - 1.7, y, 3.4, 0.34).fill(C.mast);
  g.rect(GIRIS_X - 1.7, y + 0.28, 3.4, 0.06).fill(C.mastLight);
  for (let x = GIRIS_X - 1.5; x < GIRIS_X + 1.5; x += 0.34) {
    g.circle(x, y + 0.14, 0.1).fill(C.mastLight);
    g.circle(x, y + 0.14, 0.04).fill(C.mast);
  }
  // Ağız: paletin çıktığı boşluk
  g.rect(GIRIS_X - 0.75, y - 0.12, 1.5, 0.12).fill(C.rackDark);

  const et = worldText(M.dekor.malKabul, 0.3, { fill: C.hazardY });
  et.position.set(GIRIS_X - 1.55, y + 0.45);
  c.addChild(et);
  c.addChildAt(g, 0);
  return c;
}

/** Yükün altındaki palet — çatalın nereye gireceğini gösteriyor. */
export function drawPalet(hw: number): Graphics {
  const g = new Graphics();
  const h = PALET_AYAK;
  g.rect(-hw, -h, hw * 2, h).fill(C.pallet);
  g.rect(-hw, -h, hw * 2, 0.04).fill({ color: 0xC9A470, alpha: 0.8 });
  // Takozlar: çatal bunların ARASINDAN giriyor. Yandan bakınca bıçak
  // takozun içinden geçiyormuş gibi görünür; fizikte de ayaklar çatalla
  // çarpışmıyor, çünkü gerçekte farklı derinlikteler.
  for (const x of [-hw + 0.02, -0.16, hw - 0.34]) {
    g.rect(x, -h + 0.05, 0.32, h - 0.09).fill(C.palletDark);
  }
  g.rect(-hw, -h, hw * 2, 0.05).fill(C.palletDark);
  return g;
}

/**
 * Deponun iç hacmi — gökyüzünün kapalı mekân karşılığı.
 *
 * Vinç sahnesinde arka planda gökyüzü var; burada olamaz, çatının üstünü
 * göremeyiz. Bunun yerine yukarı doğru koyulaşan bir iç hacim: ışık aşağıda,
 * makasların arası karanlık.
 */
export function drawDepoArkaPlan(width: number, height: number): Graphics {
  const g = new Graphics();
  const bant = 26;
  for (let i = 0; i < bant; i++) {
    const t = i / (bant - 1);
    const c = karistir(0x232A30, 0x8D969C, t);
    g.rect(0, (height * i) / bant, width, height / bant + 1).fill(c);
  }
  return g;
}

function karistir(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16)
    | (Math.round(ag + (bg - ag) * t) << 8)
    | Math.round(ab + (bb - ab) * t);
}

/**
 * Çatalın palet cebindeki derinliğini PALETİN ÜSTÜNDE gösteren şerit.
 *
 * Panelde "yük merkezi 0.95 m" yazıyordu ve bu doğru bir sayıydı ama yanlış
 * zamanda: oyuncu onu ancak yükü kaldırdıktan sonra görüyordu, yani hatayı
 * düzeltemeyeceği anda. Bölümün bütün zorluğu bıçağın cebe ne kadar
 * girdiğinde olduğu için, ölçüm oyuncunun BAKTIĞI yerde durmalı.
 *
 * Renk üç durumu anlatıyor: bıçak kotu tutmuyorsa gri (önce kotu tuttur),
 * tutuyor ama sığsa amber, dibe kadar girdiyse yeşil.
 */
export class CepGostergesi extends Container {
  private readonly g = new Graphics();
  private readonly yazi = worldText('', 0.2, { fill: 0xF4F7F8 });

  constructor() {
    super();
    this.addChild(this.g, this.yazi);
  }

  guncelle(o: CepOlcumu | null): void {
    this.visible = o !== null && o.tam > 0.1;
    if (!o) return;
    const oran = Math.min(1, o.giren / o.tam);
    // Dibe kadar = %90 ve üstü: bıçağın ucu paletin uzak yüzüne varmış
    // demek. Tam %100 istemek imkânsıza yakın; gerçek operatör de paleti
    // sırtlığa dayayınca "girdi" sayar.
    const renk = !o.hizada ? 0x8B959B : oran >= 0.9 ? 0x39B36A : C.hazardY;
    const h = 0.16;
    this.g.clear();
    this.g.roundRect(o.x, o.y - h / 2, o.tam, h, 0.04)
      .fill({ color: 0x0E1417, alpha: 0.55 });
    if (oran > 0.01) {
      this.g.roundRect(o.x, o.y - h / 2, o.tam * oran, h, 0.04)
        .fill({ color: renk, alpha: 0.92 });
    }
    this.g.roundRect(o.x, o.y - h / 2, o.tam, h, 0.04)
      .stroke({ width: 0.025, color: renk, alpha: 0.9 });
    // Dibin işareti: buraya kadar girmek yük merkezini en kısa yapıyor.
    this.g.rect(o.x + o.tam * 0.9 - 0.015, o.y - h / 2 - 0.05, 0.03, h + 0.1)
      .fill({ color: 0xF4F7F8, alpha: 0.75 });

    // Yazı şeridin ALTINDA: üstünde tonaj plakasıyla üst üste biniyordu ve
    // ikisi de okunmuyordu. Arkasında koyu bir plaka var, çünkü zemin de
    // palet de açık renk.
    const yaziY = o.y - 0.26;
    this.g.roundRect(o.x + o.tam / 2 - 0.36, yaziY - 0.13, 0.72, 0.26, 0.04)
      .fill({ color: 0x0E1417, alpha: 0.7 });
    this.yazi.text = `${o.merkez.toFixed(2)} m`;
    this.yazi.style.fill = renk;
    this.yazi.position.set(o.x + o.tam / 2, yaziY);
  }
}

/**
 * Yük yere/kirişe otururken kalkan toz.
 *
 * Bırakma anı sessizdi: palet duruyordu, ekranda hiçbir şey olmuyordu ve
 * oyuncu "oturdu mu" sorusunu ancak HUD'dan öğreniyordu. Toz o anı yükün
 * KENDİSİNDE gösteriyor — sahada da bir paleti betona koyunca kalkan şey o.
 */
export class TozBulutu extends Container {
  private readonly g = new Graphics();
  private readonly zerreler: Array<{ x: number; y: number; vx: number; vy: number;
    r: number; omur: number; yas: number }> = [];

  constructor() {
    super();
    this.addChild(this.g);
  }

  /** @param siddet 0–1; düşüş hızından geliyor. */
  patlat(x: number, y: number, en: number, siddet: number): void {
    const adet = Math.round(6 + siddet * 10);
    for (let i = 0; i < adet; i++) {
      const yon = Math.random() < 0.5 ? -1 : 1;
      this.zerreler.push({
        x: x + (Math.random() - 0.5) * en,
        y: y + Math.random() * 0.06,
        vx: yon * (0.5 + Math.random() * 1.4) * (0.4 + siddet),
        vy: (0.25 + Math.random() * 0.7) * (0.4 + siddet),
        r: 0.05 + Math.random() * 0.1,
        omur: 0.5 + Math.random() * 0.5,
        yas: 0,
      });
    }
  }

  sur(dt: number): void {
    this.g.clear();
    for (let i = this.zerreler.length - 1; i >= 0; i--) {
      const z = this.zerreler[i];
      if (!z) continue;
      z.yas += dt;
      if (z.yas >= z.omur) { this.zerreler.splice(i, 1); continue; }
      z.x += z.vx * dt;
      z.y += z.vy * dt;
      // Toz yerden kalkar, yavaşlar ve asılı kalır — düşmez.
      z.vx *= 1 - Math.min(1, dt * 2.2);
      z.vy *= 1 - Math.min(1, dt * 3.4);
      const t = z.yas / z.omur;
      this.g.circle(z.x, z.y, z.r * (1 + t * 1.6))
        .fill({ color: 0xC9C2B2, alpha: 0.4 * (1 - t) });
    }
  }
}

/**
 * Deponun BATI yarısı — sevkiyat hazırlık alanı.
 *
 * Depo 56 metre uzunluğunda; bölüm bunun doğu yarısında geçiyor ve batı
 * yarısı bomboş griydi. Sahadan gelen *"harita tam net değil"* cümlesinin
 * üçüncü parçası buydu: bir mekânın ölçeği ancak İÇİ DOLUYSA okunuyor, boş
 * bir koridor sadece uzun bir koridor.
 *
 * Hepsi dekor ve hepsi arka planda: koridorun gerisinde, duvarın önünde
 * duruyorlar. Makine önlerinden geçiyor — `derinlige` ile aynı mantık,
 * çünkü yan görünümde derinlik ancak böyle anlatılıyor.
 */
export function drawSevkiyatAlani(left: number, right: number): Container {
  const c = new Container();
  const g = new Graphics();

  // --- Sevkiyata hazır istifler: yerde, streçlenmiş, adresli ---
  const istifX = [left + 7.5, left + 11.2, left + 14.6, left + 18.4];
  istifX.forEach((x, i) => {
    if (x > right - 2) return;
    const kat = 2 + (i % 2);
    const en = 0.85 + (i % 3) * 0.12;
    for (let k = 0; k < kat; k++) {
      const y = k * 1.02;
      // Palet
      g.rect(x - en, y, en * 2, 0.18).fill(C.palletDark);
      g.rect(x - en, y + 0.13, en * 2, 0.05).fill(C.pallet);
      for (const px of [x - en + 0.05, x - 0.16, x + en - 0.37]) {
        g.rect(px, y, 0.3, 0.13).fill(C.pallet);
      }
      // Streçlenmiş yük. Renkler istife göre değişiyor: dört istif de aynı
      // griyken alan tek bir leke gibi okunuyor, oysa hazırlık alanının işi
      // "burada AYRI AYRI siparişler duruyor" demek.
      const govde = [0xB9A882, 0xA8A79C, 0xC2B490, 0x9FA6A0][i % 4] ?? 0xA8A79C;
      g.rect(x - en + 0.04, y + 0.16, en * 2 - 0.08, 0.8)
        .fill(k % 2 === 0 ? govde : karistir(govde, 0x3A3F44, 0.18));
      g.rect(x - en + 0.04, y + 0.16, en * 2 - 0.08, 0.8)
        .fill({ color: 0xE8EEF0, alpha: 0.14 });
      // Streç kayışı ve sevkiyat etiketi
      g.rect(x - en + 0.04, y + 0.62, en * 2 - 0.08, 0.05)
        .fill({ color: 0x6E7B84, alpha: 0.55 });
      g.rect(x - en * 0.5, y + 0.28, 0.4, 0.26)
        .fill({ color: 0xF0F3F4, alpha: 0.85 });
    }
    // İstif adresi zemine boyalı
    const et = worldText(`S${i + 1}`, 0.34, { fill: 0xD6E2EA });
    et.position.set(x, kat * 1.02 + 0.34);
    et.anchor.set(0.5, 0);
    c.addChild(et);
  });

  // --- Akü şarj istasyonu: her deponun bir köşesinde vardır ---
  const sarjX = left + 3.6;
  g.rect(sarjX - 0.9, 0, 1.8, 1.9).fill(0x3A4046);
  g.rect(sarjX - 0.9, 1.6, 1.8, 0.3).fill(0x4C545B);
  for (let i = 0; i < 3; i++) {
    g.rect(sarjX - 0.7, 0.25 + i * 0.45, 1.4, 0.3).fill({ color: 0x1E2226, alpha: 0.9 });
    g.circle(sarjX + 0.5, 0.4 + i * 0.45, 0.06)
      .fill({ color: i === 0 ? 0x39B36A : 0xE8A62C, alpha: 0.95 });
  }
  g.rect(sarjX - 0.06, 1.9, 0.12, 1.3).fill(C.roof);
  const sarj = worldText('ŞARJ · CHARGING', 0.26, { fill: C.hazardY });
  sarj.position.set(sarjX - 0.9, 2.05);
  c.addChild(sarj);

  // --- Streç sarma makinesi ---
  const strecX = left + 22.4;
  if (strecX < right - 2) {
    g.rect(strecX - 1.1, 0, 2.2, 0.12).fill(0x4C545B);
    g.circle(strecX, 0.35, 0.95).fill({ color: 0x565E65, alpha: 0.9 });
    g.circle(strecX, 0.35, 0.95).stroke({ width: 0.05, color: 0x6E767D });
    g.rect(strecX + 1.05, 0, 0.22, 2.6).fill(0x3A4046);
    g.rect(strecX + 0.75, 1.1, 0.55, 0.5).fill({ color: 0x8B959B, alpha: 0.9 });
    g.rect(strecX - 1.0, 0.5, 2.0, 1.1).fill({ color: 0xDCE4E8, alpha: 0.35 });
  }

  // Hepsi geride dursun: koridor önde, hazırlık alanı arkada.
  g.alpha = 0.82;
  c.addChildAt(g, 0);
  c.alpha = 0.92;
  return c;
}
