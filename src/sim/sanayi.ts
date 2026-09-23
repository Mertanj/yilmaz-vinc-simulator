import type { VincBolum } from './vincBolum';
import { createFactoryBody, factoryTerraces } from './world';
import { TASKS, MALZEME_X } from '../game/tasks';

/**
 * Bölüm 1 — "Sanayi sitesi, C Blok": beş katlı kademeli fabrika.
 *
 * Yerleşimin sayıları; hepsi ölçümle geldi ve gerekçeleri yanlarında.
 */
export const SANAYI = {
  factoryX: 62,
  setupX: 52,
  /**
   * Kurulum alanının yarı eni (m) — çizim de, ipucu da BURADAN okuyor.
   *
   * Sayı çizimde tek başına duruyordu; oyuncuya yeşil "alandasın" işaretini
   * verince iki yerde yaşamaya başlayacaktı. Bu projede ayrışan iki kopya
   * (çizim ile fizik) daha önce teras kotunu kaydırdı; aynı hatayı işaretlerde
   * tekrarlamanın anlamı yok.
   */
  setupYariEn: 5.2,
  /**
   * Takoz kamyonu burada durduruyor. 57.2'den öne alındı — kamyon yaklaştıkça
   * bütün yarıçaplar kısalıyor ve üst katlar erişilebilir oluyor.
   *
   * 58.5 DENENDİ ve olmadı: takoz kutusu 58.15–58.85 arasını kaplıyor, yükün
   * sol kenarı ise 58.35'te. İkisi doğuşta iç içe giriyor, planck da onları
   * ayırmak için yükü 60 santim ileri fırlatıyordu. Sahne kurulurken çakışma
   * denetimi (`overlaps`) artık bunu yakalıyor.
   */
  kerbX: 57.9,
  /** Malzeme alanının merkezi — her görevin yükü buraya geliyor. */
  malzemeX: MALZEME_X,
} as const;

/** Terasların ön kenarı ve kotu — bir kez hesaplanıyor, fonksiyon saf. */
const teraslar = factoryTerraces();

export const SANAYI_SITESI: VincBolum = {
  id: 'sanayi',
  kur: (world) => { createFactoryBody(world); },
  kerbX: SANAYI.kerbX,
  setupX: SANAYI.setupX,
  setupYariEn: SANAYI.setupYariEn,
  gorevler: TASKS,
  yukYeri: (t) => ({ x: SANAYI.malzemeX, y: t.halfHeight + 0.05 }),
  kalici: false,
  hedefNoktasi: (t) => teraslar[t.hedef] ?? null,
  /** Teras geniş: kör kaldırmada iki metrelik pencere adil. */
  yerlestirmeToleransi: () => ({ x: 2.0, y: 0.4 }),
  /** Vinçin ölçülmüş kalibrasyonu: başsız turda görev başına 139–215 s. */
  hizEsikleri: { tam: 90, sifir: 240 },
  kameraOlcegi: { yakin: 30, uzak: 15 },
};
