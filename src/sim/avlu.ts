import { Box, type Body, type World } from 'planck';

/**
 * Bölüm 1 — "Dar Sokak": bahçe duvarı, avlu ve yarım kalmış ev.
 *
 * **Bölümün varlık sebebi makinenin kendisi.** Teleskopsuz düz bir bomun ucu
 * her zaman ayaktan sabit uzaklıkta, yani bir ÇEMBER üstünde gezer. Kırma
 * bomun ucu ise bir ALANIN içini tarıyor: aynı yarıçapta ucu yukarı da aşağı
 * da götürebiliyor. Duvarın ardındaki avluya inmek tam olarak bunu istiyor.
 *
 * **Yerleşim zarf HARİTASINDAN çıkarıldı, sınırlarından değil.** İlk yerleşim
 * "R 4.5'te uç 10.18 metreye çıkıyor" satırına bakılarak kurulmuştu ve
 * oynanamadı: aynı yarıçapta 6 metre kotu hiç erişilmiyordu, çünkü iki kollu
 * zincirin zarfı ortasında delikli. `npm run zarf` artık haritayı çiziyor ve
 * buradaki her kot o haritadan seçildi:
 *
 *   yükün duvarı aşması  → uç R 4.3–4.7'de 6.0–6.5 m'ye çıkmalı   ✓ harita
 *   zemin kat döşemesi   → uç R 5.5'te 4.0 m                      ✓ harita
 *   üst kat döşemesi     → uç R 6.8'de 6.4 m                      ✓ harita
 *   avlu zemini          → uç R 8.3'te 1.9 m                      ✓ harita
 *
 * Kamyonun ayak izi de ölçüldü (ön pabuç şasi+4.93, arka pabuç şasi-5.43,
 * tabla şasi-4.20); malzeme arka pabucun 1.9 m ötesinde duruyor.
 */
export const AVLU = {
  /**
   * Yarım kalmış ev — TEK KATLI, avlunun dibinde.
   *
   * Önce kademeli iki kat denendi (üst kat geri çekik) ve oynanamadı: evin
   * sağ ucu ile bahçe duvarı arasında 30 santimlik bir yarık kalıyor, kanca
   * oraya düşüp sıkışıyordu — rig ikinci görevde yükü hiç alamadı. Evi
   * genişletmek yarığı kapatıyor ama bu sefer bırakma cebi 1.2 metreye
   * iniyor; üst katı uzağa koymak ise erişilemez hâle getiriyor (o kotta
   * makinenin menzili R 7.5'te bitiyor, ev ise 8'in ötesinde).
   *
   * Beş metrelik bir avluya üç yapı sığmıyor. Tek katlı ev, açık avlu: iki
   * hedef damın üstünde farklı derinliklerde, biri açık zeminde. Vinç
   * bölümündeki teras deseninin aynısı, ve o desen ölçülerek oturmuştu.
   */
  evSol: 1.9,
  evSag: 4.2,
  evDosemeY: 2.6,

  /**
   * Bahçe duvarı: x aralığı ve yüksekliği.
   *
   * 3.2 m, 4.2 değil. Yükün duvarı aşması için ucun duvarın yarıçapında
   * `duvar + yük + halat` kadar yükselmesi gerekiyor ve zarf haritası o kotu
   * kısa yarıçapta vermiyor: 4.2'lik duvar için gereken 6.1 metrelik uç,
   * R 4.5'te zarfın deliğine düşüyordu. 3.2'de gereken 5.1 metre ve harita
   * onu R 3'ten itibaren veriyor — yani duvarı aşmak artık bir hüner, imkânsız
   * değil. (Ölçülen pay: 28 cm.)
   */
  duvarSol: 6.9,
  duvarSag: 7.3,
  duvarY: 3.2,

  /** Malzemenin sokağa indirildiği nokta. */
  malzemeX: 8.3,

  /**
   * Park yeri: şasi merkezinin geleceği yer. **Fiziksel takoz YOK.**
   *
   * Takoz denendi ve ölçüm eledi. Arkaya konamıyor: açılmış arka pabuç
   * kuyruğun 63 cm ÖTESİNE bastığı için kuyruğu durduran her şey pabucun
   * ineceği yerde kalıyor. Pabucun altından geçecek kadar alçak bir takoz
   * (0.25–0.45 m) ise aracı hiç durdurmuyor — tarama yapıldı, üçünde de arka
   * teker takozu tırmanıp yoluna devam etti; ancak 0.55 m'de durdu, o da
   * tekerle değil toplu pabuçla. Öne konamıyor, çünkü bu makine kuyruğunun
   * üstünden çalışıyor ve öne yanaşmak çalışma alanını arkada bırakıyor.
   *
   * Yerine sokağa boyalı bir park cebi çizildi. Oyuncu geri geri yanaşıp
   * cebe oturuyor; erken durursa hedefler yaklaşır, geç durursa uzaklaşır ve
   * ikisini de HUD'daki yarıçap satırı anında söylüyor. Fazla kaçarsa kuyruk
   * bahçe duvarına çarpıyor — gerçek ve okunur bir ceza.
   */
  parkX: 15.1,
  /** Park cebinin yarı uzunluğu (m) — çizim ve "yerinde mi" denetimi için. */
  parkPayiM: 1.2,

  /**
   * Kamyonun doğduğu yer — sokağın ilerisi.
   *
   * **Geri geri yanaşıyor, çünkü başka türlü olmuyor.** Vinç bölümünde kamyon
   * ileri gidip takoza yanaşıyor; orada çalışma alanı BURUNDA. Burada arkada,
   * ve bir aracın işi yapacağı yerin ötesine geçip oraya ileri yanaşması
   * mümkün değil — geçerken çalışma alanının üstünden geçmiş olur. Dar sokakta
   * vinç kamyonunu geri geri yanaştırmak zaten sahadaki hâli.
   */
  spawnX: 24,

  /**
   * Park edildiğinde tablanın geleceği yer — ÖLÇÜLEN değer.
   *
   * Şasi 15.11'de duruyor, tabla şasi-4.20'de, ama ayaklar açılırken araç
   * 31 santim ileri kayıyor; tabla 11.16'ya oturuyor. Hedef yarıçapları
   * buna göre, kağıt üstündeki 10.7'ye göre değil.
   */
  tablaX: 11.16,
} as const;

/**
 * Hedefler: yükün bırakılacağı noktalar.
 *
 * Üç yer, beş görev. Ölçülen tablaya (11.16) göre yarıçaplar 5.56 · 7.46 ·
 * 8.36 m, kapasiteler 1.62 · 1.21 · 1.08 t.
 *
 * **En uzak hedef 2.4'ten 2.8'e alındı.** 2.4'te yarıçap 8.76 çıkıyor ve
 * makinenin menzili 8.95'te bitiyor — 19 santimlik payla çalışmak ters
 * kinematiği zarfın kenarına dayıyor, rig yükü 86 cm eksik bırakıyordu.
 *
 * İkisi aynı damda, farklı derinlikte: oyuncu tablonun YER değil YARIÇAP
 * meselesi olduğunu aynı düzlemin üstünde görüyor.
 */
export function avluHedefleri(): Array<{ x: number; y: number }> {
  return [
    { x: 5.6, y: 0 },                // 0 · avlu zemini, duvarın hemen ardı
    { x: 3.7, y: AVLU.evDosemeY },   // 1 · damın ön ucu
    { x: 2.8, y: AVLU.evDosemeY },   // 2 · damın dibi — en uzak
  ];
}

/** Bahçe duvarı ve yarım kalmış ev — tek statik gövde. */
export function createAvlu(world: World): Body {
  const body = world.createBody();
  const kutu = (sol: number, sag: number, ust: number): void => {
    const hw = (sag - sol) / 2;
    body.createFixture(new Box(hw, ust / 2, { x: sol + hw, y: ust / 2 }, 0),
      { friction: 0.8 });
  };
  kutu(AVLU.evSol, AVLU.evSag, AVLU.evDosemeY);
  kutu(AVLU.duvarSol, AVLU.duvarSag, AVLU.duvarY);
  return body;
}
