/**
 * Oyunun bütün metinleri — tek yerde, iki dilde.
 *
 * İki sebeple birlikte yapıldı. Birincisi sahadan geldi: *"oyuna İngilizce dil
 * seçeneği getirmek de planlarımıza girmeli."* İkincisi de aynı turda geldi:
 * *"şu sol bar'ı düzenleyelim, şu an çok detaylı."* Paneli sadeleştirmek zaten
 * bütün metinleri elden geçirmek demek; ayrı ayrı yapmak aynı cümleyi iki kez
 * yazmak olurdu.
 *
 * Terimler çeviri değil, KARŞILIK: yük tablosu terminolojisinin İngilizcesi
 * zaten var ve sektörde kullanılan o. "yarıçap" → radius, "ayaklar" →
 * outriggers, "kat" → parts of line, "yük merkezi" → load centre, "iki-blok" →
 * two-blocking. Uydurma çeviri bir vinççi için Türkçesinden daha anlaşılmaz
 * olurdu.
 *
 * Firma giydirmesi (kamyondaki "YILMAZ VİNÇ", telefon numarası) ÇEVRİLMİYOR:
 * o bir marka, tabela değil.
 */

import { oku, yaz } from './kayit';

export type Dil = 'tr' | 'en';

/**
 * İpuçlarında geçen kumandanın adı.
 *
 * İpuçları oyunun öğretmen sesi ve tuşun adını söylüyorlar ("W ile kaldır").
 * Telefonda W tuşu yok; oradaki karşılık ekrandaki düğmenin üstünde yazan
 * kelime. İpucu metni ikisini de bilmek zorunda değil, adı dışarıdan alıyor.
 */
export interface KumandaAdi {
  kaldir: string;
  indir: string;
  /** İkisi birden: "W/S" ya da "kaldır/indir". */
  ikisi: string;
  ayaklar: string;
  kanca: string;
}

/** Yerleştirme onay panelinin satırları — sayılar çağıran tarafta. */
export interface KonduMetni {
  tik: string; kazanc: string; yerlestirme: string;
  isabet: (cm: number) => string;
  hiz: (sure: string) => string;
  ceza: string; enYuksekMoment: string;
  sonraki: (kalan: number) => string;
}

export interface Metinler {
  kod: Dil;
  ad: string;

  secim: {
    baslik: string; soru: string; altBilgi: string;
    zorluk: string; yakinda: string; sonOynadigin: string;
    /** Karttaki en iyi derece satırı; hiç oynanmamışsa basılmıyor. */
    enIyi: (puan: string, not_: string) => string;
    /** Dokunmatik cihazda, ekran kumandası olmayan araçta. */
    klavyeGerek: string;
  };

  /** Ekran üstü kumandanın düğme adları. */
  dokunma: {
    ileri: string; geri: string; fren: string;
    kaldir: string; indir: string; yatGeri: string; yatOn: string;
    sifirla: string; makineler: string; cevir: string;
    /** Vinç: faza göre değişen kümenin düğmeleri. */
    ayaklar: string; bomKaldir: string; bomIndir: string;
    /**
     * Ayak ve halat katı düğmeleri EYLEMİ yazıyor, durumu değil: ikisi de
     * sırayla gezen düğmeler ve "ayaklar" / "halat katı" yazınca basınca ne
     * olacağı hiç söylenmiyordu.
     */
    ayakYariAc: string; ayakTamAc: string; ayakTopla: string;
    katYap: (kat: number) => string;
    /** Halat geçirilirken: düğme 14 saniye boyunca sessiz kalmasın. */
    katSuruyor: string;
    teleskopUzat: string; teleskopKis: string;
    kancaYukari: string; kancaAsagi: string; kanca: string; kat: string;
  };

  ust: { puan: (n: number) => string; bolumTamam: string };

  panel: {
    detayIpucu: (acik: boolean) => string;
    /** Dokunmatikte aynı satır düğme oluyor; "I ·" öneki anlamsız kalıyor. */
    detayDokunma: (acik: boolean) => string;
    sinir: string; egim: string; hiz: string;
    /** Hız birimi — TR'de "km/sa", EN'de "km/h". */
    hizBirimi: string;
  };

  vinc: {
    ad: string; sinif: string; ozet: string; zorluk: string; tuslar: string;
    baslik: string;
    durum: { tabloDisi: string; asiriYuk: string; dikkat: string; guvenli: string };
    satir: {
      kancada: string; yaricap: string; bom: string; halat: string;
      ayaklar: string; tabloDisi: string;
      /**
       * Sınırı hangi şeyin koyduğu — her zaman görünen satırın etiketinde.
       *
       * Oyuncunun halat katı düğmesi karşısındaki asıl sorusu bu: "kat
       * artırsam işe yarar mı?" Halat bağlıyorsa yarar, tablo bağlıyorsa
       * yaramaz. Uzun hâli gösterge bloğunun alt satırında duruyor ama o
       * satır dar ekranda gizli.
       */
      sinirHalat: string; sinirTablo: string;
      toplu: string; yariAcik: string; tamAcik: string;
    };
    alt: {
      halatSinir: (tablo: string) => string;
      tabloSinir: (halat: string) => string;
      reeving: (sn: string) => string;
      kat: (kat: number, ton: string, sonraki: number) => string;
    };
    uyari: {
      ikiBlokBas: string; ikiBlokGovde: string; ikiBlokCozum: string;
      tabloDisiBas: string; tabloDisiGovde: (r: string) => string; tabloDisiCozum: string;
      asiriBas: string; asiriGovde: (yuk: string, r: string, sinir: string) => string;
      asiriCozumKilitli: string; asiriCozum: string;
      yakinBas: string; yakinGovde: (yuk: string, sinir: string, r: string) => string;
      /** Halat katı değiştirilemeyince — düğme sessizce reddediyordu. */
      katBas: string;
      katGovde: (neden: 'suruyor' | 'yuklu' | 'yuksek') => string;
      katCozum: string;
    };
    ipucu: {
      sallaniyor: string; yanCekme: string; ortala: string;
      yukseklik: string; uzak: string;
      surus: (k: KumandaAdi) => string;
      yukBagli: (k: KumandaAdi) => string;
      hazir: (k: KumandaAdi) => string;
    };
  };

  forklift: {
    ad: string; sinif: string; ozet: string; zorluk: string; tuslar: string;
    baslik: string;
    durum: { devrilir: string; dikkat: string; bosaliyor: string; oneYatiyor: string; guvenli: string };
    satir: { catalda: string; yukMerkezi: string; arkaAks: string; catalKotu: string; direkEgimi: string };
    alt: { merkez: (m: string) => string; alcakTasi: string; ustuDusuyor: (carpan: string) => string };
    uyari: {
      burunBas: string; burunGovde: (egim: string) => string; burunCozum: string;
      arkaBas: string; arkaGovde: (pay: string) => string; arkaCozum: string;
      asiriBas: string;
      asiriGovde: (yuk: string, merkez: string, kot: string, sinir: string) => string;
      asiriCozumKilitli: string; asiriCozum: string;
      yakinBas: string; yakinGovde: (yuk: string, sinir: string, merkez: string) => string;
    };
    ipucu: {
      teslimIniyor: string; teslimBekle: string;
      yuklu: string; yanas: string; uzak: string;
      hazir: (k: KumandaAdi) => string;
      yuksek: (k: KumandaAdi) => string;
      alcak: (k: KumandaAdi) => string;
      kot: (k: KumandaAdi) => string;
    };
  };

  kondu: KonduMetni;

  sonuc: {
    devrildi: string; tamamlandi: string; usta: string; puan: (n: number) => string;
    gorev: string; sure: string; maxMoment: string; kirmizi: string;
    salinim: string; carpma: string; sapma: string;
    /** Saniye kısaltması — TR'de "sn", EN'de "s". */
    saniye: string;
    basari: (p: string) => string; yeniden: string;
    rekor: string;
    oncekiEnIyi: (puan: string) => string;
    makineDegistir: string;
    /** Dokunmatikte R/Esc yok; oyuncuyu köşedeki düğmelere yönlendiriyor. */
    dokunmaNot: string;
  };

  /** Dar dikey ekranda yan çevirme çağrısı. */
  cevir: { bas: string; govde: string; yineOyna: string; yatayOyna: string };

  dekor: { sanayi: string; kurulum: string; sevkiyat: string; malKabul: string };

  gorev: Record<string, { ad: string; brif: string }>;

  /**
   * Yüzde biçimi. Türkçede işaret sayının ÖNÜNDE (%92), İngilizcede arkasında
   * (92%) — sözlükte kalması gereken, çevrilemeyen bir fark.
   */
  yuzde: (n: number | string) => string;

  hata: (e: string) => string;
}

const TR: Metinler = {
  kod: 'tr',
  ad: 'Türkçe',
  secim: {
    baslik: 'YILMAZ VİNÇ',
    soru: 'Hangi makineyle çalışacaksın?',
    altBilgi: 'Her makinenin kendi bölümü, kendi yük tablosu ve kendi tehlikesi var.'
      + ' Oyunun içinde <kbd>R</kbd> bölümü sıfırlar, <kbd>Esc</kbd> buraya döner.',
    zorluk: 'zorluk', yakinda: 'yakında', sonOynadigin: 'son oynadığın',
    enIyi: (puan, not_) => `en iyi ${puan} puan · not ${not_}`,
    klavyeGerek: 'klavye gerekir',
  },
  dokunma: {
    ileri: 'ileri', geri: 'geri', fren: 'fren',
    kaldir: 'kaldır', indir: 'indir', yatGeri: 'geri yat', yatOn: 'öne yat',
    sifirla: 'sıfırla', makineler: 'makineler', cevir: 'çevir',
    ayaklar: 'ayaklar', bomKaldir: 'bom kaldır', bomIndir: 'bom indir',
    ayakYariAc: 'yarı aç', ayakTamAc: 'tam aç', ayakTopla: 'ayakları topla',
    katYap: (kat) => `${kat} kat yap`, katSuruyor: 'geçiriliyor…',
    teleskopUzat: 'uzat', teleskopKis: 'kıs',
    kancaYukari: 'halat sar', kancaAsagi: 'halat sal', kanca: 'kanca',
    kat: 'halat katı',
  },
  ust: { puan: (n) => `${n} puan`, bolumTamam: 'bölüm tamamlandı' },
  panel: {
    detayIpucu: (acik) => acik ? 'I · detayı kapat' : 'I · detaylı panel',
    detayDokunma: (acik) => acik ? 'detayı kapat' : 'detaylı panel',
    sinir: 'sınır', egim: 'araç eğimi', hiz: 'hız', hizBirimi: 'km/sa',
  },
  vinc: {
    ad: 'YV-25 Teleskopik Vinç',
    sinif: '25 ton · 30 m bom · sanayi sitesi',
    ozet: 'Sanayi sitesinin beş katına yük çıkar. Ayakları aç, bomu kur, '
      + 'salınımı durdur ve terasa bırak.',
    zorluk: 'Sınırı yarıçap koyuyor: yük uzaklaştıkça kapasite düşer.',
    tuslar: '<b>sürüş</b> <kbd>→</kbd> gaz <kbd>←</kbd> geri <kbd>boşluk</kbd> el freni<br>'
      + '<b>kurulum</b> <kbd>Q</kbd> ayak aç/kapa<br>'
      + '<b>vinç</b> <kbd>W</kbd><kbd>S</kbd> bom <kbd>⇧W</kbd><kbd>⇧S</kbd> teleskop<br>'
      + '<kbd>↑</kbd><kbd>↓</kbd> kanca <kbd>boşluk</kbd> bağla/bırak<br>'
      + '<kbd>K</kbd> halat katı <kbd>I</kbd> detay <kbd>R</kbd> sıfırla'
      + ' <kbd>Esc</kbd> makine değiştir',
    baslik: 'KALDIRMA MOMENTİ',
    durum: {
      tabloDisi: 'YARIÇAP TABLO DIŞI', asiriYuk: 'AŞIRI YÜK',
      dikkat: 'DİKKAT · SINIRA YAKIN', guvenli: 'GÜVENLİ',
    },
    satir: {
      kancada: 'kancada', yaricap: 'yarıçap', bom: 'bom', halat: 'halat',
      ayaklar: 'ayaklar', tabloDisi: 'tablo dışı',
      sinirHalat: 'halat', sinirTablo: 'tablo',
      toplu: 'TOPLU', yariAcik: 'YARI AÇIK', tamAcik: 'TAM AÇIK',
    },
    alt: {
      halatSinir: (tablo) => `sınırı HALAT koyuyor (tablo ${tablo} t)`,
      tabloSinir: (halat) => `sınırı TABLO koyuyor (halat ${halat} t)`,
      reeving: (sn) => `halat geçiriliyor… ${sn} sn`,
      kat: (kat, ton, sonraki) => `${kat} kat · ${ton} t · K → ${sonraki} kat`,
    },
    uyari: {
      ikiBlokBas: '⚠ İKİ-BLOK — KANCA BOM KAFASINA DAYANDI',
      ikiBlokGovde: 'Halat bitti. Vinci yukarı almak ve teleskobu açmak <b>KİLİTLİ</b>;'
        + ' ikisi de halatı daha da kısaltır ve kancayı kafaya çarpar.',
      ikiBlokCozum: '↓ ile halatı sal. Teleskobu açarken vinci de salman gerekir —'
        + ' bom uzadıkça halat kısalır.',
      tabloDisiBas: '⚠ YARIÇAP TABLO DIŞI',
      tabloDisiGovde: (r) => `<b>${r} m</b> mesafede bu vinç <b>hiçbir yük</b>`
        + ' kaldıramaz — yük tablosu 28 metrede bitiyor.',
      tabloDisiCozum: 'W ile bomu kaldır ya da ⇧S ile teleskobu topla.',
      asiriBas: '⚠ AŞIRI YÜK — BU YÜKÜ BURADA KALDIRAMAZSIN',
      asiriGovde: (yuk, r, sinir) => `Kancadaki <b>${yuk} t</b>, <b>${r} m</b>`
        + ` mesafede izin verilen <b>${sinir} t</b> sınırının üstünde.`,
      asiriCozumKilitli: 'Bom indirme ve teleskop açma KİLİTLİ. W ile bomu kaldır'
        + ' ya da ⇧S ile teleskobu topla — yarıçap kısalır, sınır yükselir.',
      asiriCozum: 'W ile bomu kaldır: yarıçap kısalır, sınır yükselir.',
      yakinBas: 'SINIRA YAKLAŞIYORSUN',
      yakinGovde: (yuk, sinir, r) => `${yuk} t / ${sinir} t · yarıçap ${r} m.`
        + ' Yarıçapı büyütürsen kollar kilitlenir.',
      katBas: 'HALAT KATI DEĞİŞTİRİLEMEDİ',
      katGovde: (neden) => neden === 'yuklu'
        ? 'Kancada yük var. Sapancı halatı ancak kanca boşken yeniden geçirebilir.'
        : neden === 'yuksek'
          ? 'Kanca havada. Halatı yeniden geçirmek için kancanın el altında,'
            + ' yere yakın olması gerekiyor.'
          : 'Halat zaten geçiriliyor.',
      katCozum: 'Yükü bırak, kancayı yere indir, sonra tekrar dene.',
    },
    ipucu: {
      surus: (k) => `çalışma alanına yanaş, sonra ayakları aç (${k.ayaklar})`,
      yukBagli: (k) => `yük bağlı · bırak (${k.kanca})`,
      hazir: (k) => `KANCA MENZİLDE · bağla (${k.kanca})`,
      sallaniyor: 'kanca sallanıyor · dursun, sonra bağla',
      yanCekme: 'halat eğik · yan çekme olur, bomu yükün üstüne getir',
      ortala: 'kancayı yükün TAM ORTASINA getir',
      yukseklik: 'kancayı biraz daha indir',
      uzak: 'kancayı yükün üstüne indir',
    },
  },
  forklift: {
    ad: 'YF-25 Forklift',
    sinif: '2.5 ton · karşı ağırlıklı · depo',
    ozet: 'Paletleri kademeli rafın gözlerine koy. Yük alma tuşu yok: '
      + 'bıçağı paletin cebine sokup kaldırıyorsun, gerisi fizik.',
    zorluk: 'Sınırı yatay mesafe koyuyor: çatal ne kadar az girerse yük merkezi o kadar uzar.',
    tuslar: '<b>sürüş</b> <kbd>→</kbd> gaz <kbd>←</kbd> geri <kbd>boşluk</kbd> el freni<br>'
      + '<b>çatal</b> <kbd>W</kbd><kbd>S</kbd> kaldır/indir '
      + '<kbd>⇧W</kbd><kbd>⇧S</kbd> direk eğimi<br>'
      + '<b>yük alma tuşu yok</b> — bıçağı paletin cebine sok ve kaldır'
      + ' <kbd>I</kbd> detay <kbd>R</kbd> sıfırla <kbd>Esc</kbd> makine değiştir',
    baslik: 'DEVRİLME PAYI',
    durum: {
      devrilir: 'DEVRİLİR — ÇOK AĞIR', dikkat: 'DİKKAT · ARKA TEKER HAFİFLİYOR',
      bosaliyor: 'ARKA TEKER BOŞALIYOR', oneYatiyor: 'ÖNE YATIYOR', guvenli: 'GÜVENLİ',
    },
    satir: {
      catalda: 'çatalda', yukMerkezi: 'yük merkezi', arkaAks: 'arka aks',
      catalKotu: 'çatal kotu', direkEgimi: 'direk eğimi',
    },
    alt: {
      merkez: (m) => `yük merkezi ${m} m · çatal yüzünden`,
      alcakTasi: 'yük alçakken taşı — yükseldikçe kapasite düşer',
      ustuDusuyor: (carpan) => `3.3 m üstü: kapasite düşüyor (×${carpan})`,
    },
    uyari: {
      burunBas: '⚠ BURUN YERE DÜŞTÜ — ÇATALIN ÜSTÜNDESİN',
      burunGovde: (egim) => `Araç <b>${egim}°</b> öne devrildi ve çatalının`
        + ' üstüne oturdu. Ön tekerler artık yönlendirmiyor.',
      burunCozum: 'Geriye git ve yükü bırak: ⇧W ile direği geriye yatır, S ile indir.',
      arkaBas: '⚠ ARKA TEKER HAVALANIYOR — DEVRİLİYORSUN',
      arkaGovde: (pay) => `Arka aksta yükün yalnızca <b>%${pay}</b>'i kaldı.`
        + ' Karşı ağırlık yükü dengelemeye yetmiyor.',
      arkaCozum: 'S ile çatalı hemen indir, ⇧W ile direği geriye yatır, yavaşla.',
      asiriBas: '⚠ BU YÜK BU MESAFEDE KALDIRILAMAZ',
      asiriGovde: (yuk, merkez, kot, sinir) => `Çataldaki <b>${yuk} t</b>, yük merkezi`
        + ` <b>${merkez} m</b> ve kot <b>${kot} m</b> iken izin verilen`
        + ` <b>${sinir} t</b> sınırının üstünde.`,
      asiriCozumKilitli: 'Kaldırma ve öne yatırma KİLİTLİ. S ile indir —'
        + ' alçakta kapasite yüksek.',
      asiriCozum: 'Çatalı indir: 3.3 metrenin altında kapasite tam.',
      yakinBas: 'SINIRA YAKLAŞIYORSUN',
      yakinGovde: (yuk, sinir, merkez) => `${yuk} t / ${sinir} t · yük merkezi ${merkez} m.`
        + ' Yükseldikçe sınır düşer; taşırken çatalı alçakta tut.',
    },
    ipucu: {
      teslimIniyor: 'palet iniyor · konveyörün önünde bekle',
      teslimBekle: 'yeni palet için yükleme karesinin batısına geç',
      yuklu: 'yük çatalda · gözün önüne gel, kaldır, içeri sür, indir',
      hazir: (k) => `ÇATAL CEPTE · kaldır, palet gelecek (${k.kaldir})`,
      yuksek: (k) => `çatal çok yüksek · cebin altına in (${k.indir})`,
      alcak: (k) => `çatal çok alçak · paletin cebine getir (${k.kaldir})`,
      yanas: 'kot doğru · ileri sür, bıçağı cebe sok',
      kot: (k) => `çatalı paletin cebi hizasına getir (${k.ikisi})`,
      uzak: 'paletler koridorun doğu ucunda · sağa sür',
    },
  },
  kondu: {
    tik: '✓ YERİNE KONDU', kazanc: 'puan', yerlestirme: 'yerleştirme',
    isabet: (cm) => `isabet · ${cm} cm sapma`,
    hiz: (sure) => `hız · ${sure}`,
    ceza: 'aşırı yük / çarpma', enYuksekMoment: 'bu görevde en yüksek moment',
    sonraki: (kalan) => kalan > 0
      ? `sırada ${kalan} görev var · yeni yük malzeme alanında`
      : 'bölümdeki son yük — toparlayabilirsin',
  },
  sonuc: {
    devrildi: 'ARAÇ DEVRİLDİ', tamamlandi: 'BÖLÜM TAMAMLANDI', usta: 'USTA OPERATÖR',
    puan: (n) => `${n} puan`,
    gorev: 'tamamlanan görev', sure: 'süre', maxMoment: 'en yüksek kaldırma momenti',
    kirmizi: 'kırmızıda geçen süre', salinim: 'en geniş salınım', carpma: 'çarpma',
    sapma: 'ortalama yerleştirme sapması', saniye: 'sn',
    basari: (p) => `başarı %${p}`, yeniden: 'R ile yeniden başla',
    rekor: 'YENİ REKOR',
    oncekiEnIyi: (puan) => `önceki en iyi ${puan} puan`,
    makineDegistir: 'Esc ile makine değiştir',
    dokunmaNot: 'köşedeki ⟲ yeniden başlatır, ⊞ makineleri açar',
  },
  cevir: {
    bas: 'YATAY TUTUNCA DAHA İYİ',
    govde: 'Bölüm uzun bir koridorda geçiyor. Yatay tutunca makineyi ve '
      + 'hedefi aynı kadrajda görüyorsun; kumanda da iki başparmağın altına '
      + 'geliyor. Çeviremiyorsan dikeyde de oynanıyor.',
    yineOyna: 'dikey oyna',
    yatayOyna: 'yatay oyna',
  },
  dekor: {
    sanayi: 'SANAYİ SİTESİ · C BLOK', kurulum: 'KURULUM ALANI',
    sevkiyat: 'YILMAZ LOJİSTİK · SEVKİYAT', malKabul: 'MAL KABUL',
  },
  gorev: {
    T1: { ad: 'Sac bobin', brif: '1250 mm galvaniz bobin — 1. kat terasına' },
    T2: { ad: 'CNC torna', brif: 'Ağır CNC tezgâhı — aynı terasa, ama 800 kilo daha ağır' },
    T3: { ad: 'Jeneratör', brif: '125 kVA kabinli jeneratör — 2. kat terasına' },
    T4: { ad: 'Vidalı kompresör', brif: 'Vidalı kompresör — 3. kat, yarıçap 19 metre' },
    T5: { ad: 'Klima santrali', brif: 'Klima santrali — en üst teras, bomun sonu, ibre %92' },
    D1: { ad: 'Çimento paleti', brif: 'R1, 1.30 m — ısınma turu: çatalı paletin cebine dibine kadar sok' },
    D2: { ad: 'Fayans paleti', brif: 'R2, 3.00 m — kapasite tam burada erimeye başlıyor' },
    D3: { ad: 'Boya varilleri', brif: 'Geniş palet — çatal az girerse yük merkezi uzar, ibre tırmanır' },
    D4: { ad: 'Yalıtım balyası', brif: 'Bölümün en hafifi ama en genişi — en üst kat, 4.70 m' },
    D5: { ad: 'Çelik profil', brif: 'Bölümün en ağırı, en üst kat — ibre sınıra dayanır' },
  },
  yuzde: (n) => `%${n}`,
  hata: (e) => `Başlatılamadı: ${e}`,
};

const EN: Metinler = {
  kod: 'en',
  ad: 'English',
  secim: {
    baslik: 'YILMAZ VİNÇ',
    soru: 'Which machine are you running today?',
    altBilgi: 'Each machine has its own level, its own load chart and its own way'
      + ' of going wrong. In game, <kbd>R</kbd> restarts the level and'
      + ' <kbd>Esc</kbd> brings you back here.',
    zorluk: 'difficulty', yakinda: 'soon', sonOynadigin: 'last played',
    enIyi: (puan, not_) => `best ${puan} pts · grade ${not_}`,
    klavyeGerek: 'keyboard needed',
  },
  dokunma: {
    ileri: 'forward', geri: 'reverse', fren: 'brake',
    kaldir: 'raise', indir: 'lower', yatGeri: 'tilt back', yatOn: 'tilt fwd',
    sifirla: 'restart', makineler: 'machines', cevir: 'rotate',
    ayaklar: 'outriggers', bomKaldir: 'boom up', bomIndir: 'boom down',
    ayakYariAc: 'half deploy', ayakTamAc: 'full deploy', ayakTopla: 'stow legs',
    katYap: (kat) => `go to ${kat} parts`, katSuruyor: 'reeving…',
    teleskopUzat: 'extend', teleskopKis: 'retract',
    kancaYukari: 'reel in', kancaAsagi: 'pay out', kanca: 'hook',
    kat: 'parts of line',
  },
  ust: { puan: (n) => `${n} pts`, bolumTamam: 'level complete' },
  panel: {
    detayIpucu: (acik) => acik ? 'I · hide detail' : 'I · full panel',
    detayDokunma: (acik) => acik ? 'hide detail' : 'full panel',
    sinir: 'limit', egim: 'machine tilt', hiz: 'speed', hizBirimi: 'km/h',
  },
  vinc: {
    ad: 'YV-25 Telescopic Crane',
    sinif: '25 t · 30 m boom · industrial estate',
    ozet: 'Lift loads onto the terraces of a five-storey block. Set the outriggers, '
      + 'rig the boom, kill the swing and set it down.',
    zorluk: 'Radius sets the limit: the further out the load, the less you can lift.',
    tuslar: '<b>drive</b> <kbd>→</kbd> throttle <kbd>←</kbd> reverse <kbd>space</kbd> brake<br>'
      + '<b>setup</b> <kbd>Q</kbd> outriggers<br>'
      + '<b>crane</b> <kbd>W</kbd><kbd>S</kbd> boom <kbd>⇧W</kbd><kbd>⇧S</kbd> telescope<br>'
      + '<kbd>↑</kbd><kbd>↓</kbd> hoist <kbd>space</kbd> hook on/off<br>'
      + '<kbd>K</kbd> parts of line <kbd>I</kbd> detail <kbd>R</kbd> restart'
      + ' <kbd>Esc</kbd> switch machine',
    baslik: 'LOAD MOMENT',
    durum: {
      tabloDisi: 'RADIUS OFF CHART', asiriYuk: 'OVERLOAD',
      dikkat: 'CAUTION · NEAR LIMIT', guvenli: 'SAFE',
    },
    satir: {
      kancada: 'on hook', yaricap: 'radius', bom: 'boom', halat: 'rope',
      ayaklar: 'outriggers', tabloDisi: 'off chart',
      sinirHalat: 'rope', sinirTablo: 'chart',
      toplu: 'STOWED', yariAcik: 'HALF', tamAcik: 'FULL',
    },
    alt: {
      halatSinir: (tablo) => `ROPE is the limit (chart ${tablo} t)`,
      tabloSinir: (halat) => `CHART is the limit (rope ${halat} t)`,
      reeving: (sn) => `re-reeving… ${sn} s`,
      kat: (kat, ton, sonraki) => `${kat} parts · ${ton} t · K → ${sonraki} parts`,
    },
    uyari: {
      ikiBlokBas: '⚠ TWO-BLOCKING — HOOK IS AT THE BOOM HEAD',
      ikiBlokGovde: 'Out of rope. Hoisting up and telescoping out are <b>LOCKED</b>;'
        + ' both shorten the fall further and drive the hook into the head.',
      ikiBlokCozum: 'Pay out with ↓. You must pay out while telescoping too —'
        + ' extending the boom shortens the fall.',
      tabloDisiBas: '⚠ RADIUS OFF CHART',
      tabloDisiGovde: (r) => `At <b>${r} m</b> this crane can lift <b>nothing at all</b>`
        + ' — the load chart ends at 28 metres.',
      tabloDisiCozum: 'Raise the boom with W, or retract with ⇧S.',
      asiriBas: '⚠ OVERLOAD — YOU CANNOT LIFT THIS HERE',
      asiriGovde: (yuk, r, sinir) => `The <b>${yuk} t</b> on the hook is over the`
        + ` <b>${sinir} t</b> allowed at <b>${r} m</b>.`,
      asiriCozumKilitli: 'Boom-down and telescope-out are LOCKED. Raise the boom with W'
        + ' or retract with ⇧S — the radius shortens and the limit rises.',
      asiriCozum: 'Raise the boom with W: the radius shortens and the limit rises.',
      yakinBas: 'APPROACHING THE LIMIT',
      yakinGovde: (yuk, sinir, r) => `${yuk} t / ${sinir} t · radius ${r} m.`
        + ' Go out any further and the levers lock.',
      katBas: 'CANNOT RE-REEVE',
      katGovde: (neden) => neden === 'yuklu'
        ? 'There is a load on the hook. The rope can only be re-reeved with the'
          + ' hook empty.'
        : neden === 'yuksek'
          ? 'The hook is up in the air. Re-reeving needs the hook down at ground'
            + ' level, where the slinger can reach it.'
          : 'Already re-reeving.',
      katCozum: 'Set the load down, lower the hook to the ground, then try again.',
    },
    ipucu: {
      surus: (k) => `pull up to the set-up zone, then set the outriggers (${k.ayaklar})`,
      yukBagli: (k) => `load on the hook · release it (${k.kanca})`,
      hazir: (k) => `HOOK IN RANGE · attach (${k.kanca})`,
      sallaniyor: 'hook is swinging · let it settle, then attach',
      yanCekme: 'rope is off vertical · that is a side pull, bring the boom over the load',
      ortala: 'centre the hook over the load',
      yukseklik: 'lower the hook a little more',
      uzak: 'lower the hook onto the load',
    },
  },
  forklift: {
    ad: 'YF-25 Forklift',
    sinif: '2.5 t · counterbalance · warehouse',
    ozet: 'Put pallets into a stepped rack. No pick-up key: you slide the blades '
      + 'into the pallet pockets and lift — the rest is physics.',
    zorluk: 'Horizontal distance sets the limit: the shallower the forks go in, '
      + 'the longer the load centre.',
    tuslar: '<b>drive</b> <kbd>→</kbd> throttle <kbd>←</kbd> reverse <kbd>space</kbd> brake<br>'
      + '<b>forks</b> <kbd>W</kbd><kbd>S</kbd> raise/lower '
      + '<kbd>⇧W</kbd><kbd>⇧S</kbd> mast tilt<br>'
      + '<b>no pick-up key</b> — slide the blades into the pocket and lift'
      + ' <kbd>I</kbd> detail <kbd>R</kbd> restart <kbd>Esc</kbd> switch machine',
    baslik: 'TIPPING MARGIN',
    durum: {
      devrilir: 'WILL TIP — TOO HEAVY', dikkat: 'CAUTION · REAR AXLE GOING LIGHT',
      bosaliyor: 'REAR AXLE UNLOADING', oneYatiyor: 'PITCHING FORWARD', guvenli: 'SAFE',
    },
    satir: {
      catalda: 'on forks', yukMerkezi: 'load centre', arkaAks: 'rear axle',
      catalKotu: 'fork height', direkEgimi: 'mast tilt',
    },
    alt: {
      merkez: (m) => `load centre ${m} m · from the fork face`,
      alcakTasi: 'travel low — capacity falls with height',
      ustuDusuyor: (carpan) => `above 3.3 m: capacity derated (×${carpan})`,
    },
    uyari: {
      burunBas: '⚠ NOSE DOWN — YOU ARE SITTING ON YOUR FORKS',
      burunGovde: (egim) => `The truck has pitched <b>${egim}°</b> forward and come`
        + ' to rest on its forks. The front wheels no longer steer.',
      burunCozum: 'Back off and set the load down: ⇧W to tilt back, S to lower.',
      arkaBas: '⚠ REAR WHEEL LIFTING — YOU ARE TIPPING',
      arkaGovde: (pay) => `Only <b>${pay}%</b> of the load is left on the rear axle.`
        + ' The counterweight is not holding it.',
      arkaCozum: 'Lower the forks now with S, tilt back with ⇧W, slow down.',
      asiriBas: '⚠ THIS LOAD CANNOT BE LIFTED AT THIS REACH',
      asiriGovde: (yuk, merkez, kot, sinir) => `The <b>${yuk} t</b> on the forks is over`
        + ` the <b>${sinir} t</b> allowed at a load centre of <b>${merkez} m</b>`
        + ` and a height of <b>${kot} m</b>.`,
      asiriCozumKilitli: 'Lifting and forward tilt are LOCKED. Lower with S —'
        + ' capacity is higher down low.',
      asiriCozum: 'Lower the forks: below 3.3 m you have full capacity.',
      yakinBas: 'APPROACHING THE LIMIT',
      yakinGovde: (yuk, sinir, merkez) => `${yuk} t / ${sinir} t · load centre ${merkez} m.`
        + ' The limit drops as you lift; travel with the forks low.',
    },
    ipucu: {
      teslimIniyor: 'pallet coming down · wait clear of the conveyor',
      teslimBekle: 'move west of the loading square for the next pallet',
      yuklu: 'load on the forks · line up with the bay, lift, drive in, lower',
      hazir: (k) => `BLADES IN THE POCKET · lift, the pallet rides with you (${k.kaldir})`,
      yuksek: (k) => `forks too high · get under the pocket (${k.indir})`,
      alcak: (k) => `forks too low · line up with the pocket (${k.kaldir})`,
      yanas: 'height is right · drive in, slide the blades into the pocket',
      kot: (k) => `line the forks up with the pallet pocket (${k.ikisi})`,
      uzak: 'pallets arrive at the loading square · drive east',
    },
  },
  kondu: {
    tik: '✓ SET DOWN', kazanc: 'pts', yerlestirme: 'placement',
    isabet: (cm) => `accuracy · ${cm} cm off`,
    hiz: (sure) => `speed · ${sure}`,
    ceza: 'overload / impact', enYuksekMoment: 'peak moment on this task',
    sonraki: (kalan) => kalan > 0
      ? `${kalan} task${kalan === 1 ? '' : 's'} to go · next load is waiting`
      : 'last load of the level — pack up',
  },
  sonuc: {
    devrildi: 'MACHINE TIPPED', tamamlandi: 'LEVEL COMPLETE', usta: 'MASTER OPERATOR',
    puan: (n) => `${n} pts`,
    gorev: 'tasks completed', sure: 'time', maxMoment: 'peak load moment',
    kirmizi: 'time spent in the red', salinim: 'widest swing', carpma: 'impacts',
    sapma: 'average placement error', saniye: 's',
    basari: (p) => `score ${p}%`, yeniden: 'press R to run it again',
    rekor: 'NEW BEST',
    oncekiEnIyi: (puan) => `previous best ${puan} pts`,
    makineDegistir: 'press Esc to switch machines',
    dokunmaNot: '⟲ in the corner runs it again, ⊞ opens the machines',
  },
  cevir: {
    bas: 'BETTER IN LANDSCAPE',
    govde: 'The level runs down a long aisle. Landscape keeps the machine and '
      + 'the target in the same frame, and puts the controls under both thumbs. '
      + 'If you cannot turn it, portrait works too.',
    yineOyna: 'play in portrait',
    yatayOyna: 'play in landscape',
  },
  dekor: {
    sanayi: 'INDUSTRIAL ESTATE · BLOCK C', kurulum: 'SET-UP ZONE',
    sevkiyat: 'YILMAZ LOGISTICS · DESPATCH', malKabul: 'GOODS IN',
  },
  gorev: {
    T1: { ad: 'Steel coil', brif: '1250 mm galvanised coil — first-floor terrace' },
    T2: { ad: 'CNC lathe', brif: 'Heavy CNC lathe — same terrace, 800 kg heavier' },
    T3: { ad: 'Generator', brif: '125 kVA canopied generator — second-floor terrace' },
    T4: { ad: 'Screw compressor', brif: 'Screw compressor — third floor, 19 m radius' },
    T5: { ad: 'Air handling unit', brif: 'AHU — top terrace, end of the boom, 92% on the gauge' },
    D1: { ad: 'Cement pallet', brif: 'R1, 1.30 m — warm-up: get the blades right into the pocket' },
    D2: { ad: 'Tile pallet', brif: 'R2, 3.00 m — this is where capacity starts to melt' },
    D3: { ad: 'Paint drums', brif: 'Wide pallet — go in shallow and the load centre runs away' },
    D4: { ad: 'Insulation bale', brif: 'Lightest of the level but the widest — top bay, 4.70 m' },
    D5: { ad: 'Steel sections', brif: 'Heaviest of the level, top bay — the gauge hits the limit' },
  },
  yuzde: (n) => `${n}%`,
  hata: (e) => `Failed to start: ${e}`,
};

const SOZLUKLER: Record<Dil, Metinler> = { tr: TR, en: EN };
const ANAHTAR = 'yv.dil';

/**
 * Güncel sözlük.
 *
 * Modül düzeyinde değişken bir referans, çünkü dil oyun açılmadan ÖNCE
 * seçiliyor ve oyun içinde değişmiyor. Her çağrı yerine bir bağlam taşımak
 * bu kadarlık bir ihtiyaç için gereksiz olurdu.
 */
export let M: Metinler = TR;

export function dilSec(d: Dil): void {
  M = SOZLUKLER[d];
  // `lang` kozmetik değil: CSS'in `text-transform: uppercase`'i dile göre
  // çalışıyor. Belge `lang="tr"` kalırsa tarayıcı "difficulty" kelimesini
  // Türkçe kurallarıyla büyütüp "DİFFİCULTY" yazıyor.
  if (typeof document !== 'undefined') document.documentElement.lang = d;
  yaz(ANAHTAR, d);
}

/** Kayıtlı tercih, yoksa tarayıcının dili, o da yoksa Türkçe. */
export function baslangicDili(): Dil {
  const kayitli = oku(ANAHTAR);
  if (kayitli === 'tr' || kayitli === 'en') return kayitli;
  const tarayici = typeof navigator === 'undefined' ? 'tr' : navigator.language;
  return tarayici.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

/**
 * Oyuncu ekran kumandası mı kullanıyor?
 *
 * Dil gibi modül düzeyinde: bölüm başlarken bir kez belirleniyor ve oyun
 * içinde değişmiyor. İpuçlarının tek ihtiyacı bu.
 */
let dokunmatikKumanda = false;
export function kumandaModunuSec(dokunmatik: boolean): void {
  dokunmatikKumanda = dokunmatik;
}

export function kumandaAdi(): KumandaAdi {
  const d = M.dokunma;
  if (!dokunmatikKumanda) {
    return {
      kaldir: 'W', indir: 'S', ikisi: 'W/S',
      ayaklar: 'Q', kanca: M.kod === 'tr' ? 'boşluk' : 'space',
    };
  }
  return {
    kaldir: d.kaldir, indir: d.indir, ikisi: `${d.kaldir}/${d.indir}`,
    ayaklar: d.ayaklar, kanca: d.kanca,
  };
}

export const DILLER: readonly Dil[] = ['tr', 'en'];
export function sozluk(d: Dil): Metinler { return SOZLUKLER[d]; }

/** Görev adı/brifi — sözlükte yoksa veri dosyasındaki Türkçe kalıyor. */
export function gorevAdi(kod: string, yedek: string): string {
  return M.gorev[kod]?.ad ?? yedek;
}
export function gorevBrifi(kod: string, yedek: string): string {
  return M.gorev[kod]?.brif ?? yedek;
}
