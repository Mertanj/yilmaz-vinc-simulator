import { Box, type Body, type World } from 'planck';

/**
 * Bölüm 1 — "Dar Sokak": bahçe duvarı ve duvarın ardında yükselen kaba inşaat.
 *
 * **Bölüm bir kez yeniden kuruldu ve sebebi geri bildirimdi:** ilk hâlinde
 * hedefler 0 ile 2.6 metre arasındaydı, yani bütün iş 2.6 metrelik bir bantta
 * geçiyordu. Sahadan gelen cümle şuydu: *"yerleştirme forklifte benzemiş ve
 * çok kaliteli durmuyor."* Haklı çıkan teşhis: vinç bölümünü vinç bölümü yapan
 * şey yükün YUKARI gitmesi. Orada yük beş katlı bir binanın teraslarına
 * çıkıyor; burada yerde bir yerden yerde başka bir yere gidiyordu.
 *
 * Şimdi hedefler 0 · 2.8 · 5.6 · 8.4 metrede, yani yük 8.4 metre tırmanıyor.
 * Bunu mümkün kılan şey teleskop: sabit kollu hâlinde makinenin R 4.5'te
 * erişebildiği en yüksek kot 4.5 metreydi (zarf haritasındaki delik), şimdi
 * 13.2 metre.
 *
 * **Teleskopik vinçten farkı ne, o zaman?** Orada bina 34 metre uzunluğunda ve
 * vinç 22 metre yarıçapta çalışıyor; burada her şey 10 metrelik bir avluda ve
 * arada 3 metrelik bir duvar var. Aynı işin dar alan hâli — ve bu makinenin
 * sahadaki gerekçesi tam olarak o.
 *
 * Yerleşim zarf HARİTASINDAN çıkarıldı, sınırlarından değil (bkz. `npm run
 * zarf` bölüm 7). Kamyonun ayak izi de ölçüldü: ön pabuç şasi+4.93, arka pabuç
 * şasi-5.43, tabla şasi-4.20.
 */
export const AVLU = {
  /**
   * Kaba inşaat — KADEMELİ, dört kat.
   *
   * Kademe fabrika binasındaki kararın aynısı ve sebebi de aynı: düz cepheli
   * bir blokta üst kat alttakinin üstünü kapatıyor ve alt terasa yük indirmek
   * fiziksel olarak imkânsız hale geliyor. Her kat 1.1 m geri çekiliyor,
   * altındakinin damı üsttekinin terası oluyor.
   *
   * En üst dam korkuluksuz ve hedef: fabrika binasında çatı erişilemediği
   * için hedef değildi, burada kat sayısı üçe indiği için erişiliyor.
   *
   * **Kat yüksekliği 2.6'dan 2.4'e indi ve sebebi ölçüm.** 2.6'da en üst dam
   * 7.8 metrede ve yarıçapı 9.23; orada ucun çıkabildiği en yüksek kot 9.70
   * metre, yükün dama değmeden asılı durması için gereken ise 10.3. Fark
   * yükü tam dam hizasında sallandırıyordu: rig yükü hedefin 64 cm solunda,
   * sürtünerek bırakıyordu (diğer dördü 1–11 cm). 2.4'te dam 7.2 metrede ve
   * pay 40 santim.
   */
  evSagKenar: 6.6,
  evSolKenar: 1.8,
  katYuksekligi: 2.4,
  katSayisi: 3,
  /**
   * Kademe (m) — TERAS CEBİNİN genişliği bundan çıkıyor ve ölçümle büyüdü.
   *
   * 1.1 idi ve oynanmadı: korkuluğun 14 santimi düşünce cep 96 santim
   * kalıyor, en geniş yük ise 1.16 metre. Yük cebe girmiyor, 63 dereceye
   * dönüp üst katın yüzü ile alt terasın korkuluğu arasına kama gibi
   * sıkışıyordu (ölçümde hız 0.00, açı 63°, iki dakika boyunca öyle kaldı).
   * 1.6'da cep 1.46 metre ve en geniş yük iki yanında 15 santim payla
   * oturuyor.
   *
   * Kademeyi büyütmenin bedeli var ve o da ölçüldü: her kat geriye gidince
   * yarıçap büyüyor. Bu yüzden kat sayısı 4'ten 3'e, kat yüksekliği 2.8'den
   * 2.6'ya indi — en üst teras (7.8 m) R 9.03'te ve orada ucun çıkabildiği
   * en yüksek kot 10.13 m, gereken 9.5. 4 kat / 1.6 kademe denendi ve en üst
   * teras erişilemez çıktı.
   */
  kademe: 1.6,
  /** Teras kenarındaki korkuluk — yükün önce aşıp sonra inmesini zorluyor. */
  korkulukY: 0.85,

  /** Bahçe duvarı: x aralığı ve yüksekliği. */
  duvarSol: 8.0,
  duvarSag: 8.4,
  duvarY: 3.0,

  /**
   * Malzemenin sokağa indirildiği nokta.
   *
   * Arka pabuç (şasi-5.43) ile duvarın sağ yüzü arasında 2 metre var; yük
   * ortasına, 0.6 metrelik yarı genişlikle iki tarafa 30–47 santim payla
   * oturuyor. Daha geniş bir yük bu cebe sığmaz — görev listesindeki yarı
   * genişlik sınırı buradan geliyor.
   */
  malzemeX: 9.4,

  /**
   * Park yeri: şasi merkezinin geleceği yer. **Fiziksel takoz YOK.**
   *
   * Takoz denendi ve ölçüm eledi. Arkaya konamıyor: açılmış arka pabuç
   * kuyruğun 63 cm ÖTESİNE bastığı için kuyruğu durduran her şey pabucun
   * ineceği yerde kalıyor. Pabucun altından geçecek kadar alçak bir takoz
   * (0.25–0.45 m) ise aracı hiç durdurmuyor — tarandı, üçünde de arka teker
   * tırmandı; ancak 0.55 m'de durdu, o da tekerle değil toplu pabuçla. Öne
   * konamıyor, çünkü bu makine kuyruğunun üstünden çalışıyor.
   *
   * Yerine sokağa boyalı bir park cebi çizildi; cebi geçerse ipucu söylüyor.
   */
  parkX: 15.7,
  parkPayiM: 1.2,

  /** Kamyonun doğduğu yer — sokağın ilerisi; geri geri yanaşıyor. */
  spawnX: 24,

  /** Park edildiğinde tablanın geleceği yer. Hedef yarıçapları buna göre. */
  tablaX: 11.49,
} as const;

/** Bir katın sağ (sokağa bakan) kenarı. */
function katSagKenar(kat: number): number {
  return AVLU.evSagKenar - AVLU.kademe * kat;
}

/**
 * Hedefler: yükün bırakılacağı noktalar.
 *
 * Dört yer, beş görev. Kotlar 0 · 2.8 · 5.6 · 8.4 m ve yarıçaplar tabla
 * 11.2'ye göre 4.5 · 5.7 · 6.8 · 8.3 m; kapasiteler 2.00 · 1.58 · 1.32 ·
 * 1.08 t. Yük yukarı çıktıkça hem uzaklaşıyor hem hafiflemek zorunda —
 * sahadaki kuralın ta kendisi.
 *
 * Teras hedefleri kademenin ORTASINA konuyor: kademe 1.1 m ve korkuluk
 * terasın ön kenarında, dolayısıyla yükün 0.6 metreden geniş olmaması
 * gerekiyor.
 */
export function avluHedefleri(): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [
    // 0 · avlu zemini, duvar ile binanın arası — ısınma turu
    { x: 7.3, y: 0 },
  ];
  // 1..n · her katın damı: bir üst katın önünde kalan şerit
  for (let k = 1; k <= AVLU.katSayisi - 1; k++) {
    out.push({ x: katSagKenar(k) + AVLU.kademe / 2, y: AVLU.katYuksekligi * k });
  }
  // Son: en üst dam, korkuluksuz.
  out.push({
    x: (AVLU.evSolKenar + katSagKenar(AVLU.katSayisi - 1)) / 2,
    y: AVLU.katYuksekligi * AVLU.katSayisi,
  });
  return out;
}

/** Bahçe duvarı ve kaba inşaat — tek statik gövde. */
export function createAvlu(world: World): Body {
  const body = world.createBody();
  const kutu = (sol: number, sag: number, alt: number, ust: number): void => {
    const hw = (sag - sol) / 2;
    const hh = (ust - alt) / 2;
    body.createFixture(new Box(hw, hh, { x: sol + hw, y: alt + hh }, 0), { friction: 0.8 });
  };

  for (let k = 0; k < AVLU.katSayisi; k++) {
    const sag = katSagKenar(k);
    const ust = AVLU.katYuksekligi * (k + 1);
    kutu(AVLU.evSolKenar, sag, 0, ust);
    // Korkuluk: son katın damında yok (oraya yük konmuyor).
    if (k < AVLU.katSayisi - 1) {
      kutu(sag - 0.14, sag, ust, ust + AVLU.korkulukY);
    }
  }

  kutu(AVLU.duvarSol, AVLU.duvarSag, 0, AVLU.duvarY);
  return body;
}
