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
export function drawLoad(t: Task): Container {
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
  }

  // Gövde çizgisi ve kaldırma mapaları — yükün ÜSTÜNDE (+y dünyada yukarı).
  g.roundRect(-hw, -hh, hw * 2, hh * 2, 0.06)
    .stroke({ width: 0.05, color: 0x20262A, alpha: 0.85 });
  g.circle(-hw * 0.55, hh, 0.09).stroke({ width: 0.05, color: C.chrome });
  g.circle(hw * 0.55, hh, 0.09).stroke({ width: 0.05, color: C.chrome });
  c.addChild(g);

  // Ağırlık etiketi — oyuncu hangi tonajla uğraştığını yükün üstünde görsün.
  const etiket = worldText(`${t.tonnes.toFixed(2)} t`, 0.34, { fill: 0xF4F7F8 });
  etiket.position.set(0, -hh + 0.26);
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

  update(hedef: { x: number; y: number } | null, hw: number, aktif: boolean): void {
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
      this.g.rect(sx, 0, 0.12, 1.15).fill({ color: renk, alpha });
      for (let i = 0; i < 3; i++) {
        this.g.rect(sx, 0.18 + i * 0.36, 0.12, 0.18).fill({ color: C.hazardK, alpha: alpha * 0.8 });
      }
    }
    // Ok — aşağı bakan üçgen, bırakma noktası. Yük havadayken büyüyor.
    const k = aktif ? 1.35 : 1;
    this.g.moveTo(-0.3 * k, 1.1 + 0.5 * k).lineTo(0.3 * k, 1.1 + 0.5 * k).lineTo(0, 1.1)
      .fill({ color: renk, alpha });
  }
}
