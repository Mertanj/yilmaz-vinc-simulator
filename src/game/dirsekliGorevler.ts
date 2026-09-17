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
 *   H0 (avlu zemini)     R 5.56 m   kapasite 1.62 t
 *   H1 (damın ön ucu)    R 7.46 m   kapasite 1.21 t
 *   H2 (damın dibi)      R 8.36 m   kapasite 1.08 t
 *
 * — ve yükler hedeflenen LMI eğrisini (%63 → %76 → %85 → %90 → %97) verecek
 * şekilde seçildi; kanca 0.12 t brüte dahil.
 *
 * **Yarı genişlikler 0.6 m'yi geçmiyor** ve bu da ölçüyle konmuş bir sınır:
 * avluda bırakma cepleri dar (alt döşemenin açık ucu 1.2 m, üst kat 1.4 m) ve
 * daha geniş bir yük salınımın en ufak artığında eve çarpıp sıkışıyordu.
 *
 * **Sıralama iki kontrollü deney içeriyor.** G1 ile G2 aynı yükü FARKLI
 * yarıçapa taşıyor, G1 ile G3 ise aynı yere FARKLI ağırlık koyuyor. Tablonun
 * "yer" değil "yarıçaptaki yük" ile ilgili olduğunu anlatmanın en ucuz yolu
 * bu; vinç bölümündeki T1/T2 çiftiyle aynı fikir, burada iki eksene birden
 * yayılmış hâli.
 *
 * Yükler bahçe inşaatından: briket, donatı, kum, kalıp, beton kovası.
 */
export const DIRSEKLI_GOREVLER: readonly Task[] = [
  {
    kod: 'S1', ad: 'Briket paleti', tonnes: 0.90,
    halfWidth: 0.55, halfHeight: 0.42, kind: 'briket', hedef: 0,
    brif: 'Briket paleti — duvarı aş, avlu zeminine bırak',
  },
  {
    kod: 'S2', ad: 'Demir donatı', tonnes: 0.80,
    halfWidth: 0.60, halfHeight: 0.22, kind: 'donati', hedef: 1,
    brif: 'Daha hafif ama damın üstüne — yarıçap 1.9 metre uzadı, ibre yükseldi',
  },
  {
    kod: 'S3', ad: 'Kum torbası', tonnes: 1.25,
    halfWidth: 0.58, halfHeight: 0.50, kind: 'kum', hedef: 0,
    brif: 'S1 ile aynı yere, 350 kilo daha ağır — sınırı yer değil ağırlık koyuyor',
  },
  {
    kod: 'S4', ad: 'Kalıp paneli', tonnes: 0.85,
    halfWidth: 0.60, halfHeight: 0.35, kind: 'kalip', hedef: 2,
    brif: 'Kalıp panelleri — damın dibine, bomun sonu',
  },
  {
    kod: 'S5', ad: 'Beton kovası', tonnes: 1.05,
    halfWidth: 0.50, halfHeight: 0.62, kind: 'kova', hedef: 1,
    brif: 'Dolu beton kovası — ağır ve uzak, ibre %97',
  },
];
