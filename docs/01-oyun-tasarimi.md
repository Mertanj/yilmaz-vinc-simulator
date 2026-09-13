# Yılmaz Vinç — Oyun Tasarım Dokümanı

> Tek bölümlük, 2D yan görünüm, web tabanlı mobil vinç simülasyonu.
> Amaç: 3–4 dakikada, tarayıcıda, kurulum olmadan oynanan; kontrolleri basit ama
> fiziği gerçek olan bir tanıtım demosu.

---

## 1. Tek cümlelik özet

Kamyon üstü teleskopik bom vinci sahaya sür, ayakları (outrigger) aç, yerdeki
3.2 tonluk yükü kancala ve iki katlı atölyenin terasına salınım yaptırmadan,
yük momentini kırmızıya sokmadan yerleştir.

## 2. Neden bu tasarım

Oyunun eğlencesi "vinç kullanmak" değil, **vinççinin gerçekten düşündüğü şeyi
düşünmek**: yarıçap uzadıkça kapasite düşer, ayak açmazsan devrilirsin, yük bir
kez salınmaya başlarsa söndürmesi zordur. Bu üç şeyi doğru modellersek oyun
kendiliğinden hem öğretici hem gergin olur. Bölüm tasarımıyla zorluk
uydurmuyoruz; zorluk fizikten çıkıyor.

---

## 3. Referans araç — "YV-25"

Kurgusal ama gerçek bir sınıfa oturan araç (Tadano GT-250E / Kato NK-250 sınıfı
25 tonluk kamyon üstü teleskopik bom vinç).

| Parametre | Değer |
|---|---|
| Toplam ağırlık (şasi + üst yapı) | 24 t |
| Maksimum kaldırma | 25 t @ 3 m yarıçap |
| Bom | 4 kademeli teleskopik, 9.5 m → 30 m |
| Bom açısı | 0° – 78° (yataydan) |
| Outrigger açıklığı | 6.0 m tam / 4.0 m yarı |
| Kanca bloğu | 250 kg, 4 kat palanga |
| Döner tabla | 360° (2D'de yatak ↔ çalışma konumu) |

## 4. Yük tablosu (load chart)

Tam açık outrigger'da yarıçap → kapasite:

| R (m) | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 24 | 28 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C (t) | 25.0 | 20.0 | 15.5 | 12.5 | 9.0 | 6.8 | 5.2 | 4.0 | 3.2 | 2.5 | 2.0 | 1.3 | 0.8 |

Ara değerler doğrusal interpolasyonla. Dikkat: moment kapasitesi de yarıçapla
düşüyor (75 t·m @ 3 m → 22 t·m @ 28 m). Bu gerçekçi — uzun bomda sınır sadece
devrilme değil, bom mukavemeti ve sehimdir.

**Outrigger çarpanı:** tam açık ×1.00 · yarı açık ×0.60 · lastik üstü ×0.25

## 5. Fizik modeli

### 5.1 Çalışma yarıçapı
```
R = d_pivot + L·cos(θ)
```
`L` = anlık bom uzunluğu, `θ` = bom açısı, `d_pivot` ≈ 0.6 m (döner tabla
merkezinden bom ayağına ofset).

### 5.2 Yük momenti ve LMI (Yük Moment Göstergesi)
```
M_yük  = (m_yük + m_kanca) · g · R
M_izin = C(R) · outrigger_çarpanı · g · R
LMI %  = M_yük / M_izin × 100
```

| LMI | Gösterge | Davranış |
|---|---|---|
| < %80 | yeşil | normal |
| %80–100 | sarı | kesikli bip, aktüatör hızı %60'a iner |
| > %100 | kırmızı | sürekli korna, yarıçapı artıran hareketler kilitlenir |

### 5.3 Devrilme — scripted değil, emergent
Devrilme dayanağı, yük tarafındaki outrigger ayağının yere bastığı nokta.
Devirici moment karşı momenti (araç ağırlığı × ağırlık merkezi kolu) aşınca
şasinin zemin kısıtı serbest bırakılır ve araç **gerçekten** rigid body olarak
devrilir. Ayak açıkken kol 3.0 m, lastik üstünde 1.1 m.

### 5.4 Sarkaç — oyunun asıl beceri mekaniği
```
T = 2π·√(l/g)
```
| Halat boyu | Periyot | Yarım periyot |
|---|---|---|
| 2 m | 2.84 s | 1.42 s |
| 4 m | 4.01 s | 2.01 s |
| 8 m | 5.67 s | 2.84 s |

Anti-sway tekniği: **tam bir periyot boyunca ivmelen** → salınım kendini yok
eder. Alternatif: hareket et → yarım periyot bekle → ters hareket. Oyunun
oyuncuya öğrettiği şey tam olarak budur.

### 5.5 Mimari kararı: her şey tek solverda

> Bu bölüm, çalışan bir fizik spike'ı sonrası revize edildi. İlk taslakta bom
> açısını ve boyunu fizik motorunun *dışında* kinematik olarak sürmeyi
> planlamıştım. Spike gösterdi ki buna gerek yok — ve dışarıda sürmek aslında
> daha kötü olurdu.

| Bileşen | Nasıl modellenir |
|---|---|
| Kamyon şasisi + tekerlekler | `WheelJoint` (süspansiyon + tahrik + fren tek joint'te) |
| Döner tabla (slew) | `RevoluteJoint` + motor |
| Bom açısı (luff) | `RevoluteJoint` + motor + açı limiti |
| Bom boyu (teleskop) | `PrismaticJoint` + motor + strok limiti |
| Halat (vinç) | `DistanceJoint`, **rijit**, `setLength()` ile boy değişir |
| Kanca + yük | Dinamik gövde, `RevoluteJoint` ile kancaya bağlı |
| Outrigger ayakları | `PrismaticJoint`, eksen aşağı, yüksek motor kuvveti |

**Gerekçe:** Motorlu bir joint zaten hız kontrollüdür, yaylı değil. Yani
hidroliğin sertliğini solverın *içinde* elde ediyoruz. Dışarıda kinematik
sürmenin bedeli ağır olurdu: yükün ağırlığı boma ve kamyona geri tepmez, o
zaman devrilmeyi ve yük momentini elle hesaplamak zorunda kalırdık. İçeride
tutunca ikisi de kendiliğinden çıkıyor.

**Kritik ayar — halat yumuşak olmamalı.** İlk spike'ta halatı `frequencyHz: 6`
ile yumuşak yay yaptım; 3.45 tonluk yük altında halat esnedi, yükü emniyet
halatı (`RopeJoint`) taşımaya başladı ve `getReactionForce()` gerçek kuvvetin
yarısını okudu. `frequencyHz` vermeyip rijit bırakınca sapma %0.00'a indi.

### 5.6 LMI statik yükten değil, anlık halat kuvvetinden okunmalı

Yük momentini kendi defterimizden hesaplamıyoruz; solverdan okuyoruz:

```ts
const F = cable.getReactionForce(1 / dt);   // Newton, gerçek
const anlikYukTon = Math.hypot(F.x, F.y) / 9810;
```

Neden önemli: sarkaç salınırken halat gerilimi statik ağırlığın üstüne çıkar.
Doğrulanmış ölçüm — teori `T = m·g·(3 − 2·cosθ)` ile %0.2 uyum:

| Salınım açısı | Halat gerilimi | Statiğe göre |
|---|---|---|
| 10° | 34.9 kN | +%3 |
| 20° | 37.9 kN | +%12 |
| 30° | 42.9 kN | +%27 |
| 40° | 49.7 kN | +%46 |

Yani **statik LMI yalan söyler.** Dikkatsiz salınan bir oyuncu, tabloya göre
güvenli görünen bir konfigürasyonda devrilebilmeli. Salınım söndürme becerisinin
neden oyunun merkezinde olduğunun cevabı da bu.

## 6. Serbestlik dereceleri (2D yan görünüm)

Yan görünümde anlamlı olanlar:

1. **Bom açısı** (luff) — yukarı/aşağı
2. **Bom boyu** (teleskop) — içeri/dışarı
3. **Halat** (vinç) — kanca yukarı/aşağı

Bu üçü kancayı düzlemde tam konumlandırır. Döner tabla (slew) yan görünümde
**yatak konumundan çalışma konumuna çevirme** olarak kalır — hem gerçekçi hem
işlevsel, üstelik oyuna gerçek bir hazırlık adımı ekler.

---

## 7. Bölüm akışı (~3–4 dk)

| # | Faz | Hedef |
|---|---|---|
| 1 | **Sürüş** | Soldan gel, işaretli alana yanaş, el frenini çek |
| 2 | **Ayak açma** | Outrigger'ları yanal aç + indir, su terazisini ortala |
| 3 | **Hazırlık** | Bomu yatak konumundan kaldır, kancayı indir |
| 4 | **Bağlama** | Kanca yüke yakın + yavaşken sapan bağlanır |
| 5 | **Kaldırma** | Kaldır, teleskop aç — LMI'yi kırmızıya sokma |
| 6 | **Yerleştirme** | Terasa bırak: dikey hız < 0.3 m/s, salınım < 15 cm |
| 7 | **Toparlama** | Kancayı topla, ayakları kapat (bonus) |

### Hedef konfigürasyon
`L = 18 m, θ = 50° → R = 12.2 m, bom ucu 16.0 m` — LMI %66, rahat yeşil.
Oyuncu teleskopu 16 m yarıçapın ötesine açarsa LMI %108 → kilit.
Ayakları yarım açık bırakırsa aynı noktada %111 → **devrilir.**

---

## 8. Kontroller

| Faz | Tuş | İşlev |
|---|---|---|
| Sürüş | `→` / `D` | Gaz ileri |
| Sürüş | `←` / `A` | Fren / geri |
| Sürüş | `Space` | El freni |
| Ayak | `Q` | Outrigger aç / kapa |
| Vinç | `W` / `S` | Bom kaldır / indir |
| Vinç | `Shift+W` / `Shift+S` | Teleskop aç / topla |
| Vinç | `↑` / `↓` | Kanca yukarı / aşağı |
| Vinç | `A` / `D` | Döner tabla sol / sağ |
| Genel | `Space` | Kanca bağla / bırak |
| Genel | `C` | Kamera serbest / takip |
| Genel | `R` | Bölümü yeniden başlat |

**Mobil:** solda analog kol, sağda faz-duyarlı buton kümesi, üstte LMI göstergesi.
Faz değiştikçe sağdaki butonlar değişir — ekranda aynı anda en fazla 4 buton.

---

## 9. Puanlama

- Toplam süre
- Maksimum salınım genliği
- Maksimum LMI yüzdesi
- Çarpışma sayısı (bina, direk, diğer araç)
- Yerleştirme hassasiyeti (hedef merkezine cm)
- **Bonus:** ayakları toplayıp sahadan çıkma

Sonuç ekranı: A/B/C/D notu + "Usta Vinççi" rozeti (tek seferde, sıfır çarpışma,
LMI hiç sarıya girmeden).

---

## 10. Harita — sanayi sitesi, yan görünüm, ~120 m

- **Sol:** giriş yolu, "YILMAZ VİNÇ" tabelası, duba
- **Orta:** park/çalışma alanı, yerde paletli yük, variller, konteyner
- **Sağ:** iki katlı atölye binası, 2. katta teras (hedef alan)
- **Dekor:** kepenkli dükkânlar, oluklu sac cephe, park etmiş kamyon, ağaç

**v1.1 için tehlike:** trafo direği + havai hat. Gerçek vinç kazalarının önemli
bir kısmı buradan çıkar; bomun hatta yaklaşması alarm verir.
