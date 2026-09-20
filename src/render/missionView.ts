import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { worldText } from './text';
import type { Task } from '../game/tasks';

/**
 * Yükler türlerine göre çiziliyor.
 *
 * Tek bir kırmızı kasa dört görevde de aynı görünüyordu; oyuncunun "bu sefer
 * ne kaldırıyorum" sorusuna bakışta cevap vermesi gerekiyor, çünkü ağırlık
 * farkı oynanışın tamamını değiştiriyor. Hepsinde üstte iki kaldırma mapası
 * var — sapanın nereye bağlandığı görünsün diye.
 */
export function drawLoad(t: Task, secenek: { etiket?: boolean } = {}): Container {
  const c = new Container();
  const g = new Graphics();
  const { halfWidth: hw, halfHeight: hh } = t;

  switch (t.kind) {
    case 'bobin': {
      // Sac bobin: takoz üstünde yatan rulo, yandan halka görünür.
      g.rect(-hw, -hh, hw * 2, hh * 0.35).fill(C.rust);
      const r = Math.min(hw, hh * 0.82);
      g.circle(0, hh * 0.1, r).fill(0x8C9398);
      g.circle(0, hh * 0.1, r).stroke({ width: 0.06, color: 0x4A5156 });
      g.circle(0, hh * 0.1, r * 0.62).fill(0x6E767B);
      g.circle(0, hh * 0.1, r * 0.22).fill(0x2B3134);
      for (let i = 0; i < 5; i++) {
        g.circle(0, hh * 0.1, r * (0.7 + i * 0.06))
          .stroke({ width: 0.02, color: 0x50585D, alpha: 0.7 });
      }
      break;
    }
    case 'tezgah': {
      // CNC tezgâh: yeşil gövde, kumanda kolonu, talaş kapağı.
      g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.06).fill(0x2F6B58);
      g.rect(-hw, hh - hh * 0.3, hw * 2, hh * 0.3).fill({ color: 0x3F8A72, alpha: 0.9 });
      g.rect(-hw, -hh, hw * 2, hh * 0.28).fill({ color: 0x1F4A3C, alpha: 0.9 });
      g.roundRect(hw * 0.3, -hh * 0.5, hw * 0.55, hh * 1.3, 0.05).fill(0x1B2126);
      g.roundRect(hw * 0.38, hh * 0.1, hw * 0.4, hh * 0.5, 0.03).fill(0x4E7F86);
      g.roundRect(-hw * 0.85, -hh * 0.45, hw * 0.9, hh * 0.9, 0.04)
        .stroke({ width: 0.05, color: 0x1F4A3C });
      break;
    }
    case 'jenerator': {
      // Kabinli jeneratör: uzun kutu, panjur, egzoz, kapı.
      g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.08).fill(0xB9642A);
      g.rect(-hw, hh - hh * 0.26, hw * 2, hh * 0.26).fill({ color: 0xD4803E, alpha: 0.9 });
      g.rect(-hw, -hh, hw * 2, hh * 0.24).fill({ color: 0x8A4518, alpha: 0.9 });
      for (let i = 0; i < 7; i++) {
        g.rect(-hw * 0.9 + i * hw * 0.2, -hh * 0.5, hw * 0.12, hh * 1.0)
          .fill({ color: 0x7A3D14, alpha: 0.55 });
      }
      g.roundRect(hw * 0.45, -hh * 0.55, hw * 0.42, hh * 1.1, 0.04)
        .stroke({ width: 0.05, color: 0x6A3411 });
      g.rect(hw * 0.62, hh, 0.14, 0.45).fill(C.frame);
      break;
    }
    case 'kompresor': {
      // Vidalı kompresör: mavi kabin, soğutucu ızgarası, hava tankı.
      g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.07).fill(0x2E5C86);
      g.rect(-hw, hh - hh * 0.24, hw * 2, hh * 0.24).fill({ color: 0x3F76A6, alpha: 0.9 });
      g.rect(-hw, -hh, hw * 2, hh * 0.22).fill({ color: 0x1E3E5C, alpha: 0.9 });
      g.roundRect(-hw * 0.85, -hh * 0.35, hw * 0.7, hh * 0.9, 0.05).fill(0x1B2A36);
      for (let i = 0; i < 5; i++) {
        g.rect(-hw * 0.8, -hh * 0.28 + i * hh * 0.17, hw * 0.6, hh * 0.08)
          .fill({ color: 0x5C8DB8, alpha: 0.7 });
      }
      g.roundRect(hw * 0.1, -hh * 0.45, hw * 0.8, hh * 0.55, 0.22).fill(0x8C959B);
      g.circle(hw * 0.5, hh * 0.45, Math.min(hw * 0.3, hh * 0.35)).fill(0x1B2A36);
      break;
    }
    case 'klima': {
      // Klima santrali: açık gri panel, fan ızgarası, kaide profili.
      g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.06).fill(0xA9B3B8);
      g.rect(-hw, hh - hh * 0.22, hw * 2, hh * 0.22).fill({ color: 0xC3CCD0, alpha: 0.9 });
      g.rect(-hw, -hh, hw * 2, hh * 0.2).fill(C.frame);
      g.circle(-hw * 0.42, 0, Math.min(hw * 0.34, hh * 0.62)).fill(0x6F797E);
      g.circle(hw * 0.42, 0, Math.min(hw * 0.34, hh * 0.62)).fill(0x6F797E);
      for (const cx of [-hw * 0.42, hw * 0.42]) {
        for (let i = -2; i <= 2; i++) {
          g.moveTo(cx - hw * 0.3, i * hh * 0.2).lineTo(cx + hw * 0.3, i * hh * 0.2)
            .stroke({ width: 0.03, color: 0x8C979C });
        }
      }
      break;
    }
    // --- DİRSEKLİ: kaba inşaat malzemesi ---
    //
    // Beşi de ÇİZİLMİYORDU: `LoadKind` on tür tanımlıyor, switch beşini
    // tanıyordu ve `default` yoktu. Dirseklinin yükleri switch'ten düşüp
    // yalnız dış çizgi + tonaj etiketi olarak görünüyordu — sahadan gelen
    // *"ağırlıklar şeffaf"* cümlesinin birebir sebebi.
    case 'briket': {
      // Briket paleti: iki sıra gri blok, aralarında derz.
      g.rect(-hw, -hh, hw * 2, hh * 2).fill(0x9A9C97);
      for (let sira = 0; sira < 2; sira++) {
        const y = -hh + sira * hh;
        for (let i = 0; i < 4; i++) {
          const w = (hw * 2) / 4;
          g.rect(-hw + i * w + 0.03, y + 0.03, w - 0.06, hh - 0.06)
            .fill(sira % 2 === i % 2 ? 0xA8ABA5 : 0x8E918C);
        }
      }
      g.rect(-hw, -hh, hw * 2, 0.05).fill({ color: 0x70736F, alpha: 0.8 });
      break;
    }
    case 'kum': {
      // Kum torbaları: üst üste yığılmış, üstü şişkin çuvallar.
      g.rect(-hw, -hh, hw * 2, hh * 2).fill(0xC2A874);
      for (let sira = 0; sira < 3; sira++) {
        const y = -hh + (sira * hh * 2) / 3;
        g.roundRect(-hw + 0.04, y + 0.03, hw * 2 - 0.08, (hh * 2) / 3 - 0.06, 0.12)
          .fill(sira % 2 === 0 ? 0xCDB683 : 0xB89C68);
      }
      g.rect(-hw, -hh, hw * 2, 0.05).fill({ color: 0x8A7448, alpha: 0.8 });
      break;
    }
    case 'donati': {
      // Demir donatı demeti: uçtan bakınca nervürlü çubuk kesitleri.
      g.rect(-hw, -hh, hw * 2, hh * 2).fill(0x6E5A46);
      const r = Math.min(0.09, hh * 0.38);
      for (let sira = 0; sira < 2; sira++) {
        const y = -hh + hh * 0.55 + sira * r * 2.1;
        for (let i = 0; i < 7; i++) {
          const x = -hw + 0.1 + i * ((hw * 2 - 0.2) / 6);
          g.circle(x + (sira % 2) * r, y, r).fill(C.rust);
          g.circle(x + (sira % 2) * r, y, r * 0.55).fill(0x9C6A46);
        }
      }
      // Bağ telleri.
      for (const x of [-hw * 0.5, hw * 0.5]) {
        g.rect(x - 0.02, -hh, 0.04, hh * 2).fill({ color: 0x44484B, alpha: 0.9 });
      }
      break;
    }
    case 'kalip': {
      // Kalıp panelleri: istiflenmiş kontrplak, yandan katman katman.
      g.rect(-hw, -hh, hw * 2, hh * 2).fill(0xC9A86A);
      const kat = Math.max(3, Math.round((hh * 2) / 0.09));
      for (let i = 0; i < kat; i++) {
        const y = -hh + (i * hh * 2) / kat;
        g.rect(-hw, y, hw * 2, (hh * 2) / kat - 0.015)
          .fill(i % 2 === 0 ? 0xD4B678 : 0xB8975C);
      }
      for (const x of [-hw * 0.6, hw * 0.6]) {
        g.rect(x - 0.025, -hh, 0.05, hh * 2).fill({ color: 0x3A3F44, alpha: 0.85 });
      }
      break;
    }
    case 'kova': {
      // Beton kovası: aşağı daralan huni, üstte askı kulakları.
      g.moveTo(-hw, hh).lineTo(hw, hh).lineTo(hw * 0.42, -hh)
        .lineTo(-hw * 0.42, -hh).fill(0x4E5A62);
      g.moveTo(-hw, hh).lineTo(-hw * 0.2, hh).lineTo(-hw * 0.1, -hh)
        .lineTo(-hw * 0.42, -hh).fill({ color: 0x66747E, alpha: 0.9 });
      g.rect(-hw, hh - 0.09, hw * 2, 0.09).fill(0x39434A);
      // Alt kapak ve kolu.
      g.rect(-hw * 0.42, -hh, hw * 0.84, 0.07).fill(0x2C343A);
      g.rect(hw * 0.2, -hh - 0.14, 0.05, 0.16).fill(C.rust);
      break;
    }

    // --- FORKLİFT: depoda paletli ticari mal ---
    //
    // Beşi de vincin türlerini kullanıyordu: "Çimento paleti" ekranda bir CNC
    // tezgâhı, "Fayans paleti" bir sac bobiniydi. Artık kendi mallar.
    case 'cimento': {
      // Çimento torbaları: çapraz istif, kâğıt torba rengi.
      g.rect(-hw, -hh, hw * 2, hh * 2).fill(0xA9A296);
      for (let sira = 0; sira < 4; sira++) {
        const y = -hh + (sira * hh * 2) / 4;
        const kaydir = sira % 2 === 0 ? 0 : 0.06;
        g.roundRect(-hw + 0.03 + kaydir, y + 0.02, hw * 2 - 0.06,
          (hh * 2) / 4 - 0.04, 0.05)
          .fill(sira % 2 === 0 ? 0xB5AE9F : 0x9C9488);
      }
      // Marka şeridi.
      g.rect(-hw + 0.06, -hh * 0.1, hw * 2 - 0.12, hh * 0.18)
        .fill({ color: 0x8A3F2A, alpha: 0.75 });
      break;
    }
    case 'fayans': {
      // Fayans kolileri: düzgün karton kutular, üstünde streç.
      g.rect(-hw, -hh, hw * 2, hh * 2).fill(0xC8A578);
      for (let i = 0; i < 3; i++) {
        const w = (hw * 2) / 3;
        g.rect(-hw + i * w + 0.03, -hh + 0.03, w - 0.06, hh * 2 - 0.06)
          .fill(i === 1 ? 0xD8B587 : 0xBE9A6C);
        g.rect(-hw + i * w + 0.03, -hh + hh * 0.7, w - 0.06, 0.05)
          .fill({ color: 0x8A6A44, alpha: 0.8 });
      }
      // Streç film parlaması.
      g.rect(-hw, hh - 0.1, hw * 2, 0.1).fill({ color: 0xE8EEF0, alpha: 0.35 });
      break;
    }
    case 'varil': {
      // Boya varilleri: yan yana silindirler, çemberli.
      g.rect(-hw, -hh, hw * 2, 0.06).fill({ color: 0x3A4045, alpha: 0.6 });
      const adet = 3;
      const vw = (hw * 2) / adet;
      for (let i = 0; i < adet; i++) {
        const x = -hw + i * vw + vw / 2;
        g.roundRect(x - vw / 2 + 0.03, -hh + 0.04, vw - 0.06, hh * 2 - 0.08, 0.06)
          .fill(i % 2 === 0 ? 0x2F6B8A : 0x27586F);
        for (const k of [0.3, 0.7]) {
          g.rect(x - vw / 2 + 0.03, -hh + hh * 2 * k, vw - 0.06, 0.05)
            .fill({ color: 0xA8B4BA, alpha: 0.85 });
        }
      }
      break;
    }
    case 'balya': {
      // Yalıtım balyası: sıkıştırılmış, streçli, hafif ama hantal.
      g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.1).fill(0xD9D2C4);
      g.roundRect(-hw + 0.04, -hh + 0.04, hw * 2 - 0.08, hh * 2 - 0.08, 0.08)
        .fill({ color: 0xE6E1D6, alpha: 0.7 });
      // Bağ kayışları.
      for (const x of [-hw * 0.55, 0, hw * 0.55]) {
        g.rect(x - 0.03, -hh, 0.06, hh * 2).fill({ color: 0x6E7B84, alpha: 0.75 });
      }
      g.rect(-hw, hh * 0.25, hw * 2, 0.06).fill({ color: 0x6E7B84, alpha: 0.6 });
      break;
    }
    case 'profil': {
      // Çelik profil demeti: uçtan bakınca I kesitleri. Küçük ama ağır.
      g.rect(-hw, -hh, hw * 2, hh * 2).fill(0x555F66);
      const adet = 4;
      const pw = (hw * 2) / adet;
      for (let i = 0; i < adet; i++) {
        const x = -hw + i * pw + 0.03;
        const w = pw - 0.06;
        g.rect(x, -hh + 0.04, w, 0.06).fill(0x8A949B);
        g.rect(x, hh - 0.1, w, 0.06).fill(0x8A949B);
        g.rect(x + w / 2 - 0.02, -hh + 0.04, 0.04, hh * 2 - 0.14).fill(0x6E787F);
      }
      g.rect(-hw, -hh * 0.1, hw * 2, 0.05).fill({ color: C.rust, alpha: 0.7 });
      break;
    }
    default: {
      // **Tüketicilik denetimi.** Bu satır yokken `LoadKind`e bir tür eklemek
      // sessizce "çizilmeyen yük" üretiyordu: dirseklinin beş malı switch'ten
      // düşmüş, ekranda boş çerçeve + tonaj etiketi olarak görünüyordu ve
      // TypeScript hiçbir şey söylemiyordu. Artık eksik tür DERLEME hatası,
      // çünkü buraya düşen `t.kind`in `never` olması gerekiyor.
      const eksik: never = t.kind;
      throw new Error(`cizimi olmayan yuk turu: ${String(eksik)}`);
    }
  }

  // Gövde çizgisi ve kaldırma mapaları — yükün ÜSTÜNDE (+y dünyada yukarı).
  g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.06)
    .stroke({ width: 0.05, color: 0x20262A, alpha: 0.85 });
  g.circle(-hw * 0.55, hh, 0.09).stroke({ width: 0.05, color: C.chrome });
  g.circle(hw * 0.55, hh, 0.09).stroke({ width: 0.05, color: C.chrome });
  c.addChild(g);

  // **Tonaj etiketi yükün ÜSTÜNDE duran bir HUD değil, malın üstündeki bir
  // plaka.** Eskiden 0.34 metrelik yazı 0.84 metrelik bir yükün yüzde
  // kırkını kaplıyordu ve nesneyi görünmez yapıyordu — sahadan gelen
  // "ağırlıklar şeffaf" şikâyetinin ikinci yarısı buydu. Şimdi yüke göre
  // ölçekleniyor, altta duruyor ve arkasında koyu bir plaka var: her mal
  // renginde okunuyor, ama malın kendisini örtmüyor.
  // Rafta duran stokta tonaj yazmıyor: o, oyuncunun ŞU AN taşıdığı yüke ait
  // bir bilgi. Dekor paletlerin hepsinde yazsaydı ekran rakamla dolar ve
  // asıl okunması gereken sayı kaybolurdu.
  if (secenek.etiket === false) return c;
  const boy = Math.min(0.26, hh * 0.58);
  const etiket = worldText(`${t.tonnes.toFixed(2)} t`, boy, { fill: 0xF4F7F8 });
  const plakaW = boy * 2.6;
  g.roundRect(-plakaW / 2, -hh + 0.04, plakaW, boy * 1.5, 0.03)
    .fill({ color: 0x141A1E, alpha: 0.72 });
  etiket.position.set(0, -hh + 0.04 + boy * 0.75);
  c.addChild(etiket);
  return c;
}

/**
 * Terastaki bırakma işareti.
 *
 * Sadece nokta koymuyoruz: yükün genişliğinde bir kapı çiziyoruz, çünkü hedef
 * bir nokta değil bir ALAN — ve kör kaldırmada oyuncunun aradığı şey tam olarak
 * "sığıyor muyum". Kenar bayrakları yukarı bakıyor ki bomun altından görünsün.
 */
export class TargetMarker extends Container {
  private readonly g = new Graphics();

  constructor() {
    super();
    this.addChild(this.g);
  }

  /**
   * @param boy direklerin yüksekliği (m). Terasta 1.15 doğru, rafta değil:
   *   raf katları 1.4 metre arayla ve 1.15'lik direk bir üst kata girip
   *   oku yanlış katta gösteriyordu.
   */
  update(hedef: { x: number; y: number } | null, hw: number, aktif: boolean,
         boy = 1.15): void {
    this.g.clear();
    this.visible = hedef !== null;
    if (!hedef) return;
    this.position.set(hedef.x, hedef.y);
    const w = hw + 0.35;
    // **Her zaman sarı.** Bir ara yük havada değilken gri çiziliyordu ve gri
    // binanın önünde tamamen kayboluyordu — oysa oyuncunun hedefi en çok
    // aradığı an yükü almadan ÖNCE, nereye gideceğini planlarken.
    const renk = C.hazardY;
    const alpha = aktif ? 1 : 0.7;

    // Zemin bandı
    this.g.rect(-w, 0.02, w * 2, 0.1).fill({ color: renk, alpha: alpha * 0.85 });
    // İki yan direk
    for (const sx of [-w, w - 0.12]) {
      this.g.rect(sx, 0, 0.12, boy).fill({ color: renk, alpha });
      for (let i = 0; i * 0.36 + 0.18 < boy; i++) {
        this.g.rect(sx, 0.18 + i * 0.36, 0.12, Math.min(0.18, boy - 0.18 - i * 0.36))
          .fill({ color: C.hazardK, alpha: alpha * 0.8 });
      }
    }
    // Ok — aşağı bakan üçgen, bırakma noktası. Yük havadayken büyüyor.
    const k = aktif ? 1.35 : 1;
    this.g.moveTo(-0.3 * k, boy + 0.5 * k).lineTo(0.3 * k, boy + 0.5 * k).lineTo(0, boy)
      .fill({ color: renk, alpha });
  }
}
