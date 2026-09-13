# Yılmaz Vinç

2D, web tabanlı mobil vinç simülasyonu. Kamyonu sahaya sür, ayakları aç, yerdeki
yükü kancala ve iki katlı binanın terasına yerleştir. Kurulum yok — tarayıcıda
açılır, telefonda da çalışır.

> **Durum: planlama tamamlandı, fizik doğrulandı, kod yazımı başlamadı.**

## Bu repoda ne var

| | |
|---|---|
| [`docs/01-oyun-tasarimi.md`](docs/01-oyun-tasarimi.md) | Oyun tasarımı, referans araç, yük tablosu, fizik modeli, kontroller, puanlama |
| [`docs/02-teknik-plan.md`](docs/02-teknik-plan.md) | Teknoloji yığını, görsel varlık kaynakları, yayınlama planı, yol haritası |
| [`spikes/`](spikes/) | Fiziğin çalıştığını kanıtlayan ölçümler — render yok, saf fizik |
| [`src/sim/`](src/sim/) | Motor bağımsız fizik çekirdeği: yük tablosu, LMI, vinç geometrisi |

## Neden bu oyun zor (ve öğretici)

Zorluğu bölüm tasarımıyla uydurmuyoruz; fizikten çıkıyor.

**Yarıçap uzadıkça kapasite düşer.** 25 tonluk vinç, 3 metrede 25 ton kaldırır;
16 metrede 3.2 ton. Demo yükü 3.2 ton:

| Yarıçap | Kapasite | LMI | |
|---|---|---|---|
| 12 m | 5.2 t | %66 | hedef nokta |
| 14 m | 4.0 t | %86 | uyarı |
| 16 m | 3.2 t | %108 | hareket kilidi |

**Ayak açmazsan devrilirsin.** Aynı yük, aynı yarıçap, yarı açık outrigger:
%111 → araç gerçekten devrilir. Scripted değil, moment dengesinden çıkıyor.

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
