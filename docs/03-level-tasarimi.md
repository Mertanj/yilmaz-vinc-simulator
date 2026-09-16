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

---

# Sprint 4 — bölümün kurulan hâli

Yukarısı tasarım; burası **koda giren ve ölçülen** hâli. Sayılar `npm run sahne`
zarf tablosundan geliyor, tahminden değil.

## Bina neden beş katlı ve neden bu ölçülerde

Kat sayısı 3'ten 5'e çıkarken kademe ve kat yüksekliği KÜÇÜLMEK zorunda kaldı;
ikisi de erişim geometrisini doğrudan belirliyor. Bom ucunun hedefin ~3 m
üstünde olması gerektiği için gereken bom boyu şöyle çıkıyor:

| Kademe | Kat yüksekliği | Çatı için gereken bom |
|---|---|---|
| 3.4 m | 4.4 m | 32.7 m ✗ |
| 3.0 m | 4.0 m | 30.2 m ✗ (kıl payı) |
| **3.0 m** | **3.8 m** | **29.6 m ✓** |

Seçilen 3.0 / 3.8. Teras derinliği kademeye eşit, yani **yükler 2.4 metreden
geniş olamıyor.**

## Ölçülen zarf

Kamyon takoza (x = 57.9) dayandığında bom ayağı (51.7, 4.0) oluyor. Halat düşey
olmak zorunda olduğu için bom ucu hedefin tam üstünde duruyor, yani
**L·cos θ = Δx**: yarıçap yalnızca yatay mesafeye bağlı, bom boyu ve açısı onu
değiştirmiyor.

| Hedef | x | y | R | Kapasite |
|---|---|---|---|---|
| K1 terası | 64.2 | 3.8 | 13.1 m | 4.54 t |
| K2 terası | 67.2 | 7.6 | 16.1 m | 3.16 t |
| K3 terası | 70.2 | 11.4 | 19.1 m | 2.22 t |
| K4 terası | 73.2 | 15.2 | 22.1 m | 1.63 t |
| Çatı | 75.2 | 19.0 | 24.1 m | 1.29 t |

**Çatı bilerek hedef değil.** O yarıçapta bom ucu en fazla 22.7 metreye
çıkabiliyor; yükü bırakabilmek içinse 2 metrelik halat payıyla 24.4 metre
gerekiyor, yani 30 metrelik bomdan 31.1 metre isteniyor. Çatıya çıkmak daha
büyük bir vinç işi — YV-25'in dürüst sınırı burası ve bunu gizlemek yerine
bölüm tasarımına yazdık.

## Beş görev

Ağırlıklar hedeflenen LMI eğrisinden **geriye doğru** hesaplandı (kanca 0.45 t dahil):

| | Yük | t | Hedef | LMI |
|---|---|---|---|---|
| T1 | Sac bobin | 2.30 | K1 | %61 |
| T2 | CNC torna | 3.10 | K1 | %78 |
| T3 | Jeneratör 125 kVA | 2.20 | K2 | %84 |
| T4 | Vidalı kompresör | 1.50 | K3 | %88 |
| T5 | Klima santrali | 1.05 | K4 | %92 |

T1 ile T2 aynı terasa gidiyor, tek değişen ağırlık: tablonun *yer* değil
*yarıçaptaki yük* ile ilgili olduğunu anlatmanın en ucuz yolu. Yukarı çıktıkça
yük hafifliyor — sahadaki kuralın ta kendisi.

**Malzeme tek noktadan geliyor (x = 60.1).** Beşi aynı anda sahaya sığmıyor:
takozun sağ kenarı 58.25, fabrika cephesi 62.0, arada 3.75 metre var. Slew
gelince yükler kamyonun ARKASINA dizilebilecek ve bu kısıt tamamen kalkacak.

## Puanlama — zirve değil, kırmızıda geçen SÜRE

İlk sürüm en yüksek LMI'yi cezalandırıyordu ve haksızdı: salınan bir yükte halat
gerilimi saliselik olarak statiğin 1.7 katına çıkıyor, ibre %140 okuyor. Ölçüm
bunun ne kadar geçici olduğunu gösterdi — **862 saniyelik bir turda kırmızıda
geçen toplam süre 1.2 saniye.** Bu, kırmızıda park etmiş bir vinçle aynı şey
değil; gerçek bir değerlendirme de "aşırı yükte ne kadar kaldın" diye sorar.

Şimdi: kırmızıda geçen her saniye 2 puan, zirve cezası yalnızca %120'nin
üstünde ve hafif. Referans tur (beş görev tamam, 1.2 sn kırmızı, salınım 27°,
yerleştirme ~35 cm, 862 sn) → **B (77)**.

Çarpma sayarken **sadece yük ve kanca** dikkate alınıyor. Şasi de sayılınca
takoza yanaşmak — yani park etmenin tek yolu — her turda bir çarpma yazıyordu.

## Kamera artık çalışma zarfını kadrajlıyor

Sabit yakınlaştırmada bom 30 metreye açılınca yük kadrajın dışında kalıyordu:
oyuncu yükü bıraktığı yeri göremiyordu. Kamera artık şasiyi, bom ucunu, kancayı
ve (yük havadayken) hedefi çevreleyen kutuyu hesaplayıp ölçeği ona göre
seçiyor — 30 ile 15 piksel/metre arasında. Sürerken kutu küçük olduğu için
ölçek en yakında kalıyor, yani sürüş hissi değişmiyor.

## Yerleştirme onayı

Yük terasa oturduğunda dört saniyelik bir panel çıkıyor: sapma (cm), o görevde
görülen en yüksek LMI, süre ve sırada kaç görev kaldığı. Kör kaldırmada yük
bırakıldığı an oyuncunun görüş açısının dışında kalıyor, dolayısıyla başarının
ayrıca SÖYLENMESİ gerekiyor.

## Devrilme şu an ERİŞİLEMEZ — ölçülmüş bir boşluk

Devrilme tespiti (eğim > 8°) kodda duruyor ama pratikte hiç tetiklenmiyor. Sebebi
ölçüldü: ayaklar açıkken **bom 27.5 metre yatay uzatıldığında bile** (≈589 kN·m
devirme momenti) araç 0.000° kalıyor, bacak stroku hiç değişmiyor, bacak kuvvetleri
sadece 241 kN'dan 189 kN'a kayıyor.

İki sebep var ve ikisi de modelleme kaynaklı:

1. **Ayak silindirleri iki yönlü.** Gerçek kriko sadece İTER; rüzgâr tarafındaki
   bacak boşalır ve pabuç yerden kesilir. Bizimki prismatic joint + motor, yani
   aynı kuvvetle ÇEKİYOR da — araç yere bağlanmış oluyor.
2. **Seviye düzeltmesi hiç durmuyor.** Kurulumda seviyeye getiren denetleyici her
   adımda çalışmaya devam ediyor, dolayısıyla oluşan her eğimi anında geri alıyor.

Ayrıca ayak komutu ikili (açık/kapalı), yani tasarımın öngördüğü "yarım ayakla
kaldır, devril" senaryosu oyuncuya hiç sunulmuyor.

**Sprint 5 önerisi:** bacak çekmede serbest bıraksın (tek yönlü kriko), seviye
düzeltmesi kurulumdan sonra kilitlensin, ayak açma kademeli olsun. Üçü birlikte
devrilmeyi tasarımdaki yerine — emergent bir sonuç olarak — geri getiriyor.

---

# Bölüm 2 — Depo, sevkiyat rampası (YF-25 Forklift)

İkinci araç forklift. Seçilme sebebi yeni bir fizik motoru gerektirmemesi:
yük tablosu mantığı vinçle birebir aynı (moment / izin verilen moment), ama
devrilme ekseni ÖN AKS ve araç lastik üstünde duruyor — yani vinçte ayaklar
yüzünden erişilemeyen devrilme burada gerçekten oluyor.

Sınırı koyan iki şey var ve ikisi de vinçtekinden farklı:

| | Yük | Ton | Yük merkezi | Raf | LMI |
|---|---|---|---|---|---|
| D1 | Çimento paleti | 1.35 | 0.60 m | R1 (1.80 m) | %63 |
| D2 | Fayans paleti | 1.55 | 0.62 m | R2 (3.20 m) | %77 |
| D3 | Boya varilleri | 1.32 | 0.85 m | R2 (3.20 m) | %85 |
| D4 | Yalıtım balyası | 0.90 | 1.05 m | R3 (4.60 m) | %91 |
| D5 | Çelik profil | 1.72 | 0.55 m | R3 (4.60 m) | %99 |

D4 tasarımın özeti: bölümün **en hafif** yükü, ama en yüksek ibreyi okuyan
ikinci yük. Sebebi geniş palet (yük merkezi 1.05 m) ve 3.3 metrenin üstünde
eriyen kapasite. Oyuncunun "ağır = zor" sezgisini kıran yer burası.

## Devrilme artık ölçülebilir bir şey

Vinçte devrilme erişilemiyordu; forkliftte erişiliyor ve göstergesi de var.
Panelde **arka aks** satırı, arka tekerin zemine bastığı kuvvetin boş makinedeki
payını gösteriyor — solverın o temasa verdiği normal impulstan okunuyor, yani
uydurma değil ölçüm. Başsız turda en düşük değer %13; yani bölüm devrilmenin
kıyısından geçiyor ama devrilmiyor.

`WheelJoint.getReactionForce` önce denendi ve hep 0 döndü: yayın taşıdığı kuvvet
mafsalın kendi impulsunda görünmüyor. Temasın kendisini ölçmek hem doğru hem de
oyuncuya anlatması kolay.

## Takla atan forklift — ve onu durduran şey

İlk sürümde aşırı yükte makine 180° takla atıp sırtüstü kalıyordu. Ölçüm
patlamayı değil, **hiç durmayan bir devrilmeyi** gösterdi: 1.4 saniyede
0° → 180°, arada yükün ve şasinin zemine 9 kN·s'lik vuruşları.

Sebep basitti: direk ve çatal birer gövde değil, sadece sayı. Dolayısıyla makine
öne yatarken solverın göreceği hiçbir şey yoktu. Oysa gerçekte devrilen bir
forklift **çatalının üstüne oturur**.

Çözüm, bomun "yatakta dururken ağırlık şasiden geçer" kuralının aynısı: çatalın
topuğu, ucu ve yüklüyken yükün ön-alt köşesi zemine değdiğinde şasiye elle temas
impulsu uygulanıyor. Penaltı yayı önce denendi ve makineyi trambolin gibi
zıplattı (±300°/s); Box2D'nin kendi yaptığı gibi hız düzeltmesi + küçük Baumgarte
itmesi kullanınca sonuç kararlı: aşırı yükte makine **2.09° öne yatıp çatalının
üstünde duruyor**, oradan geri gidip kurtulabiliyor.

Bu yüzden forkliftin devrilme eşiği 22°, vinçin 8°: burnunu çatalına dayamak
kaza değil, kurtarılabilir bir hata.

## Koridor — 2B'de dönemeyen makinenin level tasarımı

Forklift yan görünümde dönemiyor, çatalı hep doğuya bakıyor. Dolayısıyla paleti
alabilmek için **hep onun batısında** olmalı. İlk yerleşimde paletler rafın
batısında bekliyordu ve bölüm D2'de kilitlendi: makine rafa yükü bırakıp geri
dönerken paletin doğusunda kalıyor, batısına geçmek için paletin içinden geçmesi
gerekiyordu.

Yerleşim buna göre yeniden kuruldu: **paletler rafın DOĞUSUNDA**, en alt raf
kirişi şasinin üstünde (kiriş altı 1.62 m, şasi tavanı 1.48 m). Makine her turda
rafın önünden geçip paleti alıyor, yüklü olarak geri geçip rafın batısında
duruyor ve yükü içeri uzatıyor. Tur kapanıyor, hiçbir hile gerekmiyor.

Yan görünümde raf dikmeleri koridorun ARKASINDA kalır; çizim de onları
aktörlerin arkasına koyuyor, fizikte ise koridorda dikme yok — sadece kirişler
ve her katın arkasında kısa bir dayanak.

## Tekerlerin motoru makineyi frenliyordu

Forklift ilk sürümde `applyForceToCenter` ile sürülüyor, tekerlerin motoru ise
`motorSpeed: 0` ile AÇIK duruyordu. Ölçüm: yarım gazda 18 saniyede 0.5 metre.
2600 N·m fren torku 0.32 m yarıçapta 16 kN'a karşılık geliyor, gazın verdiği
13 kN'dan fazla — makine kendi kendini frenliyordu.

Kamyonda doğru olan desen burada da doğru: süspansiyon, tahrik ve fren tek
mafsalda. Tahrik ön tekerde (karşı ağırlıklı forklift önden çekişli). Yan
kazanç: çekiş artık lastik sürtünmesiyle sınırlı, yani burnu yere değen makine
gerçekten patinaj yapıyor.

## Araç seçimi

Oyun artık bir kararla başlıyor: hangi makine. Kartlar makineyi tanıtıyor ve
**neyin zor olduğunu** söylüyor, çünkü iki araç aynı oyunu oynamıyor — biri
yarıçapla, diğeri yük merkeziyle sınırlı. Üçüncü kart (dirsekli bom) "yakında"
olarak duruyor; yol haritası oyuncudan saklanmıyor.

Teknik tarafta araç bir kayıt: `ARACLAR` listesinde bir satır. `Mission`,
kamera, puanlama ve HUD kabuğu hangi makineyi sürdüğünü bilmiyor — `OyunSahnesi`
arayüzü sınırı çiziyor, `SahneGorunumu` da çizim tarafında aynısını yapıyor.
