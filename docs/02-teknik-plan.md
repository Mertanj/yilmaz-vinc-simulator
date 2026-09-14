# Yılmaz Vinç — Teknik Plan

Bu doküman üç araştırmanın ve çalışan bir fizik spike'ının sonucu. Her sürüm
numarası npm'den, her API `.d.ts`'ten doğrulandı; fizik iddiaları
`spikes/` altındaki kodla ölçüldü.

---

## 1. Teknoloji yığını

| Katman | Seçim | Sürüm |
|---|---|---|
| Fizik | **planck.js** (Box2D'nin JS portu) | 1.5.0, MIT |
| Render | **PixiJS** | 8.20.1 |
| Dil | TypeScript | 7.0.2 |
| Build | Vite | 8.3.0 |

### Neden planck — ve neden diğerleri değil

Seçimi tek bir gereksinim belirledi: **teleskopik bom**. Hidrolik teleskop,
motoru ve strok limiti olan bir *prismatic joint*'tir. Adaylardan sadece
planck ve Rapier'de böyle bir şey var.

| | planck 1.5.0 | Rapier 0.20 | Matter.js | Phaser 4 + Matter |
|---|---|---|---|---|
| Prismatic + motor + limit | **var** | var | **yok** | **yok** |
| Revolute + motor + limit | **var** | var | **yok** | **yok** |
| WheelJoint (süspansiyon) | **var** | **yok** | yok | yok |
| Boyut (gzip) | **53.7 KB** | 542 KB (WASM) | ~33 KB | Phaser + Matter |
| TS tipleri | dahili | dahili | **yok** | dahili |
| Son yayın | 2026-04 | 2026-08 | **2024-06** | 2026-07 |

- **Matter.js elendi.** Tek bir kısıt tipi var: yaylı mesafe kısıtı. Motor yok,
  limit yok, prismatic yok. Kendi dokümanı menteşeyi `length: 0` + yüksek
  `stiffness` ile *taklit* etmeyi öneriyor. Ayrıca TypeScript tipi yok ve son
  sürüm iki yılı aşkın süredir güncellenmemiş.
- **Phaser bu iş için elendi.** Phaser iyi bir framework ama tek tam fizik
  motoru kendi Matter fork'u — bu vinci ifade edemez. Phaser'ı alıp yanında
  planck çalıştırmak gerekirdi; o noktada Pixi daha hafif ve dürüst seçim.
- **Rapier ikinci sırada.** Tek gerçek üstünlüğü platformlar arası determinizm
  (replay/leaderboard eklersek önem kazanır). Ama `WheelJoint`'i yok —
  süspansiyonu prismatic + revolute + yay ile elle kurmak gerekir — ve 10 kat
  büyük. Ayrıca hâlâ 0.x, minor sürümler arasında kırıcı değişiklik yapıyor.

**planck'te ayrıca hazır referans kod var:** paket içinde `example/Car.ts`
(kamyon), `example/Prismatic.ts` (teleskop), `example/RopeJoint.ts` (halat),
`example/Pulleys.ts` (palanga) geliyor.

### Doğrulanmış tuzaklar

- **`npm view planck version` 1.5.0 diyor ama `npm i planck` bize 1.4.2 kurdu.**
  Sürümü `package.json`'da açıkça sabitleyin, `latest`'e güvenmeyin.
- **Dokümantasyon hatası:** planck sitesi `prismaticJoint.setMotorForce()`
  gösteriyor. **Öyle bir metot yok.** Doğrusu `setMaxMotorForce()`. `.d.ts`'te
  doğrulandı.
- **Ölçek MKS olmalı.** planck 0.1–10 metre aralığı için ayarlı. Piksel
  cinsinden simüle etmeyin; metreyle simüle edip render'da ölçekleyin.
- **10:1 kütle oranı sınırı.** Bir vinç oyununda bu doğrudan bizi vurur. Bom
  kesitleri, kanca ve yük birbirine yakın kütlelerde tutulmalı.
- **`world.step()` içinde joint yaratıp yok etmeyin.** Kanca bağlama/bırakma
  işlemlerini kuyruğa alıp adımdan sonra boşaltın.
- **Revolute limit aralığı sıfırı içermeli**, yoksa simülasyon başında sıçrar.

### Sabit zaman adımı

planck'in kendi tavsiyesi: sabit adım, 1/60 s, 10 hız / 8 konum iterasyonu.
Kritik kural: *"küçük zaman adımını yüksek iterasyon sayısına takas etmeyin —
60 Hz ve 10 iterasyon, 30 Hz ve 20 iterasyondan çok daha iyidir."*

```ts
const DT = 1 / 60;
let acc = 0, last = performance.now();

function frame(now: number) {
  let dt = (now - last) / 1000;
  if (dt > 0.25) dt = 0.25;        // spiral of death koruması
  last = now; acc += dt;

  while (acc >= DT) {
    saveTransforms();               // interpolasyon için
    applyInput();                   // motor hızları, vinç komutu
    world.step(DT, 10, 8);
    world.clearForces();
    flushJointQueue();              // bağla/bırak, adımın DIŞINDA
    acc -= DT;
  }
  render(acc / DT);                 // ara değerleme
  requestAnimationFrame(frame);
}
```

İnterpolasyon burada özellikle önemli: 60 Hz'de simüle edilip 120 Hz'de çizilen
bir sarkaç, interpolasyonsuz gözle görülür şekilde titrer.

---

## 2. Görsel varlıklar

### Başlıca bulgu

**Ücretsiz, hazır, yandan görünüm mobil vinç sprite'ı yok.** Kenney'nin 48.193
dosyalık tüm kataloğu, OpenGameArt, itch.io ve CraftPix tarandı. Kenney'nin
36 bin sprite'lık 2D kütüphanesinde tek bir inşaat aracı bile yok.

**Ama** Kenney'nin *Pixel Platformer: Industrial Expansion* paketi gerçek bir
**modüler vinç parça kiti** içeriyor.

### İndirilecek dört paket

| Paket | Lisans | Ne için |
|---|---|---|
| [Kenney — Pixel Platformer: Industrial Expansion](https://kenney.nl/assets/pixel-platformer-industrial-expansion) | **CC0** | Vinç parçaları: kanca bloğu, makara, halat, I-kiriş (3 dilimli!), kutu kiriş, lastik, uyarı levhası |
| [Kenney — Mobile Controls](https://kenney.nl/assets/mobile-controls) | **CC0** | Dokunmatik UI: 4 joystick seti, butonlar, `icon_pedal`, `icon_pedal_brake`, `icon_steering_wheel`, `icon_arrow_rotate` |
| [ACTG — Warehouse / Factory](https://actg.itch.io/warehouse-factory) | **CC0** | Sanayi sitesi dekoru: palet, forklift, konteyner, varil, iskele |
| [Kenney — UI Pack](https://kenney.nl/assets/ui-pack) | **CC0** | LMI göstergesi için slider ve bar'lar |

Industrial Expansion'daki kritik parçalar (18×18 px, karo numarasıyla):

| Karo | Ne | Vinçte kullanımı |
|---|---|---|
| `0039`, `0040`, `0071`, `0072` | Kanca + mapa | **Kanca bloğu** (4 varyant) |
| `0008`, `0024` | Makara yuvası, kilit | **Bom ucu makarası** |
| `0004`–`0006`, `0020`–`0022` | I-kiriş: sol / orta / sağ | **3 dilimli bom** |
| `0107`–`0111` | Kutu kiriş kesitleri | **Teleskopik bom kesitleri** |
| `0099` | Jantlı lastik | **Kamyon tekerleği** |
| `0042`, `0057` | Uyarı üçgeni | **LMI ikonu** |
| `0009`, `0010`, `0103`–`0106` | Variller, tehlike şeritli kasalar | **Yük** |

Kendimiz çizeceklerimiz: kabin/şasi, platform, döner tabla, outrigger ayakları.
**Toplam ~5 sprite** — 40 değil. Bu beşi zaten elle çizdiğimiz için "YILMAZ VİNÇ"
giydirmesi ek iş değil; doğrudan o sprite'lara işleniyor
(bkz. [tasarım §11](01-oyun-tasarimi.md#11-araç-giydirmesi--yılmaz-vinç-vinili)).

### Bomu nasıl çizeceğiz

**Karar: parça-sprite'ları runtime'da dönüştür, esneyen kısımları prosedürel çiz.**

Hazır bütün-araç sprite'ı kullanmak imkânsız: bom açısı ve boyu piksele gömülü
olurdu, her açı için ayrı kare gerekirdi. Bunun yerine ebeveyn-çocuk zinciri:

```
şasi (x, süspansiyon açısı)
└─ döner tabla
   └─ bom ayağı pimi        rotate(θ_luff)      ← bom kaldırma
      ├─ bom kesiti 0        (sabit)
      ├─ bom kesiti 1        translate(+e₁)     ← teleskop
      ├─ bom kesiti 2        translate(+e₂)
      └─ bom ucu makarası    translate(+L(e))
         └─ halat            çizgi, boy = vinç payı   ← prosedürel
            └─ kanca bloğu   rotate(θ_salınım)
               └─ yük
```

Dört skaler — `θ_luff`, `e`, `halat boyu`, `θ_salınım` — tüm düzeneği sürüyor.
Bu aynı zamanda fiziğin de ağacı, yani render ağacı ile sim ağacı aynı ağaç.

**Asla bom sprite'ını boyuna ölçeklemeyin** — uç dökümü ve ayak pimi yamulur.
Bunun yerine 3 dilim: `ayak_kapağı` + `orta` (sadece bom ekseninde uzar) +
`uç_kapağı` (`x = L(e)`'de çizilir). Kenney'nin `0004`/`0005`/`0006` karoları
zaten 3 dilim olarak çizilmiş — paketi değerli kılan da bu.

**Prosedürel çizilecek üç şey:** halat (değişken boy, sprite imkânsız),
outrigger bacakları (uzayan dikdörtgen + pabuç), ve istenirse bomun kendisi
(iç içe yuvarlatılmış dikdörtgenler her zumda ikna edici durur).

### Slew, yan görünümde gerçek bir tasarım sorunu

Dikey eksen etrafında dönüş, yan görünüm izdüşümünde dejenere: bom sıfıra
kısalıp ters çevrilir. Üç çözüm var, **karar erken verilmeli** çünkü sanatı
etkiliyor:

1. **Sadece çevirme (önerilen).** Slew, 180°'lik ayrık bir dönüş; üst yapı
   0.5 sn'lik bir ezme-aynalama animasyonuyla döner. Tasarım dokümanındaki
   "yatak konumundan çalışma konumuna" akışı zaten bu.
2. **Sahte 3B.** Bom grubuna `scaleX = cos(slew)` uygulanır, altına eliptik
   tabla gölgesi çizilir. 2D'den çıkmadan ikna edici bir salınım verir.
3. **Slew'ü tamamen at.** Zorluk luff + teleskop + vinç + park konumlandırması
   olur. Çoğu 2D vinç oyunu bunu yapıyor.

### Lisans uyarıları

- **Kenney'nin tamamı CC0.** Atıf, izin, bağış — hiçbiri gerekmiyor. Ticari
  kullanım ve değiştirme serbest. Hukuken en temiz konum.
- **CraftPix freebies CC0 DEĞİL.** Şartları kaynak dosyaları "başka bir son
  kullanıcı için kullanılabilir hale getirecek şekilde" dağıtmayı yasaklıyor.
  Bir web oyunu PNG'lerini tarayıcıya servis eder ve DevTools'tan çıkarılabilir.
  Madde büyük ihtimalle asset-hırsızı uygulamaları hedefliyor ama **Kenney aynı
  ihtiyacı CC0 ile karşılıyorken bu riski almanın anlamı yok.**
- **OpenGameArt'taki iki araç OGA-BY 3.0** — atıf zorunlu. Ayrıca o kamyon
  tanınabilir bir Dodge Ram TRX; ticari sürümde ızgarayı yeniden çizin.
- **game-icons.net CC BY 3.0** — atıf zorunlu, ama 4.180 SVG içinde
  `Crane` + `Weight` + `Scales` var; bu birebir bir LMI ikon seti.

### Ses (hepsi doğrulandı)

| İhtiyaç | Kaynak | Lisans |
|---|---|---|
| Dizel rölanti döngüsü | [freesound 187564](https://freesound.org/people/qubodup/sounds/187564/) | **CC0**, döngü olarak hazırlanmış |
| Geri vites bipi | [freesound 449081](https://freesound.org/people/Bon_Vivant_Pictures/sounds/449081/) | CC0 |
| Hidrolik iniltisi | [freesound 637811](https://freesound.org/people/kyles/sounds/637811/) | CC0 |
| Metal çarpma | [freesound 848209](https://freesound.org/people/Mihacappy/sounds/848209/) | CC0 |
| LMI alarm buzzer | [Kenney Digital Audio](https://kenney.nl/assets/digital-audio) | CC0 |

---

## 3. Yayınlama

### Karar: **önce GitHub Pages, pazarlama öncesi Cloudflare Pages**

| | Cloudflare Pages | GitHub Pages | Netlify | Vercel |
|---|---|---|---|---|
| Bu kullanım için ücret | $0 | $0 | $0 | **kullanılamaz** |
| Ticari kullanım (ücretsiz katman) | evet | gri alan | evet | **hayır** |
| Bant genişliği | **sınırsız** | 100 GB/ay (yumuşak) | **~15 GB/ay, sonra site DURUR** | — |
| Özel HTTP başlığı | **var** | **yok** | var | var |
| Cache kontrolü | **tam** | **yok** (sabit 10 dk) | tam | tam |
| PR önizleme | **sınırsız** | yok | var | var |

Üç eleme gerekçesi:

- **Vercel sözleşmeyle dışarıda.** Fair Use Guidelines ticari kullanımı açıkça
  *"bir ürün veya hizmetin satışının reklamı"* olarak tanımlıyor ve Hobby
  katmanını ticari dışı kişisel kullanımla sınırlıyor. Bir vinç firmasının
  tanıtım demosu tam olarak budur. Ücretsiz değil, $20/ay.
- **Netlify siteyi kampanya ortasında kapatabilir.** 2025-09-04 sonrası
  hesaplar kredi bazlı: ayda 300 kredi, GB başına 20 kredi (~15 GB), üretim
  deploy'u başına 15 kredi. Krediler bitince Netlify'ın kendi ifadesiyle
  *"tüm projeleriniz duraklatılır ve ziyaretçiler `Site not available` görür."*
  WhatsApp'ta iyi bir yönlendirme zinciri bunu bir haftada yakar.
- **Cloudflare'de statik bant genişliği resmen sınırsız.** Ayrıca Vite'ın
  içerik-hash'li dosyalarını 1 yıl `immutable` cache'leyebilirsiniz; GitHub
  Pages'te her şey sabit 10 dakika cache'lenir ve değiştirilemez.

**Neden yine de GitHub Pages ile başlıyoruz:** repo zaten burada, public,
ek hesap yok, 20 dakikada canlıda. Taşıma maliyeti ileride tek bir CNAME
kaydı. Aşağıdaki workflow ve `base` ayarı ikisinde de çalışacak şekilde yazıldı.

**itch.io hakkında:** ikincil ayna olarak 30 dakikaya değer, ama WhatsApp'a
atılan ana link olmamalı. itch.io sayfası demonuzu indie-oyun vitrinine sarar —
başka oyunların kapakları, yorumlar, puanlar. Bir müteahhide gönderilen
`yilmazvinc.itch.io` linki yanlış sinyal verir. Keşif değeri de sıfıra yakın:
vinç alıcısına ulaştıracak bir etiket yok.

### GitHub Actions workflow

⚠️ **Aksiyon sürümleri hakkında uyarı:** araştırma `checkout@v7`,
`configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5` etiketlerinin
var olduğunu tespit etti, ama **GitHub'ın kendi dokümanları ve aksiyonların
README'leri hâlâ v4/v5/v6 gösteriyor.** İlk deploy'da bir şey ters giderse
belgelenmiş güvenli set: `checkout@v4`, `configure-pages@v5`,
`upload-pages-artifact@v3`, `deploy-pages@v4`.

```yaml
name: Deploy to GitHub Pages
on:
  push: { branches: [main] }
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false   # canlıya çıkan bir deploy'u asla kesme

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
        env:
          VITE_BASE: /${{ github.event.repository.name }}/
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with: { path: ./dist }

  deploy:
    needs: build            # ZORUNLU, yoksa artifact'ı bulamaz
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

**Tek seferlik ayar:** Settings → Pages → Source → **GitHub Actions**.
Bu "Deploy from a branch"ten çevrilmeden workflow yayına çıkmaz.

### `base` tuzağı — bu sizi mutlaka ısırır

```ts
// vite.config.ts
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',   // tek repo, iki hosta doğru deploy
  build: { target: 'es2020', sourcemap: false },
});
```

`base` sadece Vite'ın *kendi işlediği* URL'leri düzeltir: `import`'lar,
`index.html`'deki `src`/`href`, CSS'teki `url()`. Kodunuzun runtime'da kurduğu
stringlere **dokunmaz**. Proje sayfalarında (`/yilmaz-vinc-simulator/`) şunların
hepsi sessizce 404 verir:

```ts
fetch('/data/levels.json')          // ✗
new Audio('/sfx/vinc.m4a')          // ✗
```

Doğrusu:

```ts
import craneUrl from './assets/crane.png';                    // ✓ en iyi
const u = `${import.meta.env.BASE_URL}data/levels.json`;      // ✓ public/ için
```

**Push'lamadan önce doğrulayın:** `npm run build` sonrası `dist/index.html`
içindeki her `src`/`href` `/yilmaz-vinc-simulator/` ile başlamalı.

### Mobil kontrol listesi

- **iOS ses kilidi.** `AudioContext` kilitli başlar ve `resume()` **gerçek bir
  dokunuşa bağlı senkron çağrı zincirinde** olmalı; araya `await` girerse iOS
  sessizce reddeder, hata da vermez. Ayrıca iOS'un standart dışı bir
  `"interrupted"` durumu var — sadece `"suspended"` kontrol eden kod oturum
  boyunca sessiz kalır. **Sonuç: açılışta mutlaka bir "OYNA" ekranı olmalı.**
- **`viewport-fit=cover`** olmadan `env(safe-area-inset-*)` hep `0px` döner ve
  Safari yatayda canvas'ı siyah bantlarla çerçeveler.
- **`100dvh` kullanın, `100vh` değil** — URL çubuğu daralınca canvas kırpılır.
- **`touch-action: none`** ve Pointer Events + `setPointerCapture()`.
- **`overscroll-behavior: none`** — aşağı çekip yenilemeyi kapatır.
- **`devicePixelRatio`'yu 2'de sınırlayın.** DPR 3'te render 2.25 kat iş, gözle
  fark yok, kare hızı çöker.
- **iOS fullscreen'e bel bağlamayın.** CSS fallback (`position: fixed; inset: 0`)
  %100 cihazda çalışır ve neredeyse aynı görünür.
- **Gerçek bir orta segment Android'de test edin** — medyan kullanıcınız o.

### Bütçeler

| Kalem | Hedef | Tavan |
|---|---|---|
| İlk kabuk (HTML+CSS+loader) | ≤ 170 KB | 250 KB |
| Motor + oyun kodu (gzip) | ≤ 300 KB | 500 KB |
| Oynanabilir olana kadar toplam | ≤ 2 MB | 5 MB |
| Tüm build | ≤ 8 MB | 15 MB |
| Ses, tamamı | ≤ 1.5 MB | 2.5 MB |

Türkiye medyan mobil indirme hızı ~46 Mbps; sorun bant genişliği değil,
gecikme ve CPU. 170 KB'lık kabuk markalı bir yükleme ekranı boyayıp motoru
tembel yüklemek içindir — 400 ms'de Yılmaz Vinç logolu bir bar, 1.2 sn'de beyaz
ekrandan iyidir.

**Ses formatı:** **AAC/`.m4a` taban olsun.** Ogg Vorbis global %96 destekli ama
eksik %4 eski iPhone'larda yoğunlaşıyor.

### WhatsApp paylaşım kartı

İki şey sessizce bozar: **(1)** WhatsApp botu JavaScript çalıştırmaz — etiketler
statik `index.html` içinde olmalı; **(2)** `og:image` mutlak `https://` URL
olmalı, göreli yol çözülmez. Ayrıca görseli **300 KB altında** tutun (Meta 600
KB diyor ama pratikte ~300 KB üstü düşüyor).

```html
<meta property="og:type"        content="website">
<meta property="og:locale"      content="tr_TR">
<meta property="og:url"         content="https://.../">
<meta property="og:title"       content="Yılmaz Vinç — Vinç Operatörü Oyunu">
<meta property="og:description" content="Yükü kaldır, sallanmadan yerine indir. Telefonda hemen oyna.">
<meta property="og:image"       content="https://.../og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card"       content="summary_large_image">
```

WhatsApp önizlemeleri URL başına agresif cache'lenir — **ilk paylaşımdan önce
gerçek üretim linkini test edin.**

---

## 4. Yol haritası

| Sprint | İş | Çıktı |
|---|---|---|
| **0** | Vite + TS + Pixi + planck iskeleti, sabit adım döngüsü, debug çizimi | Ekranda düşen bir kutu |
| **1** | Kamyon: `WheelJoint` süspansiyon, gaz, fren, kamera takibi | Sürülebilir kamyon |
| **2** | Outrigger'lar, devrilme, su terazisi | Ayak açmazsan devriliyor |
| **3** | Bom zinciri: slew + luff + teleskop, halat ve kanca | Vinç çalışıyor |
| **4** | Kanca bağlama, yük, LMI HUD'u, görev akışı | **Oynanabilir demo** |
| **5** | Kenney sprite'ları, ses, menü, puanlama | Sunulabilir |
| **6** | Mobil kontroller, OG kartı, Pages deploy | **Canlı link** |

Sprint 4 sonunda paylaşılabilir bir şey var. Sprint 5 ve 6 cila.

## 5. Kararlar

### Kesinleşenler

**Slew: ayrık 180° çevirme.** Yandan görünümde dikey eksen dönüşü dejenere olduğu
için bom "yatak konumundan çalışma konumuna" çevriliyor; 0.5 sn'lik bir geçiş
animasyonu. Oyuna gerçek bir hazırlık adımı katıyor.

**Yayınlama: GitHub Pages, özel alan adı yok.** Demo aile içinde kullanılacak,
pazarlama atağı yok. Bu, teknik planın 3. bölümündeki Cloudflare'e taşıma
gerekçesini şimdilik geçersiz kılıyor — bant genişliği ve ticari kullanım şartı
kaygıları bu ölçekte devreye girmiyor. Link:
`mertanj.github.io/yilmaz-vinc-simulator/`

> Not: repo public olduğu için linke sahip herkes oynayabilir. Aile içi kullanım
> için sorun değil; gerçekten kapalı olması istenirse private repo + Pages
> GitHub Pro gerektirir.

### Yeniden açılan karar: sanat yönü

**Piksel sanat tercih edilmiyor.** Gerekçe isabetli: simülasyonda gerçek yük
tablosu, LMI, sarkaç ve emergent devrilme var; kaba piksel sanat bu işi görsel
olarak boşa çıkarır.

Piksel zaten bir zorunluluk değildi. Vinci hazır sprite'la çizemiyoruz — bom
teleskop yaptığı için her açı/uzunluk kombinasyonu ayrı kare gerektirirdi. Yani
vinç her hâlükârda bizim çizdiğimiz bir şey; sorun sadece "hangi teknikle".

Araştırılan seçenekler: PixiJS Graphics ile prosedürel vektör · runtime'da
dönüştürülen SVG · 3B modelden ön-render sprite · düz vektör sprite paketleri
(Kenney Platformer Pack Industrial 70×70 düz vektör, piksel değil).

**Karar: prosedürel vektör** — uygulandı ve ekranda doğrulandı. Vinç `PixiJS
Graphics` ile kodla çiziliyor. Çözdüğü sorunlar: çözünürlük bağımsız, anında
renk değişimi, tam pivot kontrolü, teleskop kusursuz render olur — ve §11.2'deki
41×8 piksel giydirme kısıtı tamamen ortadan kalkar, logo gerçek yazı tipiyle
tek satır basılıyor (İ ve Ç dahil).

Referans araştırması yapılamadı: iki araştırma ajanı da oturum limitine takılıp
düştü. Karar kendi değerlendirmemle verildi; limit açılınca referans oyun ve
3B model araştırması tekrar çalıştırılabilir.

**Bilinen risk:** prosedürel vektörde kalite tamamen çizimin ne kadar iyi
kodlandığına bağlı. Temiz, okunaklı, teknik-illüstrasyon kalitesinde bir vinç
çıkar; fotogerçekçi bir vinç çıkmaz.

### Kapsam uyarısı

İlk brief "tek aşama, çok basit bir demo" idi. Fabrika + çok katlı hedefler +
yükseltilmiş görsel kalite, işi kabaca iki-üç katına çıkarıyor. Yapılamaz değil,
ama Sprint 4'teki "oynanabilir demo" kilometre taşı buna göre kayar. Tek katlı
sürümü önce çıkarıp üstüne kat eklemek en düşük riskli yol.
