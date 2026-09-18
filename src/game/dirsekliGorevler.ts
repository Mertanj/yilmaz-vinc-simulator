import type { Task } from './tasks';

/**
 * Bölüm 1 — "Dar Sokak" görev listesi (YV-9 dirsekli bom).
 *
 * **Kodlar S (Sokak), D değil.** Önce D1–D5 yazılmıştı ve forkliftin depo
 * görevleri de D1–D5 kullanıyor. `gorevAdi`/`gorevBrifi` sözlüğe KODLA
 * bakıyor, dolayısıyla dirsekli bomun ilk görevi ekranda "Çimento paleti —
 * bıçağı paletin cebine sok" diye çıkıyordu: forkliftin metni, vincin
 * makinesi. Kodlar bölümler arasında tekil olmak zorunda.
 *
 * **Ağırlıklar ölçülen kapasiteden geriye hesaplandı.** `npm run zarf` erişim
 * tablosu hedeflerin yarıçapını ve kapasitesini veriyor —
 *
 *   H0 (avlu zemini)     kot 0.0 m   R 4.53 m   kapasite 1.99 t
 *   H1 (1. kat terası)   kot 2.4 m   R 6.03 m   kapasite 1.49 t
 *   H2 (2. kat terası)   kot 4.8 m   R 7.63 m   kapasite 1.18 t
 *   H3 (en üst dam)      kot 7.2 m   R 9.23 m   kapasite 0.97 t
 *
 * **Briflerde METRE YAZMIYOR ve bu kasıtlı.** Yazıyordu ve kat yüksekliği
 * 2.6'dan 2.4'e inince üç ayrı yerde üç ayrı sayı kaldı: brifler "5.2 ve
 * 7.8", avlu.ts yorumu "2.8 · 5.6 · 8.4", gerçek ise 2.4 · 4.8 · 7.2.
 * Hedefin ADI kaymıyor, kotu kayıyor.
 *
 * — ve yükler hedeflenen LMI eğrisini (%60 → %74 → %85 → %92 → %96) verecek
 * şekilde seçildi; kanca 0.12 t brüte dahil.
 *
 * **Yarı genişlikler 0.6 m'yi geçmiyor** ve bu iki yerden birden geliyor:
 * teras cebi 1.46 m (kademe 1.6, eksi korkuluğun 14 santimi), ve malzemenin
 * sokaktaki cebi arka pabuçla duvar arasında 2 metre. 1.1'lik kademede cep
 * 96 santimdi ve yük SIĞMIYORDU: 63 dereceye dönüp kama gibi sıkışıyordu.
 *
 * **Sıralama iki kontrollü deney içeriyor.** G1 ile G2 aynı yükü FARKLI
 * yarıçapa taşıyor, G1 ile G3 ise aynı yere FARKLI ağırlık koyuyor. Tablonun
 * "yer" değil "yarıçaptaki yük" ile ilgili olduğunu anlatmanın en ucuz yolu
 * bu; vinç bölümündeki T1/T2 çiftiyle aynı fikir, burada iki eksene birden
 * yayılmış hâli.
 *
 * Yükler bahçe inşaatından: briket, donatı, kum, kalıp, beton kovası.
 */
/**
 * Yük YUKARI ÇIKTIKÇA HAFİFLİYOR ve bu tesadüf değil: kapasite moment/yarıçap,
 * yukarı çıkan teras aynı zamanda uzaklaşıyor. Fabrika bölümünde de aynı eğri
 * vardı ve sahadaki kuralın ta kendisi.
 */
export const DIRSEKLI_GOREVLER: readonly Task[] = [
  {
    kod: 'S1', ad: 'Briket paleti', tonnes: 1.05,
    halfWidth: 0.55, halfHeight: 0.42, kind: 'briket', hedef: 0,
    brif: 'Briket paleti — duvarı aş, avlu zeminine bırak. Isınma turu.',
  },
  {
    kod: 'S2', ad: 'Kum torbası', tonnes: 0.98,
    halfWidth: 0.55, halfHeight: 0.50, kind: 'kum', hedef: 1,
    brif: 'Aynı ağırlık, bu kez 1. kat terasına — korkuluğu aşıp arkasına inecek',
  },
  {
    kod: 'S3', ad: 'Demir donatı', tonnes: 0.88,
    halfWidth: 0.55, halfHeight: 0.22, kind: 'donati', hedef: 2,
    brif: '2. kat terası — buraya teleskobu uzatmadan varamazsın',
  },
  {
    kod: 'S4', ad: 'Kalıp paneli', tonnes: 0.77,
    halfWidth: 0.55, halfHeight: 0.35, kind: 'kalip', hedef: 3,
    brif: 'En üst dam — bomun sonu. Korkuluk yok, pay da yok.',
  },
  {
    kod: 'S5', ad: 'Beton kovası', tonnes: 1.01,
    halfWidth: 0.50, halfHeight: 0.62, kind: 'kova', hedef: 2,
    brif: 'Dolu beton kovası — 2. kata, en ağır yük. İbre %96.',
  },
];
