# Bölüm 1 — "Sanayi Sitesi, C Blok"

> ⚠️ **Bu tasarım TELESKOPİK bom varsayımıyla hesaplandı.** Firma fotoğrafları
> gerçek aracın Hidrokon **katlanır bomlu** olduğunu gösterdi. Katlanır boma
> geçilirse tüm erişim geometrisi (L, θ, R) yeniden hesaplanmalı — LMI mantığı,
> yük tablosu ve kurulum penceresi mantığı aynen geçerli kalır.

Tüm sayılar `R = 0.6 + L·cos θ`, `H_uç = 2.42 + L·sin θ`, yük tablosu doğrusal
interpolasyonu ve `T = 2π√(l/g)` ile doğrulandı.

---

## 1. Binadaki geometrik imkânsızlık ve çözümü

İlk yerleşimde bina düz cepheliydi: x=62'de başlayan 34 m genişliğinde blok,
yükleme kapıları sol kenardan 2.2 m içeride. **Bu fiziksel olarak inşa
edilemez** — (64.2, 5.0) noktasına yük bırakmak için kanca ayak izinin 2.2 m
içinde sallanmalı, yani halat üstteki döşemeden, bom da sol cepheden geçerdi.

**Çözüm: kademeli (teraslı) kesit.** Her kat 4.5 m geri çekiliyor, böylece her
üst katın yükleme kapısı alttaki katın çatısının oluşturduğu açık terasa
bakıyor. Bu aynı zamanda **gerçek sanayi sitesi tipolojisi** — Başiskele Sanayi
Sitesi'nin yayınlanmış işyeri cetveli zemin katı 7×12 m, üst katı 7×5 m
veriyor: üst katlar zaten daha sığ.

| Kademe | x aralığı | Döşeme üstü y | Oluşan teras |
|---|---|---|---|
| Zemin | 62.0 – 96.0 | 5.00 | — |
| K1 | 66.5 – 96.0 | 10.00 | **K1 terası: x 62.0–66.5 @ y 5.00** |
| K2 | 71.0 – 96.0 | 15.00 | **K2 terası: x 66.5–71.0 @ y 10.00** |

Her teras kenarında 0.90 m korkuluk/parapet.

## 2. Saha yerleşimi (metre)

| Öğe | x | y | Not |
|---|---|---|---|
| Giriş yolu | 0 – 10.0 | 0 | bom yatak konumunda |
| Saha kapısı | 10.0 | açıklık 4.40 | bomu toplamaya zorlar |
| Avlu (sıkıştırılmış dolgu) | 10.0 – 38.0 | 0 | zemin taşıma 60 kPa |
| **OG direği, 34.5 kV** | **34.0** | iletkenler 8.40 / 9.20 / 10.00 | yaklaşma yasağı **r = 3.05 m** |
| Yükleme alanı | 38.0 – 45.5 | takoz üstü 0.30 | kamyon buraya yanaşır |
| **Fosseptik + yağmur hattı** | **45.8 – 49.3** | 0 | **30 kPa — AYAK YASAK** |
| Beton apron | 49.3 – 57.0 | 0 | 190 kPa |
| **Sundurma** | **57.0 – 62.0** | alt 4.35, üst 4.80 | dış kolon **x = 57.20** |
| Fabrika (kademeli) | 62.0 – 96.0 | 15.00'e kadar | sandviç panel cephe |

**Hedefler:** P1 (64.2, 5.00) · P2 (69.4, 10.00) · P3 (72.2, 15.00) · P4 (74.0, 15.00, bonus)

## 3. Kurulum penceresi — seçilmedi, türetildi

```
Arka ayak pabucu drenaj döşemesini geçmeli:
    Xc ≥ 49.30 + 0.30 + 2.55 = 52.15
Karşı ağırlık kuyruğu sundurma kolonunu 0.61 m ile geçmeli:
    Xc ≤ 57.20 − 0.61 − 3.45 = 53.14
                       YASAL PENCERE = 0.99 m
```

Ön tampon ve ön ayak daha fazlasına izin veriyor — **bağlayıcı kısıt karşı
ağırlığın kuyruk süpürmesi.** Daha yakın park ederseniz ilk dönüşte karşı ağırlık
müşterinin sundurmasını yıkar. Sundurmayı kaldıramazsınız: bu kiralık iş, sizin
binanız değil.

**Seçilen kurulum: Xc = 53.00.** Bom ayağı (53.60, 2.42).

## 4. Dört görev — tam hesap

| | Yük | t | Hedef | R (m) | L (m) | θ (°) | Kapasite | Brüt | LMI | Bölge | Salınım toleransı |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **T1** | Sac bobin | 3.20 | P1 | 11.20 | 14.19 | 41.7 | 5.84 t | 3.57 t | **%61.1** | yeşil | 47.0° |
| **T2** | CNC torna | 4.20 | P1 | 11.20 | 14.98 | 44.9 | 5.84 t | 4.60 t | **%78.8** | yeşil | 30.1° |
| **T3** | Jeneratör 100 kVA | 2.07 | P2 | 16.40 | 21.68 | 43.2 | 3.06 t | 2.64 t | **%86.3** | **sarı** | 23.0° |
| **T4** | Çatı klima santrali | 1.59 | P3 | 19.20 | 27.59 | 47.6 | 2.20 t | 2.06 t | **%93.6** | **sarı** | 15.0° |

Yükler gerçek kataloglardan: 100 kVA kabinli jeneratör 2.070 kg (3200×1100×1570),
ağır CNC torna 4.000–6.000 kg, 1250 mm × 0.5 mm × 1000 m galvaniz bobin 4.906 kg.

**Salınım toleransı** = dinamik gerilimin kırmızı kilidi tetiklediği genlik.
`T = W(3 − 2cos φ)` ile hesaplandı; 40°'de 1.468 W çıkıyor, bu da spike'ta
ölçtüğümüz "%46 artış" ile birebir uyuşuyor.

**Alma hiçbir zaman sorun değil, bırakma sorun.** Tüm alma noktaları %19–51 LMI.

## 5. Neden daha yakın park edilemiyor

Aynı dört görev, sadece park konumu değişiyor:

| Xc | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| **53.00** | %61 yeşil | %79 yeşil | %86 sarı | %94 sarı |
| 52.44 | %66 yeşil | %85 sarı | %92 sarı | **%100.0 KIRMIZI** |
| 52.15 | %69 yeşil | %89 sarı | %95 sarı | **%103.5 KIRMIZI** |
| 51.00 | %80 yeşil | **%103 KIRMIZI** | **%110 KIRMIZI** | **%115 KIRMIZI** |
| 48.00 | **%114 KIRMIZI** | **%147 KIRMIZI** | **%150 KIRMIZI** | erişilemez |

**İkinci satıra dikkat.** 52.44 *yasal pencerenin içinde* ama T4 tam %100.0'da
ölüyor. **Yasal park penceresinin alt 29 santimi bölümün son görevini sessizce
imkânsız kılıyor** — ve oyuncu bunu üç kaldırma sonra öğreniyor. Yük tablosunun
kendini öğretmesi tam olarak budur.

## 6. Teleskop tuzağı (T4)

Sezgisel hamle — "uzak, o zaman teleskopu aç" — ölümcül:

```
Önce 27.59 m'ye aç, sonra kaldır:
   θ=20° → R 26.53  LMI %209  KİLİT
   θ=30° → R 24.49  LMI %166  KİLİT
   θ=40° → R 21.74  LMI %121  KİLİT
   θ=45° → R 20.11  LMI %104  KİLİT
```

Oyuncu havada 2.06 t ile kırmızıda, teleskop-aç ve bom-indir kilitli. Kurtuluş
sadece toplamak ya da bomu kaldırmak.

```
Doğrusu — ÖNCE 60°'ye kaldır, SONRA teleskop, EN SON ayarla:
   L 14.0 θ60° → R  7.60  %21  yeşil
   L 27.6 θ60° → R 14.40  %54  yeşil
   L 27.6 θ50° → R 18.33  %85  sarı
   L 27.6 θ47.6° → R 19.20 %94 sarı — hedefte
```

**Son 2.4°'lik bom indirme 8.4 puana mal oluyor** — ibre hedefe yaklaşırken
hızlanıyor. Yeni bir operatörün hissetmesi gereken en önemli şey bu.

## 7. Zorluk eğrisi

LMI %61 → %79 → %86 → %94. Salınım toleransı 47° → 30° → 23° → 15°.
Bom 14.2 → 15.0 → 21.7 → 27.6 m. **Sarkaç hatası payı her görevde yarıya iniyor.**

T1 ve T2 kasıtlı olarak aynı noktaya bırakılıyor. Tekrar değil, oyuncunun
kendi üstünde yaptığı kontrollü deney: tek değişken (yük) değişiyor, LMI ve
salınım toleransının kaydığını görüyor. Tablonun *yer* değil *yarıçaptaki yük*
ile ilgili olduğunu öğretmenin en ucuz yolu.

## 8. Tehlikeler

**Sundurma** birincil "daha yakın gelemezsin" aracı, ve iki kez işe yarıyor:
T1'de bom sundurmanın üst köşesini sadece **0.64 m** ile geçiyor, yani oyuncu
öğretici kaldırmada kolonun bomun altından kaydığını görüyor.

**Fosseptik** kurulum penceresini alttan kapıyor. Oyunun göstermesi gereken hesap:
```
En kötü tek ayak reaksiyonu ≈ 210 kN
Çıplak 0.6×0.6 pabuç → 582 kPa — sahadaki hiçbir zemin taşımaz
Apron üstünde (95 kPa) → 1.49 × 1.49 m altlık  ✓
Drenaj döşemesinde (15 kPa) → 3.74 × 3.74 m  ✗ yasak
```

**Kör kaldırma — geometri gereği her bırakmada.** Operatör gözü (54.40, 3.40):
T1/T2 son 2.2 m, T3 son 2.9 m, T4 son 1.2 m kör. Her zaman yatay bir yüzeye
yukarı bakıyorsunuz, yani sonunda yükü hep kaybediyorsunuz. **Yer belirtici
sadece yük durduğunda ve salınımı geçtiğinde konum versin** — böylece kör
kaldırma tehlikesi doğrudan sarkaç becerisine kaynaklanıyor.

## 9. Rüzgâr — dürüst değerlendirme

`F = 0.613·v²·Cd·A`, denge sapma açısı `atan(F/W)`:

| Yük | Yelken alanı | 9 m/s | 14 m/s |
|---|---|---|---|
| Sac bobin | 1.69 m² | 0.1° | 0.3° |
| CNC torna | 5.70 m² | 0.5° | 1.1° |
| Klima santrali | 5.28 m² | 1.2° | 2.8° |
| **Boş su deposu** | **6.24 m²** | **4.0°** | **9.6°** |

**Rüzgârı devrilme tehlikesi diye satmayın — bu ağırlıklarda değil.** Tüm-durdur
eşiği olan 14 m/s'de bile klima santrali 2.8° sapıyor, 15°'lik tetik sınırının
çok altında. Rüzgârın gerçekten yaptığı şey salınım bütçesini yemek. Boş su
deposunda kullanın (tonu başına 32 kat daha rüzgâra duyarlı), gerisinde abartmayın.

## 10. Araç yeniden konumlanmalı mı — hayır

Dört görevin hepsi Xc = 53.00'ten erişilebilir. Daha iyi ikinci bir konum yok:
yakını çarpışma, uzağı kırmızı ya da erişilemez. **Serbest yeniden park, yük
tablosunun otoritesini yok eder** — her an yeniden park edebiliyorsanız yarıçap
size hiçbir şeye mal olmaz.

Bunun yerine park kararını **tek bir kurulum fazına** terfi ettiriyoruz: oyuncu
hiçbir yükü görmeden, 0.99 m'lik yasal pencere içinde bir kez park ediyor ve o
tek karar dört kaldırmayı da yönetiyor.

## 11. Ayar kolu

Playtest %93.6 / 15°'yi çok sert bulursa **P3'ü 72.2'den 71.8'e alın**:
R = 18.80, kapasite 2.30 t, LMI **%89.6**, salınım toleransı **19.6°**.
Dokunacağım tek sayı bu; gerisi taşıyıcı.

Ayrıca sarı bölge hız düşüşü **oransal** olsun (%80 LMI'de tam hız, %100'de
~%40), basamaklı değil. T3 ve T4 tamamen sarıda geçiyor; orada basamak bozuk
hissettirir.
