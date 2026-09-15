import type { Container } from 'pixi.js';
import { PPM } from '../render/stage';

/**
 * Çalışma zarfını kadrajlayan kamera.
 *
 * Üç hata bunun bugünkü halini şekillendirdi:
 *
 * 1. İlk sürümde geniş ölü bölge + yavaş yumuşatma vardı; kamyon 40 km/sa'e
 *    çıkınca kamera yetişemedi, araç ekrandan çıktı.
 * 2. İkinci sürümde yumuşatma kare BAŞINA sabit katsayıydı (x += d * 0.1).
 *    Bu kare hızına bağlıdır: 60 fps'te doğru, 10 fps'te kamera 11 metre
 *    geride kalıyordu. Ölçümle yakalandı — düşük kare hızında oyun bozuluyordu.
 * 3. Üçüncü sürüm kamyonu takip ediyordu ama YAKINLAŞTIRMA SABİTTİ. Bom 27
 *    metreye açılıp çatıya uzandığında yük 15.8 metrede kalıyor, sabit
 *    ölçekte görüş ise 15 metrede bitiyordu: oyuncu yükü bıraktığı yeri
 *    göremiyordu. Bir vinç oyununda kadrajın kamyona değil, ARACIN VE
 *    KANCANIN İKİSİNE birden bakması gerekiyor.
 *
 * Şimdi: verilen ilgi noktalarını (şasi, bom ucu, kanca) çevreleyen kutu
 * hesaplanıyor ve ölçek o kutuyu sığdıracak şekilde seçiliyor. Sürerken kutu
 * küçük, ölçek en yakında kalıyor — yani sürüş hissi değişmiyor; bom açıldıkça
 * kamera kendiliğinden geri çekiliyor.
 */
export class Camera {
  x = 0;
  y = 6;
  /** Metre başına piksel — artık değişken. */
  ppm = PPM;

  /** Yatay yerleşme zaman sabiti (s). Küçük = daha sıkı takip. */
  private readonly tauX = 0.16;
  /** Dikey daha gevşek — süspansiyon zıplamaları kamerayı sallamasın. */
  private readonly tauY = 0.45;
  /** Yakınlaştırma en gevşeği: ani ölçek değişimi mide bulandırıyor. */
  private readonly tauZoom = 0.7;
  /** Hız başına öne bakış (s). Oyuncu gittiği yeri görsün. */
  private readonly lookAheadSec = 0.8;
  private readonly maxLookAhead = 9;
  private readonly maxOffset = 11;
  /** Zemin çizgisinin ekranın altından bu kadar piksel yukarıda durması hedefi. */
  private readonly zeminPayiPx = 46;

  /**
   * En yakın ölçek. 34'ten 30'a indirildi — sahada "kamera biraz dar"
   * geri bildirimi geldi ve sürüş kadrajı da bir tık açıldı.
   */
  private readonly maxPpm = 30;
  /** En uzak ölçek. Bomun tamamen açık hali bu ölçekte rahat sığıyor. */
  private readonly minPpm = 15;
  /** Kutunun çevresinde bırakılan pay (m). */
  private readonly padX = 5;
  private readonly padY = 3.5;

  /**
   * @param points görünmesi gereken noktalar (şasi, bom ucu, kanca…)
   * @param dt gerçek kare süresi (s) — fizik adımı değil.
   */
  follow(
    points: ReadonlyArray<{ x: number; y: number }>,
    velX: number,
    screenW: number,
    screenH: number,
    dt: number,
  ): void {
    const first = points[0];
    if (!first) return;

    let minX = first.x, maxX = first.x, minY = first.y, maxY = first.y;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    // Zemin çizgisi hep kadrajda kalsın: aracın neyin üstünde durduğunu
    // görmeden eğimi okumak imkânsız.
    if (minY > 0) minY = 0;

    const w = maxX - minX + this.padX * 2;
    const h = maxY - minY + this.padY * 2;
    const fit = Math.min(
      screenW > 0 ? screenW / Math.max(w, 1) : this.maxPpm,
      screenH > 0 ? screenH / Math.max(h, 1) : this.maxPpm,
    );
    const hedefPpm = clamp(fit, this.minPpm, this.maxPpm);
    this.ppm = approach(this.ppm, hedefPpm, this.tauZoom, dt);

    // Öne bakış sadece sürerken anlamlı; bom çalışırken kutu zaten hedefi
    // içeriyor ve öne bakış kadrajı kaydırıp bom ucunu dışarı atıyordu.
    const look = h > 14
      ? 0
      : clamp(velX * this.lookAheadSec, -this.maxLookAhead, this.maxLookAhead);

    const hedefX = (minX + maxX) / 2;

    // **Dikeyde kutuyu ORTALAMIYORUZ, ALTINA YASLIYORUZ.**
    //
    // Ölçek hem genişliği hem yüksekliği sığdıracak şekilde seçiliyor ve
    // çoğu zaman genişlik bağlayıcı oluyor; dikeyde artan boşluk ortalanınca
    // yarısı zeminin ALTINA düşüyordu — ekranın alt üçte biri boş griydi.
    // Kutunun altını ekranın altına yaslayıp artan boşluğu göğe vermek hem
    // israfı bitiriyor hem de bomun üstünde nefes payı bırakıyor.
    const yariEkranM = screenH > 0 ? screenH / 2 / this.ppm : 10;
    const payM = this.ppm > 0 ? this.zeminPayiPx / this.ppm : 1.5;
    // Alta yaslanmış konum…
    const alta = minY + yariEkranM - payM;
    // …ama kutunun üstü de kadrajda kalmalı.
    const ustSinir = maxY - yariEkranM + payM;
    const hedefY = Math.max(alta, ustSinir);

    this.x = approach(this.x, hedefX + look, this.tauX, dt);
    this.x = clamp(this.x, hedefX - this.maxOffset, hedefX + this.maxOffset);
    this.y = approach(this.y, hedefY, this.tauY, dt);
  }

  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.ppm = this.maxPpm;
  }

  /**
   * Uzak katman yatayda daha yavaş kayar ama DİKEYDE dünyayla birebir hareket
   * eder — aksi halde uzak binalar zemin çizgisinden kopup havada yüzüyor.
   */
  apply(world: Container, far: Container, screenW: number, screenH: number): void {
    const cx = screenW / 2;
    const cy = screenH / 2;
    world.scale.set(this.ppm, -this.ppm);
    far.scale.set(this.ppm, -this.ppm);
    world.position.set(cx - this.x * this.ppm, cy + this.y * this.ppm);
    far.position.set(cx - this.x * this.ppm * 0.45, cy + this.y * this.ppm);
  }
}

/** Kare hızından bağımsız üstel yaklaşma. */
function approach(current: number, target: number, tau: number, dt: number): number {
  const k = 1 - Math.exp(-dt / Math.max(tau, 1e-4));
  return current + (target - current) * k;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
