# Yılmaz Vinç

2D, web tabanlı ağır makine simülasyonu. **İki araç:** 25 tonluk teleskopik
vinçle sanayi binasının teraslarına yük çıkar, ya da forkliftle depoda paletleri
raflara koy. Oyun hangisiyle oynayacağını sormakla başlıyor. Kurulum yok —
tarayıcıda açılır.

### ▶ Oyna: **https://mertanj.github.io/yilmaz-vinc-simulator/**

Her push'ta kendiliğinden yayınlanıyor. Oynamak için klonlamaya, node kurmaya
gerek yok — linki aç ve başla.

## Kontroller

### YV-25 Teleskopik Vinç

| Faz | Tuş | İşlev |
|---|---|---|
| Sürüş | `→` / `←` | Gaz / geri |
| Sürüş | `boşluk` | El freni |
| Kurulum | `Q` | Ayakları aç / topla |
| Vinç | `W` / `S` | Bomu kaldır / indir |
| Vinç | `Shift+W` / `Shift+S` | Teleskobu aç / topla |
| Vinç | `↑` / `↓` | Kancayı topla / sal |
| Vinç | `boşluk` | Kancayı bağla / bırak |
| Genel | `R` | Bölümü baştan başlat |

### YF-25 Forklift

| Faz | Tuş | İşlev |
|---|---|---|
| Sürüş | `→` / `←` | Gaz / geri |
| Sürüş | `boşluk` | El freni |
| Çatal | `W` / `S` | Kaldır / indir |
| Çatal | `Shift+W` / `Shift+S` | Direği geriye / öne yatır |
| Çatal | `boşluk` | Yükü al / bırak |
| Genel | `R` | Bölümü baştan başlat |

**Yük merkezi uzadıkça kapasite erir** — geniş bir paleti 4.60 metreye çıkarmak,
ondan ağır ama dar bir paleti aynı rafa koymaktan zordur. Aşırı yükte makine
burnunu çatalına dayıyor ve ön tekerler yönlendirmeyi bırakıyor.

**Bomu kaldırmak yarıçapı KISALTIR** — gerçek vinçte de öyle. Uzağa ulaşmak
için bomu indirip teleskobu açmak gerekiyor, ve tam o anda ibre tırmanıyor.

## Bölüm 1 — Sanayi Sitesi, C Blok

Beş katlı teraslı blok, dört teras, beş yük. Yukarı çıktıkça yük hafifliyor,
çünkü yarıçap uzadıkça kapasite düşüyor:

| | Yük | Ton | Hedef | LMI |
|---|---|---|---|---|
| T1 | Sac bobin | 2.30 | K1 terası | %61 |
| T2 | CNC torna | 3.10 | K1 terası | %78 |
| T3 | Jeneratör 125 kVA | 2.20 | K2 terası | %84 |
| T4 | Vidalı kompresör | 1.50 | K3 terası | %88 |
| T5 | Klima santrali | 1.05 | K4 terası | %92 |

İlk iki görev aynı terasa gidiyor ve tek değişen ağırlık: tablonun *yer* değil
*yarıçaptaki yük* ile ilgili olduğunu göstermenin en ucuz yolu.

Sonunda not veriliyor: süre, kırmızıda geçen süre, en geniş salınım, çarpma ve
yerleştirme sapması.

## Bu repoda ne var

| | |
|---|---|
| [`docs/01-oyun-tasarimi.md`](docs/01-oyun-tasarimi.md) | Oyun tasarımı, referans araç, yük tablosu, fizik modeli, kontroller, puanlama |
| [`docs/02-teknik-plan.md`](docs/02-teknik-plan.md) | Teknoloji yığını, görsel varlık kaynakları, yayınlama planı, yol haritası |
| [`spikes/`](spikes/) | Fiziğin çalıştığını kanıtlayan ölçümler — render yok, saf fizik |
| [`docs/03-level-tasarimi.md`](docs/03-level-tasarimi.md) | Bölüm 1'in tam hesabı: zarf, görevler, puanlama, bilinen boşluklar |
| [`src/sim/`](src/sim/) | Fizik çekirdeği: yük tablosu, LMI, vinç, ayaklar, sahne |
| [`src/game/`](src/game/) | Görev akışı ve puanlama |
| [`tools/headless.ts`](tools/headless.ts) | Bölümü baştan sona oynayan başsız test |

## Neden bu oyun zor (ve öğretici)

Zorluğu bölüm tasarımıyla uydurmuyoruz; fizikten çıkıyor.

**Yarıçap uzadıkça kapasite düşer.** 25 tonluk vinç 3 metrede 25 ton kaldırır,
22 metrede 1.6 ton. Bölümdeki dört terasın ölçülen zarfı:

| Teras | Yarıçap | Kapasite | Giden yük | LMI |
|---|---|---|---|---|
| K1 | 13.1 m | 4.54 t | 3.10 t | %78 |
| K2 | 16.1 m | 3.16 t | 2.20 t | %84 |
| K3 | 19.1 m | 2.22 t | 1.50 t | %88 |
| K4 | 22.1 m | 1.63 t | 1.05 t | %92 |

Çatı (24.1 m) bilerek hedef değil: o yarıçapta bom ucu 22.7 metreye çıkıyor,
yükü bırakmak içinse 24.4 metre gerekiyor — yani 31 metrelik bom. Daha büyük
bir vinç işi, ve bölüm bunu gizlemek yerine söylüyor.

**Ayak açmazsan devrilirsin** — *tasarımda.* Bugünkü kodda devrilme pratikte
tetiklenmiyor ve sebebi ölçüldü: ayak silindirleri iki yönlü (gerçek kriko sadece
iter) ve seviye düzeltmesi hiç durmuyor. Ayrıntısı ve çözümü
[`docs/03-level-tasarimi.md`](docs/03-level-tasarimi.md) sonunda — Sprint 5 işi.

**Salınan yük tabloyu yalanlar.** Halat gerilimi 40° salınımda statik ağırlığın
%46 üstüne çıkar. Yani tabloya göre güvenli görünen bir konfigürasyonda,
dikkatsiz salınan bir oyuncu devrilebilir. Oyunun asıl becerisi salınımı
söndürmek — 4 metrelik halatta sarkaç periyodu 4 saniye.

## Fizik doğrulaması

planck.js'in bu işi gerçekten yaptığını plan yazılmadan önce ölçtük:

```bash
npm i planck
node spikes/01-pendulum-and-cable-force.mjs
```

| Ölçüm | Teori | planck | Sapma |
|---|---|---|---|
| Sarkaç periyodu (4 m) | 4.012 s | 4.017 s | %0.11 |
| Halat kuvveti (3.45 t) | 33.84 kN | 33.84 kN | %0.00 |
| Salınım gerilimi (40°) | 49.68 kN | 49.57 kN | %0.2 |

Ayrıntılar ve yolda düşülen tuzaklar: [`spikes/README.md`](spikes/README.md).

## Teknoloji

planck.js (fizik) · PixiJS (render) · TypeScript · Vite

Seçim gerekçeleri ve elenen alternatifler
[`docs/02-teknik-plan.md`](docs/02-teknik-plan.md) §1'de.

## Çalıştırma

```bash
npm install
npm run dev      # geliştirme sunucusu
npm run build    # üretim derlemesi (dist/)
npm run sahne    # başsız test: bölümün tamamını oynar
npm run spike    # ilk fizik doğrulama ölçümleri
```

### `npm run sahne` — bu projenin asıl test aracı

Tarayıcı açmadan aynı `Scene`'i sürüyor: sahaya sür, ayakları aç, beş yükü
sırayla al ve terasına koy. Biri yerine konmazsa sıfırdan farklı kodla çıkıyor,
yani yayın işi hattı bozuk bir fiziği asla geçirmiyor.

Bu araç olmadan alınan kararların çoğu yanlış çıktı. "Tork yetmiyor",
"bom kısa", "kanca yavaş" hipotezlerinin üçü de ölçümle elendi; gerçek sebepler
sırayla mafsal esnemesi, yük tablosu kilidi ve `setFixedRotation`'ın kütleyi
sıfırlamasıydı.

## Durum

| Sprint | İş | Durum |
|---|---|---|
| 0 | Vite + TS + Pixi + planck iskeleti, sabit adım döngüsü | tamam |
| 1 | Kamyon: süspansiyon, gaz, fren, kamera takibi | tamam |
| 2 | Outrigger'lar, eğim göstergesi | tamam |
| 3 | Bom: luff, teleskop, halat, kanca, yük | tamam |
| 4 | Görev akışı, puanlama, çok katlı hedefler, beş katlı bina | tamam |
| 5 | Slew (180° dönüş), tek yönlü kriko + devrilme, ses | sırada |
| 6 | Mobil kontroller, paylaşım kartı | — |

## Sanat yönü

Piksel sanat değil — **prosedürel vektör**. Vinç `PixiJS Graphics` ile kodla
çiziliyor. Gerekçe: bom hem döner hem uzar, yani hazır sprite ile çizilemez;
vinç zaten elle yapılacak bir şeydi, sadece tekniği seçtik. Kazançları:

- Her zumda net, çözünürlükten bağımsız
- Renk anında değişir
- Giydirme gerçek yazı tipiyle basılıyor — İ ve Ç dahil, tek satır
- Teleskop kesitleri kusursuz render oluyor (sprite boyuna esnetilmiyor)
