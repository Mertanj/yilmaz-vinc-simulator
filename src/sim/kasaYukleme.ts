import { Vec2, type World } from 'planck';
import { KASA_TABANI, type DirsekliBolum } from './dirsekliBolum';
import type { Task } from '../game/tasks';
import { TRUCK } from './truck';
import { M, kumandaAdi } from '../ui/dil';

/**
 * Bölüm 2 — "Kasa yükleme": depodaki malzemeyi kendi kasana sıkı istifle.
 *
 * Dirsekli kamyonun sahadaki asıl işi bu: malzemeyi depodan kendi kasasına
 * alıp şantiyeye götürmek. Forklift rampasında oyuncunun en sevdiği şey
 * dorseyi sıkı yüklemekti; burada aynı ders SALINAN yükle — çatal yükü
 * bıraktığın yerde tutuyordu, kanca tutmuyor.
 *
 * **Kolon bu bölümde KABİNİN ARKASINDA.** Birinci bölümde kasanın en
 * arkasındaydı ve bom yalnız kuyruğa doğru çalışıyor (döner tabla yok): öyle
 * monteli bir vinç kendi kasasına hiç erişemez, kasa kolonun öbür tarafında
 * kalır. Kendi kasasını yükleyen kırma bomlu kamyonun en yaygın hâli de
 * kabin arkası montaj — bom kasanın üstünden kuyruğa ve ötesine uzanıyor.
 *
 * **Kritik an yine ALMA.** Palet kuyruğun 1.9 metre arkasında, kolona 8.4
 * metre: orada kapasite 1.07 ton ve ibre %80-95. Kasaya giden yük kolona
 * yaklaşıyor; ilk sıra kolonun hemen arkasında, 1.3 metrede — bomu dibine
 * kadar katlamayı gerektiren yer orası.
 */
export const YUKLEME = {
  /** Kamyonun doğduğu yer — depo avlusunun girişi; geri geri yanaşıyor. */
  spawnX: 28,
  /** Park yeri: şasi merkezinin geleceği yer. Fiziksel takoz yok (bkz. AVLU). */
  parkX: 16.0,
  parkPayiM: 1.2,

  /** Kolon, şasi yerel x'i: kabinin (arka yüzü +2.2) hemen arkası. */
  montajX: 1.7,
  /**
   * Kasa, şasi yerel x'i. Ön duvarın yüzü kolondan 70 cm geride: ilk sıra
   * kolona 1.3 metre ve ucun oraya inebildiği en yakın yer bu civar (zarf
   * haritası: 3-4 metre kotta R 1.0'dan başlıyor).
   */
  kasaOn: 1.0,
  kasaArka: -TRUCK.chassisHalfLength,

  /**
   * Yükleme karesi, şasi yerel x'i: kolondan 8.4 m, kuyruktan 1.9 m geride.
   * Arka pabuç (-5.43) ile arası 1.3 m: en geniş palet (yarı en 0.5) iki
   * yanında 80 santim payla duruyor.
   */
  malzemeYerel: 1.7 - 8.4,

  /** Depo cephesi ve bekleme sırası (dünya x). */
  depoCephe: 1.0,
  siraBasi: 2.2,
  siraAraligi: 1.3,
} as const;

/** Kasadaki bir sıra: görev sırasıyla, ön duvardan kuyruğa. */
const ARALIK = 0.08;
const ON_PAY = 0.06;

/**
 * Beş palet — kasanın önünden arkasına.
 *
 *   N1  Briket paleti   0.82 t  → 1. sıra, ön duvara
 *   N2  Çimento paleti  0.85 t  → 2. sıra
 *   N3  Kum torbası     0.80 t  → 3. sıra: salınan yumuşak yük
 *   N4  Fayans paleti   0.75 t  → 4. sıra
 *   N5  Kalıp paketi    0.60 t  → 5. sıra, kuyruğa en yakın
 *
 * Toplam en 4.8 m; kasa 5.8 m. Arada 60 santim pay var ve bilerek dar:
 * her palet bir öncekinin gerçek yerine dayanıyor, dolayısıyla boşluk
 * bırakan oyuncunun hatası birikmiyor ama sona doğru yeri daralıyor.
 */
export const YUKLEME_GOREVLERI: readonly Task[] = [
  {
    kod: 'N1', ad: 'Briket paleti', tonnes: 0.82,
    halfWidth: 0.5, halfHeight: 0.45, kind: 'briket', hedef: 0,
    brif: 'Kasanın dibine, kolonun arkasına: bomu katla, ön duvara dayat',
  },
  {
    kod: 'N2', ad: 'Çimento paleti', tonnes: 0.85,
    halfWidth: 0.5, halfHeight: 0.4, kind: 'cimento', hedef: 1,
    brif: 'Öndekine boşluksuz yanaştır — dorsedeki gibi, ama yük sallanıyor',
  },
  {
    kod: 'N3', ad: 'Kum torbası', tonnes: 0.8,
    halfWidth: 0.45, halfHeight: 0.5, kind: 'kum', hedef: 2,
    brif: 'Big bag: salınımı söndür, sonra indir — yumuşak yük geri tepmez',
  },
  {
    kod: 'N4', ad: 'Fayans paleti', tonnes: 0.75,
    halfWidth: 0.5, halfHeight: 0.35, kind: 'fayans', hedef: 3,
    brif: 'Dördüncü sıra: kasanın ortası geçildi, pay azalıyor',
  },
  {
    kod: 'N5', ad: 'Kalıp paketi', tonnes: 0.6,
    halfWidth: 0.45, halfHeight: 0.35, kind: 'kalip', hedef: 4,
    brif: 'Son sıra, kuyruğa en yakın: öndekiler sıkıysa yer var',
  },
];

/** Kasa tabanının şasi yerel y'si. */
const KASA_USTU = TRUCK.chassisHalfHeight + KASA_TABANI;

export const KASA_YUKLEME: DirsekliBolum = {
  id: 'dirsekli-kasa',
  // Depo avlusunda fizik gövdesi yok: palet zemine, yük kasaya iniyor.
  kur: (world: World) => { void world; },
  spawnX: YUKLEME.spawnX,
  malzemeX: YUKLEME.parkX + YUKLEME.malzemeYerel,
  gorevler: YUKLEME_GOREVLERI,
  montajX: YUKLEME.montajX,
  kasa: { on: YUKLEME.kasaOn, arka: YUKLEME.kasaArka },
  malzemeYerel: YUKLEME.malzemeYerel,
  kalici: true,
  park: { x: YUKLEME.parkX, payM: YUKLEME.parkPayiM },
  bekleyenX: (sira) => YUKLEME.siraBasi + YUKLEME.siraAraligi * sira,

  /**
   * Kasadaki sıra — **bir öncekinin GERÇEK yerine dayanarak.** Forklift
   * dorsesindeki kural: sabit sıralar ilk paletin 15 santimlik hatasını beş
   * palet boyunca biriktirirdi.
   */
  hedefNoktasi(t: Task, baglam) {
    if (!baglam) return null;
    const { sasi, konanlar } = baglam;
    const kasaUstuY = (x: number): number => {
      const yerel = sasi.getLocalPoint(new Vec2(x, 0));
      return sasi.getWorldPoint(new Vec2(yerel.x, KASA_USTU)).y;
    };
    const sira = t.hedef;
    const onceki = sira > 0 ? YUKLEME_GOREVLERI[sira - 1] : undefined;
    const komsu = onceki ? konanlar.get(onceki.kod) : undefined;
    let x: number;
    if (komsu) {
      x = komsu.x - komsu.hw - ARALIK - t.halfWidth;
    } else {
      // İlk sıra (ya da komşusu henüz yok): ön duvardan geriye nominal dizi.
      let yerel = YUKLEME.kasaOn - ON_PAY;
      for (const g of YUKLEME_GOREVLERI) {
        if (g.hedef === sira) { yerel -= g.halfWidth; break; }
        yerel -= g.halfWidth * 2 + ARALIK;
      }
      x = sasi.getWorldPoint(new Vec2(yerel, KASA_USTU)).x;
    }
    return { x, y: kasaUstuY(x) };
  },
  /**
   * Pencere dorsedekiyle aynı ve aynı sebeple dar: hedef zaten öndeki yükün
   * gerçek yerinden, bu pay yalnız "komşuna sıkı otur" dersinin toleransı.
   */
  yerlestirmeToleransi() { return { x: 0.22, y: 0.3 }; },
  /**
   * Başsız tur görev başına 38–73 s (ortalama 53): bölüm kısa ve yükler hep
   * aynı yerden kalkıyor. Öbür bölümlerin oranı korunuyor — rig tam bonus
   * eşiğinin biraz üstünde, yani onu geçen oyuncu tam puanı hak ediyor.
   */
  hizEsikleri: { tam: 50, sifir: 170 },
  kameraOlcegi: { yakin: 46, uzak: 26 },

  surusIpucu(sasiX) {
    const k = M.dirsekli.ipucu;
    const t = kumandaAdi();
    if (sasiX < YUKLEME.parkX - YUKLEME.parkPayiM) return { metin: k.cebiGectinDepo, mod: 'drive' };
    if (sasiX <= YUKLEME.parkX + YUKLEME.parkPayiM) return { metin: k.cepte(t), mod: 'ready' };
    return { metin: k.yanasma(t), mod: 'drive' };
  },
};
