import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { AVLU } from '../sim/avlu';
import { worldText } from './text';
import { M } from '../ui/dil';

/**
 * Bölüm 1 dekoru — dar sokak, bahçe duvarı, yarım kalmış ev.
 *
 * Fabrikadan farklı olarak buradaki her ölçü fizik gövdeleriyle AYNI sabitten
 * (`AVLU`) okunuyor. Fabrikada iki kere ayrı yazılmıştı ve teras kotu bir
 * seferinde kaymıştı; çizim ile çarpışma şeklinin ayrışması gözle
 * yakalanmayan, ama oyuncuya "yük havada duruyor" diye görünen bir hata.
 */

/**
 * Bahçe duvarı — sıvalı briket, üstünde harpuşta.
 *
 * **Neden 40 santim ve neden derinlik çizilmiyor.** Sahadan gelen not: *"duvar
 * ince bir direk gibi duruyor."* Doğru — ama eni level'in kendisi belirliyor,
 * bizim tercihimiz değil: solda avlu zemini hedefi x 7.3'te ve yük yarı eni
 * 55 santime kadar çıkıyor (yani 7.85'e dayanıyor), sağda malzeme yığını
 * 9.4'te ve 8.85'e kadar geliyor. Geriye 8.0–8.4 kalıyor.
 *
 * Duvarın SOKAĞA DİK uzandığını göstermek için eğik bir kaçış yüzeyi çizmek
 * DENENDİ ve vazgeçildi: harpuştanın üstü kalan tek yön ve orası yükün uçuş
 * koridoru. Kanca sonuna kadar sarılıyken bile yük ucun 1.7 metre altında
 * asılı olduğu için yük duvarı 3.35 metrenin üstünden geçiyor; oraya çizilen
 * her şey ya yükün arkasında kaybolur ya da oyuncuya engelin daha yüksek
 * olduğunu söyler. İkincisi düpedüz yalan olurdu.
 *
 * O yüzden okunurluk kesitin KENDİ içinde aranıyor: düzenli briket sıraları,
 * dökülmüş sıvanın altından çıkan derz, kalın harpuşta ve dipteki subasman.
 * Hepsi 8.0–8.4 bandının içinde kalıyor — çizim hâlâ fizikle aynı şeyi
 * söylüyor.
 */
export function drawBahceDuvari(): Container {
  const c = new Container();
  const g = new Graphics();
  const { duvarSol: sol, duvarSag: sag, duvarY: h } = AVLU;
  const en = sag - sol;

  // Subasman: dipte iki santim taşan sıra. Duvarın yere OTURDUĞUNU söylüyor;
  // direk toprağa saplanır, duvar oturur.
  g.rect(sol - 0.03, 0, en + 0.06, 0.22).fill(C.bahceShade);
  g.rect(sol, 0.22, en, h - 0.22).fill(C.bahce);
  // Sokak tarafı güneş alıyor, avlu tarafı gölgede.
  g.rect(sol, 0.22, en * 0.38, h - 0.22).fill({ color: C.bahceShade, alpha: 0.75 });

  // **Briket sıraları.** Asıl okunurluk burada: eşit aralıklı yatay derzler
  // gözün duvarı ölçmesini sağlıyor, tek parça bir dikdörtgen ölçülemiyor.
  // 19'luk briket + derz = 21 santim, gerçek ölçü.
  for (let y = 0.22 + 0.21; y < h - 0.05; y += 0.21) {
    g.rect(sol, y, en, 0.025).fill({ color: C.bahceShade, alpha: 0.9 });
  }

  // Dökülmüş sıva: altından briket dokusu çıkıyor. Sokak duvarı yeni değil.
  for (const [y, boy] of [[0.55, 0.62], [1.48, 0.44], [2.35, 0.5]] as const) {
    g.rect(sol + en * 0.30, y, en * 0.70, boy).fill({ color: C.bahceShade, alpha: 0.5 });
    g.rect(sol + en * 0.30, y, 0.03, boy).fill({ color: C.shadow, alpha: 0.18 });
  }

  // Harpuşta: iki yana 13'er santim taşan, öne eğimli kapak. Taşma duvarın
  // kalınlığını ölçülebilir kılan ikinci şey.
  g.rect(sol - 0.13, h, en + 0.26, 0.20).fill(C.concreteD);
  g.rect(sol - 0.13, h + 0.12, en + 0.26, 0.08).fill({ color: C.concrete, alpha: 0.95 });
  g.rect(sol - 0.13, h + 0.20, en + 0.26, 0.05).fill({ color: C.concrete, alpha: 0.6 });
  // Harpuştanın altındaki damlalık gölgesi — kapağı duvardan ayırıyor.
  g.rect(sol - 0.06, h - 0.06, en + 0.12, 0.06).fill({ color: C.shadow, alpha: 0.3 });

  // Sokağa bakan yüzde ikaz bandı: dar sokakta kamyonun kuyruğunu
  // yanaştıracağı engel bu ve bir bakışta görünmesi gerekiyor.
  for (let y = 0.28; y < 1.18; y += 0.3) {
    g.rect(sag - 0.05, y, 0.06, 0.15).fill({ color: C.hazardY, alpha: 0.9 });
    g.rect(sag - 0.05, y + 0.15, 0.06, 0.15).fill({ color: C.hazardK, alpha: 0.9 });
  }
  // Gölge: duvar zemine oturuyor.
  g.rect(sol - 0.25, 0, en + 0.5, 0.06).fill({ color: C.shadow, alpha: 0.22 });
  c.addChild(g);
  return c;
}

/**
 * Kaba inşaat — kademeli dört kat, damları teras.
 *
 * Damdan yukarı çıkan kolon filizleri bilerek: yükün BIRAKILACAĞI yer o
 * teraslar ve oyuncunun orayı bir zemin olarak okuması gerekiyor. Filizler
 * hem "inşaat sürüyor" diyor hem de kotu gözle ölçülebilir kılıyor.
 */
export function drawYarimEv(): Container {
  const c = new Container();
  const g = new Graphics();
  const sol = AVLU.evSolKenar;

  for (let k = 0; k < AVLU.katSayisi; k++) {
    const sag = AVLU.evSagKenar - AVLU.kademe * k;
    const alt = k === 0 ? 0 : AVLU.katYuksekligi * k;
    const ust = AVLU.katYuksekligi * (k + 1);
    const en = sag - sol;

    // Gövde: brüt beton.
    g.rect(sol, alt, en, ust - alt).fill(C.concrete);
    g.rect(sol, alt, en * 0.24, ust - alt).fill({ color: C.concreteD, alpha: 0.7 });
    // Kalıp izleri.
    for (let y = alt + 0.5; y < ust; y += 0.6) {
      g.rect(sol, y, en, 0.03).fill({ color: C.concreteD, alpha: 0.5 });
    }
    // Kolonlar ve kat arası kiriş.
    g.rect(sol, ust - 0.18, en, 0.18).fill(C.concreteD);
    // Doğramasız boşluklar — her katta iki tane.
    const bosluk = Math.min(0.85, en / 3.2);
    for (let i = 0; i < 2; i++) {
      const bx = sol + 0.4 + i * (en - 0.8 - bosluk) ;
      if (bx + bosluk < sag - 0.25) {
        g.rect(bx, alt + 0.75, bosluk, 1.35).fill(C.frameDark);
      }
    }
    // Damın öne taşan plağı + korkuluk.
    g.rect(sol - 0.12, ust, en + 0.24, 0.16).fill(C.concreteD);
    if (k < AVLU.katSayisi - 1) {
      g.rect(sag - 0.14, ust + 0.16, 0.14, AVLU.korkulukY - 0.16).fill(C.concrete);
      g.rect(sag - 0.14, ust + AVLU.korkulukY - 0.1, 0.16, 0.1).fill(C.concreteD);
    }
    // Kolon filizleri ve donatı — en üst katta daha uzun.
    const filizBoy = k === AVLU.katSayisi - 1 ? 0.95 : 0.45;
    for (const x of [sol + 0.3, (sol + sag) / 2, sag - 0.35]) {
      g.rect(x - 0.13, ust + 0.16, 0.26, filizBoy * 0.5).fill(C.concrete);
      for (const dx of [-0.07, 0, 0.07]) {
        g.rect(x + dx - 0.015, ust + 0.16, 0.03, filizBoy).fill(C.rust);
      }
    }
  }
  c.addChild(g);
  const t = worldText(M.dekor.avlu, 0.4, { fill: C.concreteD });
  t.position.set((sol + AVLU.evSagKenar) / 2, AVLU.katYuksekligi * AVLU.katSayisi + 1.8);
  t.alpha = 0.6;
  c.addChild(t);
  return c;
}

/**
 * Park cebi — sokağa boyalı dikdörtgen.
 *
 * Fiziksel takoz yok (sebebi `AVLU.parkX` notunda), dolayısıyla oyuncunun
 * nerede duracağını söyleyen tek şey bu. Kamyon geri geri geldiği için
 * cebin ARKA çizgisi kalın: durulacak yer orası.
 */
export function drawParkCebi(): Container {
  const c = new Container();
  const g = new Graphics();
  const { parkX: x, parkPayiM: p } = AVLU;
  const yari = 4.9;   // kamyonun yarı boyu kadar; cep aracı sarsın
  g.rect(x - yari, 0, yari * 2, 0.02).fill({ color: C.hazardY, alpha: 0.15 });
  // Yan çizgiler.
  for (const dx of [-yari, yari]) {
    g.rect(x + dx - 0.06, 0, 0.12, 0.03).fill({ color: C.hazardY, alpha: 0.75 });
  }
  // Durma bandı: cebin arka ucunda, kalın ve taralı.
  g.rect(x - p, 0, p * 2, 0.04).fill({ color: C.hazardY, alpha: 0.5 });
  for (let d = -p; d < p; d += 0.35) {
    g.moveTo(x + d, 0.02).lineTo(x + d + 0.22, 0.02)
      .stroke({ width: 0.14, color: C.hazardY, alpha: 0.8 });
  }
  c.addChild(g);
  const t = worldText(M.dekor.park, 0.34, { fill: C.hazardY });
  t.position.set(x, 0.95);
  t.alpha = 0.55;
  c.addChild(t);
  return c;
}

/**
 * Sokağın karşı sırası — dar sokak hissini veren şey bu.
 *
 * Kamyonun ARKASINDA değil, sahnenin sağ ucunda: oyuncu geri geri gelirken
 * sokağın devam ettiğini görüyor, ve bölümün "dar" olduğu iddiası bir
 * cümleyle değil silüetle kuruluyor.
 */
export function drawSokakSirasi(): Container {
  const c = new Container();
  const g = new Graphics();
  // **Bloklar avlunun DIŞINDA.** İlk yerleşimde -0.4'ten başlayan bir blok
  // avluya (1.9–7.3) taşıyordu ve ekranda evin üstüne biniyordu: hedef
  // işaretinin arkasında kendi binası olmayan bir cephe duruyordu. Avlu
  // 1.9'da başlıyor, sokak sırası 1.2'de bitiyor.
  const bloklar: Array<[number, number, number]> = [
    // [sol, en, yükseklik]
    [-9.5, 5.0, 11.5], [-4.0, 5.0, 9.0],
    [21.0, 6.0, 12.5], [27.5, 5.0, 10.0], [33.0, 6.5, 13.5],
  ];
  for (const [sol, en, h] of bloklar) {
    g.rect(sol, 0, en, h).fill(C.wallShade);
    g.rect(sol, 0, en * 0.22, h).fill({ color: C.concreteD, alpha: 0.6 });
    g.rect(sol - 0.1, h, en + 0.2, 0.22).fill(C.roof);
    // Pencereler.
    for (let y = 1.3; y < h - 1.0; y += 2.1) {
      for (let x = sol + 0.6; x < sol + en - 0.9; x += 1.5) {
        g.rect(x, y, 0.7, 1.0).fill({ color: C.glass, alpha: 0.75 });
        g.rect(x, y, 0.7, 0.18).fill({ color: C.glassLight, alpha: 0.5 });
      }
    }
  }
  c.addChild(g);
  return c;
}
