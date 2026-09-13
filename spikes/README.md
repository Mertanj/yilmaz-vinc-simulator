# Fizik Spike'ları

Planı yazmadan önce en büyük riski test ettik: **planck.js bu vinci gerçekten
taşıyor mu?** Cevap evet, ama üç şeyi doğru yapmak şartıyla. Bu dosyalar o
doğrulamanın kendisi — render yok, tarayıcı yok, saf fizik.

```bash
npm i planck
node spikes/01-pendulum-and-cable-force.mjs
node spikes/02-swing-tension-vs-theory.mjs
node spikes/03-full-crane-rig.mjs
```

## Doğrulanan sonuçlar

**01 — Sarkaç periyodu ve halat kuvveti**

| Halat | Teori `2π√(l/g)` | planck | Sapma |
|---|---|---|---|
| 2 m | 2.837 s | 2.841 s | %0.13 |
| 4 m | 4.012 s | 4.017 s | %0.11 |
| 8 m | 5.674 s | 5.681 s | %0.13 |

Halat kuvveti (3.2 t yük + 0.25 t kanca): beklenen 33.84 kN, ölçülen 33.84 kN,
sapma **%0.00**.

**02 — Salınım gerilimi, teori `T = m·g·(3 − 2·cosθ)` ile**

| θmax | Teori | planck | Sapma | Statiğe göre |
|---|---|---|---|---|
| 10° | 34.87 kN | 34.87 kN | %0.0 | +%3 |
| 20° | 37.93 kN | 37.92 kN | %0.0 | +%12 |
| 30° | 42.91 kN | 42.88 kN | %0.1 | +%27 |
| 40° | 49.68 kN | 49.57 kN | %0.2 | +%46 |

**03 — Tam vinç kurulumu:** teleskop `PrismaticJoint` motoru 1.2 m/s'de sürüyor,
9.0 m strok limitinde duruyor, geri toplanıyor.

## Yolda düşülen üç tuzak (hepsi bu dosyalarda çözülü)

1. **Halatı yumuşak yay yapma.** `DistanceJoint`'e `frequencyHz: 6` verince
   3.45 t altında esnedi, yükü emniyet `RopeJoint`'i taşımaya başladı ve
   `getReactionForce()` gerçek kuvvetin yarısını okudu. Rijit bırakın.
2. **Yükü yere değdirme.** Test kurulumunda yük zemine gömülüydü; zemin ağırlığın
   yarısını taşıyınca hem kuvvet okuması hem sarkaç ölçümü çöpe gitti.
3. **Impulsla salınım başlatma.** Ani impuls rijit kısıtta şok tepesi yaratır
   (%648 gibi sahte bir rakam gördük). Sarkacı açıyla yerleştirerek başlatın.

## Bilinmesi gereken kütle oranı sınırı

planck'in kendi dokümantasyonu: 10:1'i geçen kütle oranlarında kararlılık bozulur.
Bu bir vinç oyununda doğrudan bizi ilgilendiriyor — bom kesitleri, kanca ve yük
birbirine yakın kütlelerde tutulmalı. `03`'te bom kesitlerine elle `setMassData()`
verilmesinin sebebi bu (yoğunluktan gelen doğal kütleler çok hafif kalıyordu).
