import { Container, Graphics } from 'pixi.js';
import type { CepOlcumu } from '../sim/forklift';
import { C } from './palette';
import { worldText, kapla } from './text';
import { RAF_DERINLIK, PALET_AYAK, ZEMIN_BANDI } from '../game/forkliftTasks';
import {
  adresIndeksi, adresKotu, adresX, katAdi, type ForkliftBolum,
} from '../game/forkliftBolum';
import { ON_DUVAR } from '../sim/forkliftSahne';
import { drawLoad } from './missionView';
import { drawWheel } from './truckView';
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
 * Kotlar `b.katlar`'ndan okunuyor, burada tekrar yazılmıyor: bu depoda
 * aynı sınıftan bir hata bir kez oldu (görev metni iki yerde durup sessizce
 * ayrıştı), ve rafın çizimi ile rafın fiziği ayrışırsa oyuncu var olmayan
 * bir kirişin üstüne palet koymaya çalışır.
 */
export function drawRaf(b: ForkliftBolum): Container {
  const c = new Container();
  const g = new Graphics();
  const ust = (b.katlar[b.katlar.length - 1] ?? 4.8) + 1.1;

  b.adaX.forEach((on, ada) => {
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

    b.katlar.forEach((kot, kat) => {
      const i = adresIndeksi(b, ada, kat);
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
      const et = worldText(katAdi(b, i), 0.3, { fill: 0xD6E2EA });
      et.anchor.set(0.5, 0);
      et.scale.y = -Math.abs(et.scale.y);
      et.position.set(on + RAF_DERINLIK - 0.35, Math.max(kot, 0.02) + 0.1);
      c.addChild(et);
    });

    // Ada harfi — dikmenin üstünde, uzaktan okunacak kadar büyük.
    const harf = worldText(katAdi(b, adresIndeksi(b, ada, 1)).slice(0, 1), 0.62,
      { fill: C.hazardY });
    harf.position.set(on + RAF_DERINLIK / 2 - 0.2, ust + 0.25);
    c.addChild(harf);
  });

  c.addChildAt(g, 0);
  // Önceden konmuş stok EN ARKADA: gözün derinliğinde duruyor.
  c.addChildAt(drawStok(b), 0);
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
function drawStok(b: ForkliftBolum): Container {
  const c = new Container();
  for (const s of b.stok) {
    const kot = adresKotu(b, s.hedef);
    const on = adresX(b, s.hedef);
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
export function drawDepoZemin(b: ForkliftBolum): Container {
  const g = new Graphics();
  const yazilar: Container[] = [];
  const left = b.bati;
  // Dorse bölümünde depo RAMPADA bitiyor; ötesi dorsenin kendisi.
  const right = b.dorse?.arka ?? b.dogu;
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
  b.adaX.forEach((on, ada) => {
    taraliAlan(g, on - 2.9, on - 0.2, -0.22, -0.62);
    // Zemin gözünün ayak izi: paletin konacağı dikdörtgen.
    const zeminAdres = adresIndeksi(b, ada, 0);
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
    const et = worldText(katAdi(b, zeminAdres), 0.42, { fill: 0xEBD79A });
    et.position.set(on + RAF_DERINLIK / 2, -0.62);
    et.anchor.set(0.5, 0.5);
    et.scale.y = Math.abs(et.scale.y) * -0.55;
    et.scale.x = Math.abs(et.scale.x);
    yazilar.push(et);
  });

  // --- 5 + 6. Mal kabul: yükleme karesi ve bekleme çizgisi ---
  // Yalnız paletleri konveyörden gelen bölümlerde; dorse bölümünde mal
  // raflardan alınıyor ve orada boyalı bir yükleme karesi yalan söylerdi.
  const mk = b.malKabul;
  if (mk) {
    g.rect(mk.x - 1.6, -0.16, 3.2, 0.08).fill({ color: C.hazardY, alpha: 0.95 });
    g.rect(mk.x - 1.6, -1.15, 3.2, 0.08).fill({ color: C.hazardY, alpha: 0.95 });
    for (const x of [mk.x - 1.6, mk.x + 1.52]) {
      g.rect(x, -1.15, 0.08, 1.07).fill({ color: C.hazardY, alpha: 0.95 });
    }
    taraliAlan(g, mk.x - 1.52, mk.x + 1.52, -0.24, -1.07, 0.3);

    // Kural zaten vardı ama GÖRÜNMÜYORDU: oyuncuya "yükleme karesinin
    // batısına geç" deniyor, nereye kadar olduğu söylenmiyordu.
    g.rect(mk.beklemeCizgisi - 0.07, -2.3, 0.14, 2.3)
      .fill({ color: 0xE8EEF0, alpha: 0.9 });
    for (let y = -2.25; y < -0.1; y += 0.34) {
      g.rect(mk.beklemeCizgisi - 0.07, y, 0.14, 0.17)
        .fill({ color: C.liveryRed, alpha: 0.95 });
    }
    const bekle = worldText('DUR', 0.36, { fill: 0xE8EEF0 });
    bekle.position.set(mk.beklemeCizgisi - 0.95, -0.52);
    bekle.anchor.set(0.5, 0.5);
    bekle.scale.y = Math.abs(bekle.scale.y) * -0.55;
    bekle.scale.x = Math.abs(bekle.scale.x);
    yazilar.push(bekle);
  }

  // --- 7. Rampa önü: yükleme alanı ---
  // Dorse bölümünde kapının önü taranıyor ve kapının adı zemine yazılıyor.
  // Oyuncunun bu bölümde bulacağı ilk soru "mal nereye gidecek" ve cevabı
  // rafların arasında değil, koridorun doğu ucunda.
  const d = b.dorse;
  if (d) {
    taraliAlan(g, d.arka - 3.1, d.arka - 0.3, -0.22, -1.62, 0.3);
    g.rect(d.arka - 3.2, -1.7, 3.2, 0.08).fill({ color: C.hazardY, alpha: 0.95 });
    const rampa = worldText(M.dekor.rampa, 0.42, { fill: 0xEBD79A });
    rampa.position.set(d.arka - 1.6, -0.92);
    rampa.anchor.set(0.5, 0.5);
    rampa.scale.y = Math.abs(rampa.scale.y) * -0.55;
    rampa.scale.x = Math.abs(rampa.scale.x);
    yazilar.push(rampa);
  }

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
/**
 * Rampa kapısının açıklığı (m).
 *
 * Gerçek rampa kapısı 2.7–3.0 metredir; buradaki 4.4 metre, direği 3.30
 * metre olan bir makinenin kapıdan geçebilmesi için. Direği alçak bir
 * "konteyner forklifti" yerine standart depo makinesini kullanmanın bedeli.
 */
export const RAMPA_KAPISI = 4.4;

export function drawDepoIci(left: number, right: number, rampa = false): Container {
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
    if (rampa && yon < 0) {
      rampaDuvari(g, x, tavan);
      continue;
    }
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

  if (rampa) {
    const levha = worldText(M.dekor.rampa, 0.42, { fill: 0xF4F7F8 });
    const lx = right - 1.6;
    g.roundRect(lx - 0.95, RAMPA_KAPISI + 0.55, 1.9, 0.62, 0.06).fill(0x2B5F8F);
    levha.position.set(lx, RAMPA_KAPISI + 0.86);
    c.addChild(levha);
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
 * Doğu duvarı — rampa kapısıyla.
 *
 * Yan görünümde duvar kenarından görünüyor, yani kapı duvarın içinde bir
 * BOŞLUK: altı açık, üstünde lento ve sarılmış kepenk. Kapının dikme
 * koruyucuları bilerek çizilmedi — yan görünümde tam makinenin geçtiği
 * yerde duracaklar ve bir engel gibi okunacaklardı.
 */
function rampaDuvari(g: Graphics, x: number, tavan: number): void {
  const k = RAMPA_KAPISI;
  g.rect(x, k, 0.55, tavan - k).fill(C.depoWallD);
  g.rect(x - 0.14, k, 0.14, tavan - k).fill({ color: 0x6E767C, alpha: 0.9 });
  // Lento ve kepenk tamburu
  g.rect(x - 0.6, k - 0.06, 1.15, 0.18).fill(0x4C545B);
  g.roundRect(x - 0.62, k + 0.12, 0.62, 0.56, 0.24).fill(0x5A6268);
  g.roundRect(x - 0.62, k + 0.12, 0.62, 0.56, 0.24)
    .stroke({ width: 0.03, color: 0x3A4046 });
  // Kepenk rayları: kapının iki yanında, kenarından görünüyor.
  g.rect(x - 0.08, 0, 0.06, k).fill({ color: 0x3A4046, alpha: 0.85 });
  g.rect(x + 0.04, 0, 0.05, k).fill({ color: 0x3A4046, alpha: 0.6 });
}

/**
 * Dışarısı — rampanın doğusu: gökyüzü, avlu, uzak yapılar.
 *
 * Depo kapalı bir mekân ve arka planı ekran uzayında çiziliyor (loş iç
 * hacim). Kapının dışı ise gün ışığı: bu yüzden DÜNYA uzayında, rampadan
 * doğuya doğru ayrı bir katman. Ölçek aynı sahnedeki gökyüzüyle — vinç
 * bölümünün paleti.
 */
export function drawDisari(b: ForkliftBolum): Container {
  const c = new Container();
  const d = b.dorse;
  if (!d) return c;
  const g = new Graphics();
  const x0 = d.arka;
  const x1 = b.dogu + 40;
  const avlu = -DORSE_TABANI;

  // Gökyüzü: aşağıda açık, yukarıda koyu — vinç sahnesinin aynısı.
  const bant = 16;
  const tepe = 32;
  for (let i = 0; i < bant; i++) {
    const t = i / (bant - 1);
    const y = avlu + ((tepe - avlu) * i) / bant;
    g.rect(x0, y, x1 - x0, (tepe - avlu) / bant + 0.05).fill(karistir(C.skyLow, C.sky, t));
  }
  // Uzak sanayi hattı: puslu, alçak, gökyüzüne karışıyor.
  let x = x0 + 1.5;
  let n = 0;
  while (x < x1) {
    const w = 4 + ((n * 37) % 7);
    const h = 3.2 + ((n * 53) % 5) * 0.9;
    const renk = karistir(C.roof, C.sky, 0.52 + ((n * 17) % 3) * 0.06);
    g.rect(x, avlu, w, h).fill(renk);
    g.rect(x + 0.5, avlu + h - 0.9, w - 1, 0.35)
      .fill({ color: karistir(renk, C.frameDark, 0.2), alpha: 0.6 });
    x += w + 1.2 + ((n * 29) % 4);
    n++;
  }
  // Avlu: asfalt, aşağı doğru koyulaşıyor (depo zemini gibi kadrajın kenarı).
  g.rect(x0, avlu - 8, x1 - x0, 8).fill(0x50565A);
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    g.rect(x0, avlu - 0.8 - (5.6 * (i + 1)) / 10, x1 - x0, 5.6 / 10 + 0.02)
      .fill(karistir(0x50565A, 0x0B0F12, t));
  }
  g.rect(x0, avlu - 0.06, x1 - x0, 0.06).fill(0x3E4448);
  // Tel çit — dorsenin arkasında, avlunun sınırı
  g.rect(x0, avlu + 1.55, x1 - x0, 0.05).fill({ color: 0x59636A, alpha: 0.8 });
  g.rect(x0, avlu, x1 - x0, 1.6).fill({ color: 0x6F7B82, alpha: 0.16 });
  for (let px = Math.ceil(x0 / 2.5) * 2.5; px < x1; px += 2.5) {
    g.rect(px - 0.03, avlu, 0.06, 1.7).fill({ color: 0x59636A, alpha: 0.85 });
  }
  // Aydınlatma direği
  const dx = d.arka + 4.2;
  g.rect(dx - 0.07, avlu, 0.14, 9.2).fill(0x59636A);
  g.rect(dx - 0.07, avlu + 9.1, 1.2, 0.1).fill(0x59636A);
  g.roundRect(dx + 0.7, avlu + 8.85, 0.7, 0.26, 0.08).fill(0x3E4448);
  g.rect(dx + 0.75, avlu + 8.83, 0.6, 0.05).fill({ color: 0xF5F0DC, alpha: 0.9 });

  c.addChild(g);
  return c;
}

/**
 * Dorse tabanının avludan yüksekliği (m) — rampa yüksekliği de bu.
 *
 * Standart rampa 1.20–1.40 metre; dorse tabanı ona göre. Depo zemini y = 0
 * olduğu için avlu y = −1.35'te.
 */
const DORSE_TABANI = 1.35;

/**
 * Rampaya yanaşmış açık kasa dorse ve çekicisi.
 *
 * **Açık kasa, bilerek.** Tenteli dorsenin iç yüksekliği 2.7 metre; makinenin
 * direği 3.30. Gerçekte tenteli dorseye alçak direkli makineyle girilir —
 * burada tek makine var ve açık kasa dürüst olan seçim.
 *
 * Tabanı depo zeminiyle aynı kotta (bkz. `Dorse`), yani y = 0'ın altında
 * kalan her şey — şasi, tekerler, çekici — dorsenin YAN yüzü. Depo içinde
 * o bant zemin boyasının bandı; rampa ikisinin sınırı.
 */
export function drawDorse(b: ForkliftBolum): Container {
  const c = new Container();
  const d = b.dorse;
  if (!d) return c;
  const g = new Graphics();
  const avlu = -DORSE_TABANI;
  const tekerR = 0.5;
  const tekerY = avlu + tekerR;

  // --- Rampa: ön yüz, tamponlar, rampa köprüsü, saçak ---
  g.rect(d.arka - 0.3, avlu, 0.3, DORSE_TABANI).fill(C.concreteD);
  g.rect(d.arka - 0.3, -0.12, 0.3, 0.12).fill(C.concrete);
  for (const y of [-0.78, -0.42]) {
    g.roundRect(d.arka, y, 0.14, 0.3, 0.03).fill(0x1B1F22);
  }
  // Rampa köprüsü: zemin hizasında çelik levha, dudağı dorsenin üstünde.
  g.rect(d.arka - 1.3, -0.07, 1.75, 0.07).fill(0x6B7278);
  for (let x = d.arka - 1.25; x < d.arka + 0.4; x += 0.2) {
    g.rect(x, -0.05, 0.1, 0.03).fill({ color: 0x8B959B, alpha: 0.7 });
  }
  g.rect(d.arka - 1.3, -0.07, 0.1, 0.07).fill(C.hazardY);
  // Saçak: rampanın üstünde, dışarıda
  const sy = RAMPA_KAPISI + 0.55;
  g.rect(d.arka, sy, 2.6, 0.16).fill(0x4C545B);
  g.moveTo(d.arka, sy - 0.9).lineTo(d.arka + 2.2, sy)
    .stroke({ width: 0.07, color: 0x4C545B });

  // --- Dorse ---
  const boy = d.on - d.arka;
  // Gölge avluda
  g.rect(d.arka + 0.2, avlu - 0.02, boy + 3.2, 0.1).fill({ color: C.shadow, alpha: 0.35 });
  // Şasi kirişleri (I profil) — tekerlerin arasından görünen
  g.rect(d.arka + 0.4, -0.86, boy - 0.6, 0.3).fill(0x23272C);
  g.rect(d.arka + 0.4, -0.86, boy - 0.6, 0.05).fill(0x3A4046);
  // Destek ayakları: çekiciye bağlıyken kalkık
  const ayakX = d.on - 3.3;
  g.rect(ayakX - 0.08, avlu + 0.42, 0.16, 0.5).fill(0x3A4046);
  g.rect(ayakX - 0.2, avlu + 0.38, 0.4, 0.06).fill(0x23272C);
  g.rect(ayakX + 0.08, avlu + 0.75, 0.22, 0.05).fill(0x59636A);
  // Tekerler: tandem aks, arkaya yakın
  const akslar = [d.arka + 1.55, d.arka + 2.85];
  // Çamurluk
  g.roundRect(akslar[0]! - 0.72, tekerY + tekerR + 0.06, 2.74, 0.12, 0.05).fill(0x23272C);
  // Arka koruma çıtası ve stop lambaları
  g.rect(d.arka + 0.18, avlu + 0.38, 0.1, 0.5).fill(0x3A4046);
  g.rect(d.arka + 0.1, avlu + 0.36, 0.5, 0.12).fill({ color: C.hazardY, alpha: 0.9 });
  g.rect(d.arka + 0.02, -0.46, 0.12, 0.16).fill(0xC0282A);
  // Yan kiriş (kenar profili) — firmanın adı burada
  g.rect(d.arka, -0.52, boy + 0.14, 0.4).fill(0x2F3E4C);
  g.rect(d.arka, -0.52, boy + 0.14, 0.05).fill(0x23303B);
  // Taban tahtası ve çelik kenar
  g.rect(d.arka, -0.12, boy + 0.14, 0.12).fill(C.deck);
  g.rect(d.arka, -0.03, boy + 0.14, 0.03).fill(0x8B959B);
  // Kazık cepleri
  for (let x = d.arka + 0.35; x < d.on - 0.1; x += 0.62) {
    g.rect(x, -0.3, 0.12, 0.18).fill({ color: 0x1B2530, alpha: 0.85 });
  }
  // Ön duvar: çelik çerçeve, ızgara dolgu
  const dh = ON_DUVAR.yukseklik;
  const dk = ON_DUVAR.kalinlik;
  g.rect(d.on, 0, dk, dh).fill({ color: 0x59636A, alpha: 0.35 });
  for (const x of [d.on, d.on + dk - 0.05]) {
    g.rect(x, 0, 0.05, dh).fill(0x3A4046);
  }
  for (let y = 0.3; y <= dh; y += 0.52) {
    g.rect(d.on, Math.min(y, dh - 0.08), dk, 0.08).fill(0x3A4046);
  }
  g.rect(d.on - 0.02, dh - 0.1, dk + 0.04, 0.12).fill(0x23272C);

  // --- Çekici ---
  const on = d.on;
  // Şasi ve beşinci teker
  g.rect(on - 2.3, -0.98, 5.3, 0.26).fill(0x23272C);
  g.rect(on - 1.9, -0.72, 1.0, 0.2).fill(0x3A4046);
  // Yakıt deposu
  g.roundRect(on + 0.6, -0.92, 1.05, 0.5, 0.12).fill(0xB9C3C9);
  g.rect(on + 0.6, -0.72, 1.05, 0.04).fill({ color: 0x8B959B, alpha: 0.8 });
  // Egzoz — kabinin arkasında dikey
  g.rect(on + 0.38, -0.3, 0.12, 3.35).fill(0x9AA4AA);
  // Kabin (kabin-üstü motor): beyaz, kırmızı şerit
  const k0 = on + 0.55;
  const k1 = on + 3.0;
  const kAlt = -0.55;
  const kUst = 2.75;
  const beyaz = 0xE9ECEE;
  g.roundRect(k0, kAlt, k1 - k0, kUst - kAlt, 0.12).fill(beyaz);
  g.rect(k0, kAlt, 0.22, kUst - kAlt).fill(0xC9CED2);
  // Rüzgârlık
  g.poly([k0 + 0.3, kUst, k1 - 0.1, kUst, k1 - 0.2, kUst + 0.45, k0 + 0.9, kUst + 0.6])
    .fill(0xD6DADD);
  // Yan cam ve ön camın kenarı
  g.roundRect(k1 - 1.05, 1.35, 0.92, 0.95, 0.06).fill(C.glass);
  g.rect(k1 - 1.0, 2.05, 0.8, 0.14).fill({ color: C.glassLight, alpha: 0.6 });
  g.rect(k1 - 0.1, 1.2, 0.1, 1.25).fill(C.glassLight);
  // Kapı, kolu, basamaklar
  g.roundRect(k1 - 1.2, -0.12, 1.12, 2.5, 0.06).stroke({ width: 0.03, color: 0x9AA2A7 });
  g.rect(k1 - 0.5, 1.05, 0.22, 0.05).fill(0x59636A);
  for (const y of [-0.62, -0.32]) g.rect(k1 - 1.05, y, 0.55, 0.06).fill(0x3A4046);
  // Şerit ve ayna
  g.rect(k0, 0.12, k1 - k0, 0.22).fill(C.liveryRed);
  g.rect(k1, 1.9, 0.26, 0.05).fill(0x23272C);
  g.roundRect(k1 + 0.16, 1.55, 0.12, 0.5, 0.04).fill(0x23272C);
  // Tampon ve far
  g.rect(k1 - 0.1, -0.98, 0.28, 0.5).fill(0x3A4046);
  g.rect(k1 + 0.02, -0.28, 0.12, 0.16).fill(0xF6EFC8);
  const cekiciAks = [on - 1.4, on + 2.3];
  // Çamurluklar
  for (const ax of cekiciAks) {
    g.roundRect(ax - 0.66, tekerY + tekerR + 0.04, 1.32, 0.12, 0.05).fill(0x23272C);
  }
  c.addChild(g);

  for (const ax of [...akslar, ...cekiciAks]) {
    const t = drawWheel(tekerR);
    t.position.set(ax, tekerY);
    c.addChild(t);
  }

  // Firma adı: dorsenin yan kirişinde ve kabin kapısında. Giydirme
  // çevrilmiyor — kamyondaki "YILMAZ VİNÇ" gibi.
  const yazi = worldText('YILMAZ LOJİSTİK', 0.26, { fill: 0xE9ECEE, letterSpacing: 2 });
  yazi.position.set(d.arka + boy * 0.58, -0.32);
  const kapi = worldText('YILMAZ', 0.2, { fill: C.liveryRed, letterSpacing: 1 });
  kapi.position.set(k1 - 0.64, 0.62);
  c.addChild(yazi, kapi);
  return c;
}

/**
 * Mal kabul konveyörü — paletler buradan iniyor.
 *
 * Oyuncuya "yeni palet nereden gelecek" sorusunun cevabını veriyor. Palet
 * makine yükleme karesinin batısına geçince iniyor; ağzın altındaki sarı kare
 * de nereye ineceğini söylüyor.
 */
export function drawKonveyor(b: ForkliftBolum): Container {
  const c = new Container();
  const mk = b.malKabul;
  if (!mk) return c;
  const g = new Graphics();
  const y = mk.teslimKotu + 0.5;
  // Tavandan sarkan askılar
  for (const x of [mk.x - 1.5, mk.x + 1.5]) {
    g.rect(x - 0.05, y + 0.3, 0.1, 2.6).fill(C.roof);
  }
  // Konveyör gövdesi ve rulolar
  g.rect(mk.x - 1.7, y, 3.4, 0.34).fill(C.mast);
  g.rect(mk.x - 1.7, y + 0.28, 3.4, 0.06).fill(C.mastLight);
  for (let x = mk.x - 1.5; x < mk.x + 1.5; x += 0.34) {
    g.circle(x, y + 0.14, 0.1).fill(C.mastLight);
    g.circle(x, y + 0.14, 0.04).fill(C.mast);
  }
  // Ağız: paletin çıktığı boşluk
  g.rect(mk.x - 0.75, y - 0.12, 1.5, 0.12).fill(C.rackDark);

  const et = worldText(M.dekor.malKabul, 0.3, { fill: C.hazardY });
  et.position.set(mk.x - 1.55, y + 0.45);
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
