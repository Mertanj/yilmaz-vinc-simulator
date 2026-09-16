import { World, Edge, Box, Vec2, type Body } from 'planck';

/** Yerçekimi ve simülasyon sabitleri. Her şey MKS: metre, kilogram, saniye. */
/**
 * Aracın kendi parçalarının çarpışma grubu.
 *
 * planck'te aynı NEGATİF grup indeksindeki fixture'lar birbiriyle hiç
 * çarpışmaz, ama grup dışındaki her şeyle (zemin, yük, kasalar) normal
 * çarpışır. Şasi, tekerlekler, ayak milleri ve pabuçlar bu gruba giriyor:
 * gerçek bir vincin ayağı kendi lastiğine çarpmaz.
 *
 * Bu olmadan ön pabuk ön tekerleğin içine giriyor ve lastiğe dayanıp
 * uzayamıyordu — "ön ayak tam açılmıyor ve aracı kaldırmıyor" şikayetinin
 * sebebi buydu.
 */
export const TRUCK_GROUP = -1;

/**
 * Çarpışma kategorileri — forkliftin iki yalanını kurmak için.
 *
 * Yan görünüm 2B, oysa anlattığımız şey 3B. İki yerde bu fark önemli:
 *
 * 1. **Palet cepleri.** Gerçek palette çatal, takozların ARASINDAN girer;
 *    yandan bakınca çatal takozun içinden geçiyormuş gibi görünür. Paletin
 *    ayakları bu yüzden çatalla çarpışmıyor, zemin ve rafla çarpışıyor.
 * 2. **Raf koridorda değil.** Forklift rafın ÖNÜNDE, koridorda ilerler; raf
 *    derinlik yönünde durur. Dolayısıyla raf kirişleri yükle ve çatalla
 *    çarpışıyor ama makinenin gövdesiyle çarpışmıyor.
 *
 * Bu iki filtre olmadan level kuruluyor ama yalan söylemek zorunda kalıyor:
 * ilk sürümde en alt raf kirişi şasinin üstüne çıkarılmıştı, çünkü makine
 * başka türlü koridorda ilerleyemiyordu.
 */
export const KATEGORI = {
  /** Varsayılan: yük, zemin, dekor. */
  normal: 0x0001,
  /** Çatal ve taşıyıcı. */
  catal: 0x0002,
  /** Makine gövdesi ve tekerler. */
  makine: 0x0004,
  /** Paletin ayakları — çatal bunların arasından geçiyor. */
  paletAyagi: 0x0008,
  /** Raf kirişleri. */
  raf: 0x0010,
  /** Palet üstündeki yük gövdesi. */
  yuk: 0x0020,
  /** Direk kanalı — çataldan ayrı, çünkü rafa girmeyen tek makine parçası o. */
  direk: 0x0040,
} as const;

export const MASKE = {
  /** Çatal her şeye değiyor, paletin ayakları hariç. */
  catal: 0xFFFF & ~KATEGORI.paletAyagi,
  /** Raf yükle ve çatalla çarpışıyor, makineyle değil. */
  raf: 0xFFFF & ~KATEGORI.makine,
  /** Palet ayağı çatala takılmıyor. */
  paletAyagi: 0xFFFF & ~KATEGORI.catal,
  /**
   * Yük makinenin GÖVDESİNE değmiyor — sadece çatalına.
   *
   * Gerçek forkliftte palete dokunan tek şey çataldır; şasi paletin 10 cm
   * gerisinde kalır. Bu filtre olmadan, çatal palete yanlış kotta girdiğinde
   * oluşan içiçe geçmeyi solver şasi üzerinden çözmeye çalışıyor ve makineyi
   * fırlatıyordu (ölçüldü: makine 2.8 metre havaya çıktı). Şimdi en kötü
   * durumda palet itiliyor — sahada da olan bu.
   */
  yuk: 0xFFFF & ~KATEGORI.makine,
  /**
   * Direk rafa değmiyor — çünkü koridorda ilerleyen şey o.
   *
   * Rafa uzanan tek parça ÇATAL; direk hep koridorda kalır. Bu filtre olmadan
   * 2.45 metrelik direk en alt kirişe çarpıyor ve makine hiçbir gözün önünden
   * geçemiyordu (ölçüm: makine ilk gözde durdu, paletin 19 metre gerisinde).
   */
  direk: 0xFFFF & ~KATEGORI.raf & ~KATEGORI.paletAyagi,
} as const;

export const SIM = {
  gravity: -9.81,
  /** Sabit fizik adımı. Döngü de, başsız test de bunu kullanır. */
  hz: 60,
  // planck'in tavsiyesi 8/3, örnekleri 10/8. Vinç zinciri uzun ve yük ağır
  // olduğu için biraz daha yüksek: kritik kural küçük adımı yüksek iterasyona
  // takas etmemek, 60 Hz'de kalıp iterasyonu artırmak sorun değil.
  velocityIterations: 14,
  positionIterations: 10,
  /** Zeminin sol ve sağ sınırı (m). */
  groundLeft: -60,
  groundRight: 160,
} as const;

/**
 * Render interpolasyonu için önceki adımın gövde dönüşümlerini saklar.
 *
 * 60 Hz'de simüle edip 120 Hz'de çizersek, interpolasyon olmadan hareket
 * gözle görülür şekilde titrer.
 */
export class Snapshotter {
  private readonly prev = new Map<Body, { x: number; y: number; a: number }>();

  track(body: Body): Body {
    const p = body.getPosition();
    this.prev.set(body, { x: p.x, y: p.y, a: body.getAngle() });
    return body;
  }

  /** Her fizik adımından ÖNCE çağrılır. */
  capture(): void {
    for (const [body, slot] of this.prev) {
      const p = body.getPosition();
      slot.x = p.x;
      slot.y = p.y;
      slot.a = body.getAngle();
    }
  }

  /** alpha 0..1 — önceki adımla şimdiki adım arası. */
  interpolate(body: Body, alpha: number): { x: number; y: number; a: number } {
    const now = body.getPosition();
    const angle = body.getAngle();
    const old = this.prev.get(body);
    if (!old) return { x: now.x, y: now.y, a: angle };
    return {
      x: old.x + (now.x - old.x) * alpha,
      y: old.y + (now.y - old.y) * alpha,
      // Açıyı en kısa yoldan harmanla, yoksa ±π sınırında sıçrar.
      a: old.a + shortestAngle(old.a, angle) * alpha,
    };
  }
}

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(): World {
  return new World({ x: 0, y: SIM.gravity });
}

/** Sanayi sitesi avlusu — düz beton. */
export function createGround(world: World): Body {
  const ground = world.createBody();
  ground.createFixture(new Edge(
    { x: SIM.groundLeft, y: 0 },
    { x: SIM.groundRight, y: 0 },
  ), { friction: 0.95 });
  return ground;
}

/**
 * Beton tekerlek takozu — kurulum alanının ön sınırı.
 *
 * Level tasarımında park penceresinin ön sınırını karşı ağırlığın sundurma
 * kolonuna çarpması belirliyor. Oyuncunun bunu tahmin etmesi imkânsız olurdu,
 * ve test sırasında kamyon defalarca yükün ve binanın içine sürdü. Sanayi
 * avlularında zaten olan bir şeyi koyuyoruz: beton takoz.
 */
export function createKerb(world: World, x: number): Body {
  const body = world.createBody();
  body.createFixture(new Box(0.35, 0.34, { x, y: 0.34 }, 0), { friction: 0.9 });
  return body;
}

/**
 * Fabrika — kademeli (teraslı) kesit, statik gövde.
 *
 * Kademeli olması keyfi değil: düz cepheli bir blokta yükleme kapısı ayak
 * izinin içinde kalıyor ve kancanın üstteki döşemeden geçmesi gerekiyordu,
 * yani bina fiziksel olarak inşa edilemezdi. Türk sanayi sitelerinde üst
 * katlar zaten daha sığ (Başiskele işyeri cetveli: zemin 7×12, üst 7×5),
 * dolayısıyla doğru çözüm aynı zamanda gerçekçi olan.
 *
 * Her kademe 4.5 m geri çekiliyor, altındakinin çatısı üsttekinin terası
 * oluyor — vincin yükü bırakacağı yer orası.
 */
/**
 * Beş katlı, kademeli fabrika.
 *
 * Kat sayısı 3'ten 5'e çıkarken kademe ve kat yüksekliği KÜÇÜLMEK zorundaydı;
 * ikisi de erişim geometrisini doğrudan belirliyor. Çatı hedefi için bom ucunun
 * hedefin ~3 m üstünde olması gerekiyor ve gereken bom boyu şöyle çıkıyor:
 *
 *   kademe 3.4 / kat 4.4 → çatı 32.7 m  ✗ (bom 30 m)
 *   kademe 3.0 / kat 4.0 → çatı 30.2 m  ✗ kıl payı
 *   kademe 3.0 / kat 3.8 → çatı 29.6 m  ✓
 *
 * Seçilen: 3.0 / 3.8. Kapasiteler sırayla 4.56 · 3.18 · 2.23 · 1.64 · 1.29 t —
 * yukarı çıktıkça yük hafiflemek zorunda, ki sahadaki kural da bu.
 *
 * Teras derinliği kademeye eşit, yani 3.0 m: yükler 2.4 metreden geniş olamaz.
 */
export const FACTORY = {
  left: 62.0,
  right: 96.0,
  setback: 3.0,
  floorHeight: 3.8,
  floors: 5,
  parapetHeight: 0.9,
} as const;

/** Terasların ön kenarı ve kotu — yerleştirme hedefleri. */
export function factoryTerraces(): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let f = 1; f < FACTORY.floors; f++) {
    out.push({
      x: FACTORY.left + FACTORY.setback * (f - 1) + 2.2,
      y: FACTORY.floorHeight * f,
    });
  }
  out.push({
    x: FACTORY.left + FACTORY.setback * (FACTORY.floors - 1) + 1.2,
    y: FACTORY.floorHeight * FACTORY.floors,
  });
  return out;
}

export function createFactoryBody(world: World): Body {
  const body = world.createBody();
  for (let f = 0; f < FACTORY.floors; f++) {
    const left = FACTORY.left + FACTORY.setback * f;
    const top = FACTORY.floorHeight * (f + 1);
    const hw = (FACTORY.right - left) / 2;
    const hh = top / 2;
    body.createFixture(new Box(hw, hh, { x: left + hw, y: hh }, 0), { friction: 0.8 });
    // Teras kenarındaki korkuluk — yükün önce aşıp sonra inmesini zorluyor
    if (f < FACTORY.floors - 1) {
      body.createFixture(new Box(0.12, FACTORY.parapetHeight / 2,
        { x: left + 0.12, y: top + FACTORY.parapetHeight / 2 }, 0), { friction: 0.7 });
    }
  }
  return body;
}

/** Sahaya dağılmış kasalar — hem dekor hem fiziğin çalıştığının kanıtı. */
export interface Prop { body: Body; hw: number; hh: number; }

export function scatterProps(world: World, snaps: Snapshotter): Prop[] {
  const layout: Array<[number, number, number]> = [
    // [x, yarı-genişlik, yarı-yükseklik]
    // Kamyonun BAŞLANGIÇ NOKTASININ SOLUNDA. İki kez taşındılar: önce 44-46'da,
    // sonra 15-22'de duruyorlardı ve her seferinde kamyon onları 40 metre önüne
    // katıp çalışma alanına sürükledi — kanca kasaya takıldı, araç üstlerine
    // çıkıp 5 derece yattı. Yan görünümde "yolun kenarı" diye bir yer yok.
    [-11, 0.42, 0.5], [-9.7, 0.42, 0.5], [-10.3, 0.42, 0.5],
    [-5.5, 0.7, 0.45], [-3.9, 0.7, 0.45],
  ];
  return layout.map(([x, hw, hh]) => {
    const body = world.createDynamicBody({ x, y: hh + 0.05 });
    body.createFixture(new Box(hw, hh), { density: 240, friction: 0.7, restitution: 0.03 });
    body.setAngularDamping(0.4);
    snaps.track(body);
    return { body, hw, hh };
  });
}

export { Vec2 };
