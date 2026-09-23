/**
 * En iyi derece kaydının birim testi.
 *
 * Fizik rigleri (`npm run sahne`) bölümü baştan sona oynuyor ama skor KAYDINA
 * hiç dokunmuyor — o tarayıcı tarafında, bölüm bitince yazılıyor. Buradaki
 * riskler de fizik değil: rekorun yanlış tarafa yazılması, bir aracın diğerinin
 * kaydını ezmesi, ve elle kurcalanmış/eski bir `localStorage` kaydının oyunu
 * açılışta düşürmesi. Üçü de sessizce olur, üçü de burada yakalanıyor.
 */
import { enIyiOku, enIyiKaydet, turEnIyiOku, turEnIyiKaydet } from '../src/game/enIyi';
import { turuDegerlendir, type Bacak } from '../src/game/tamTur';
import { turSonucuHtml } from '../src/ui/turSonucHtml';
import {
  acikBolumSayisi, bolumAnahtari, rotaAnahtari, type BolumKimligi,
} from '../src/game/ilerleme';
import { M } from '../src/ui/dil';
import { farkiYaz, sureyiYaz } from '../src/ui/sure';
import type { Result } from '../src/game/mission';

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: () => null, length: 0,
} as Storage;

const sonuc = (puan: number, not: Result['not']): Result => ({
  not, puan: 80, usta: false, devrildi: false,
  score: {
    sure: 208, maxLmi: 96, kirmiziSn: 0.1, maxSalinim: 0, carpma: 0,
    sapmalar: [0.1, 0.12, 0.12, 0.12, 0.12],
    bitisler: [40, 82, 130, 171, 208], puan,
  },
});

const esit = (ad: string, a: unknown, b: unknown): void => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  console.log(`${ok ? 'GECTI ' : 'KALDI '} ${ad}${ok ? '' : `  ${JSON.stringify(a)} != ${JSON.stringify(b)}`}`);
  if (!ok) process.exitCode = 1;
};

esit('hic oynanmamis arac null doner', enIyiOku('forklift'), null);

const ilk = enIyiKaydet('forklift', sonuc(9012, 'A'));
esit('ilk tur her zaman rekor', ilk.rekor, true);
esit('ilk turda onceki yok', ilk.onceki, null);
esit('kayit okunuyor', enIyiOku('forklift')?.puan, 9012);

const dusuk = enIyiKaydet('forklift', sonuc(7400, 'C'));
esit('dusuk puan rekor degil', dusuk.rekor, false);
esit('dusuk puan onceki kaydi getiriyor', dusuk.onceki?.puan, 9012);
esit('dusuk puan kaydin uzerine YAZMIYOR', enIyiOku('forklift')?.puan, 9012);

const yuksek = enIyiKaydet('forklift', sonuc(9500, 'A'));
esit('yuksek puan rekor', yuksek.rekor, true);
esit('yuksek puan kaydi guncelliyor', enIyiOku('forklift')?.puan, 9500);

esit('esit puan rekor SAYILMAZ', enIyiKaydet('forklift', sonuc(9500, 'A')).rekor, false);

// Sahadan gelen hata: ilk tur devrildi, puan 0, not D — ve ekran "YENI REKOR"
// yazdi. Sebep karsilastirmanin kendisiydi: onceki kayit yoksa her sonuc rekor
// sayiliyordu. Ucu de ayri ayri yaziliyor cunku uc ayri sey soyluyorlar:
// ilan edilmiyor, kaydedilmiyor, ve sonraki turun "onceki" satirini kirletmiyor.
const devrik: Result = { ...sonuc(0, 'D'), devrildi: true };
esit('devrilen ilk tur rekor SAYILMAZ', enIyiKaydet('devrik', devrik).rekor, false);
esit('devrilen tur kaydedilmiyor', enIyiOku('devrik'), null);
esit('puansiz tur rekor SAYILMAZ',
  enIyiKaydet('sifir', sonuc(0, 'D')).rekor, false);
// Devrilen tur puan toplamis olsa bile ilan edilmiyor: tur basarisiz bitti.
esit('puanli ama devrilen tur rekor SAYILMAZ',
  enIyiKaydet('devrik', { ...sonuc(4200, 'D'), devrildi: true }).rekor, false);
// Kayitli rekoru da bozmuyor.
enIyiKaydet('devrik2', sonuc(5000, 'C'));
enIyiKaydet('devrik2', { ...sonuc(9999, 'A'), devrildi: true });
esit('devrilen tur mevcut rekorun uzerine YAZMIYOR', enIyiOku('devrik2')?.puan, 5000);

// --- ara sureler (speedrun) ---
//
// Rekor tur kendi ara surelerini tasiyor; bir sonraki tur onlara karsi
// kosuyor. Kayitla birlikte gidip gelmesi ve YALNIZCA rekor kirilinca
// guncellenmesi sart: eski turun sureleri yeni bir rekorla karismamali.
// Kendi aracinda: yukaridaki forklift dizisinin sirasini bozmasin.
const ileSure = (puan: number, b: number[]): Result => {
  const r = sonuc(puan, 'A');
  return { ...r, score: { ...r.score, bitisler: b } };
};
enIyiKaydet('split', ileSure(9000, [40, 82, 130, 171, 208]));
esit('rekor ara sureleri saklaniyor', enIyiOku('split')?.bitisler,
  [40, 82, 130, 171, 208]);
enIyiKaydet('split', ileSure(9900, [30, 60, 95, 130, 160]));
esit('yeni rekor ara sureleri de gunceller', enIyiOku('split')?.bitisler,
  [30, 60, 95, 130, 160]);
enIyiKaydet('split', ileSure(1000, [99, 99, 99, 99, 99]));
esit('dusuk puanli tur ara sureleri BOZMUYOR', enIyiOku('split')?.bitisler,
  [30, 60, 95, 130, 160]);
// Eski surum kaydinda alan hic yok; okuyan taraf bos diziyle karsilasmali.
store.set('yv.enIyi.eskisurum2', JSON.stringify({ puan: 5000, not: 'C' }));
esit('ara suresi olmayan eski kayit bos dizi doner',
  enIyiOku('eskisurum2')?.bitisler, []);
// Bozuk icerik de elenmeli: kayit elle kurcalanmis olabilir.
store.set('yv.enIyi.bozukdizi', JSON.stringify({ puan: 5000, bitisler: [10, 'x', null, 30] }));
esit('bozuk ara sureler ayiklaniyor', enIyiOku('bozukdizi')?.bitisler, [10, 30]);

esit('araclar birbirinden bagimsiz', enIyiOku('vinc'), null);
enIyiKaydet('vinc', sonuc(8412, 'B'));
esit('vinc kendi kaydini tutuyor', enIyiOku('vinc')?.puan, 8412);
esit('forklift etkilenmedi', enIyiOku('forklift')?.puan, 9500);

store.set('yv.enIyi.bozuk', '{yarim json');
esit('bozuk JSON null doner', enIyiOku('bozuk'), null);
store.set('yv.enIyi.eksik', '{"not":"A"}');
esit('puansiz kayit null doner', enIyiOku('eksik'), null);
store.set('yv.enIyi.nan', '{"puan":null}');
esit('puan sayi degilse null doner', enIyiOku('nan'), null);
store.set('yv.enIyi.eski', '{"puan":5000}');
esit('eski surum kaydi varsayilanlarla doluyor', enIyiOku('eski'),
  { puan: 5000, not: 'D', sure: 0, tamamlanan: 0, usta: false, bitisler: [] });

// --- sure bicimlendirme ---
//
// Ikisi de bir kez yanlis yazildi, o yuzden savla bagli.
// 1079.7 sn bir kez "17:60" yazmisti.
esit('saat 60 saniye GOSTERMEZ', sureyiYaz(1079.7), '17:59');
esit('tam dakika', sureyiYaz(120), '2:00');
esit('sifir', sureyiYaz(0), '0:00');
esit('eksi sure sifira kirpiliyor', sureyiYaz(-5), '0:00');
esit('saniye asagi yuvarlaniyor', sureyiYaz(59.99), '0:59');

// Isaret speedrun geleneginde: EKSI IYI.
esit('rekordan onde -> eksi ve iyi', farkiYaz(-12), { metin: '−0:12', iyi: true });
esit('rekordan geride -> arti ve kotu', farkiYaz(8), { metin: '+0:08', iyi: false });
esit('yarim saniyenin alti esit sayiliyor', farkiYaz(0.3), { metin: '±0:00', iyi: null });
esit('esitligin isareti yok', farkiYaz(-0.4), { metin: '±0:00', iyi: null });
esit('bir dakikadan buyuk fark', farkiYaz(-95), { metin: '−1:35', iyi: true });
esit('NaN esit sayiliyor', farkiYaz(NaN), { metin: '±0:00', iyi: null });

// --- TAM TUR ---
//
// Turun kendi mantigi bolumunkinden AYRI ve ikisinin ayrismasi sessiz olur:
// not ayni olcekten geliyor (bolumde A, turda C gorulurse sebep oyuncunun
// oyunu olmali, iki ayri olcek degil), rekor olcusu ise SURE.
const bacak = (
  aracId: string, sure: number, puan: number, tamamlanan: number,
  bitis: number, ek: Partial<Bacak> = {},
): Bacak => ({
  aracId, sure, bitis, puan, tamamlanan, gorevSayisi: 5,
  devrildi: false, carpma: 0, kirmiziSn: 0, ...ek,
});

// GOREV_MAX = 1000 + 600 + 400 = 2000; 15 gorev -> tavan 30000.
const tamTur = turuDegerlendir([
  bacak('forklift', 220, 9300, 5, 220),
  bacak('dirsekli', 900, 9100, 5, 1120),
  bacak('vinc', 720, 8800, 5, 1840),
]);
esit('tur suresi bacaklarin toplami', tamTur.sure, 1840);
esit('tur puani bacaklarin toplami', tamTur.puan, 27200);
esit('tur gorev sayisi', `${tamTur.tamamlanan}/${tamTur.gorevSayisi}`, '15/15');
esit('tur notu bolum notuyla AYNI olcekte', tamTur.not, 'A');
esit('temiz tam kadro usta', tamTur.usta, true);

const kirli = turuDegerlendir([
  bacak('forklift', 220, 9300, 5, 220),
  bacak('dirsekli', 900, 9100, 5, 1120, { carpma: 1 }),
  bacak('vinc', 720, 8800, 5, 1840),
]);
esit('tek carpma ustayi dusuruyor', kirli.usta, false);

const yarim = turuDegerlendir([
  bacak('forklift', 220, 9300, 5, 220),
  bacak('dirsekli', 300, 1200, 1, 520, { devrildi: true }),
  bacak('vinc', 720, 8800, 5, 1240),
]);
esit('devrilen bacak turu BITIRMIYOR', yarim.bacaklar.length, 3);
esit('yarim turda gorev sayisi eksik', `${yarim.tamamlanan}/${yarim.gorevSayisi}`, '11/15');
esit('yarim tur notu dusuyor', yarim.not, 'C');
esit('yarim tur usta DEGIL', yarim.usta, false);

// --- tur rekoru: IKI KATEGORI, ikisi de TAM tur ---
//
// Hizli kosmak isabetten ve kirmizidan puan kaybettiriyor, temiz kosmak sure
// kaybettiriyor: ikisi ayni oyunu odullendirmiyor, o yuzden ayri kategoriler.
esit('hic tur oynanmamis -> iki kategori de null',
  turEnIyiOku(), { hiz: null, puan: null });

// Yarim tur (devrilmis bacak) HICBIR kategoriye girmiyor.
const yarimKayit = turEnIyiKaydet(yarim);
esit('yarim tur hiz rekoru DEGIL', yarimKayit.hizRekoru, false);
esit('yarim tur puan rekoru DEGIL', yarimKayit.puanRekoru, false);
esit('yarim tur hicbir sey yazmiyor', turEnIyiOku(), { hiz: null, puan: null });

const ilkTam = turEnIyiKaydet(tamTur);
esit('ilk tam tur iki kategoriyi de aliyor',
  [ilkTam.hizRekoru, ilkTam.puanRekoru], [true, true]);
esit('hiz rekoru sureyi sakliyor', turEnIyiOku().hiz?.sure, 1840);
esit('hiz rekoru ayak bitislerini sakliyor',
  turEnIyiOku().hiz?.bitisler, [220, 1120, 1840]);
esit('puan rekoru puani sakliyor', turEnIyiOku().puan?.puan, 27200);

// Daha HIZLI ama daha DUSUK puanli tur: yalniz hiz rekorunu kiriyor.
const hizliAmaKirli = turuDegerlendir([
  bacak('forklift', 150, 7000, 5, 150),
  bacak('dirsekli', 700, 7000, 5, 850),
  bacak('vinc', 600, 7000, 5, 1450),
]);
const h = turEnIyiKaydet(hizliAmaKirli);
esit('hizli ama dusuk puanli tur: yalniz HIZ rekoru',
  [h.hizRekoru, h.puanRekoru], [true, false]);
esit('hiz rekoru guncellendi', turEnIyiOku().hiz?.sure, 1450);
esit('puan rekoru KORUNDU', turEnIyiOku().puan?.puan, 27200);

// Daha YAVAS ama daha YUKSEK puanli tur: yalniz puan rekorunu kiriyor.
const yavasAmaTemiz = turuDegerlendir([
  bacak('forklift', 300, 9800, 5, 300),
  bacak('dirsekli', 1100, 9800, 5, 1400),
  bacak('vinc', 900, 9800, 5, 2300),
]);
const y = turEnIyiKaydet(yavasAmaTemiz);
esit('yavas ama temiz tur: yalniz PUAN rekoru',
  [y.hizRekoru, y.puanRekoru], [false, true]);
esit('puan rekoru guncellendi', turEnIyiOku().puan?.puan, 29400);
esit('hiz rekoru KORUNDU', turEnIyiOku().hiz?.sure, 1450);

esit('esit sure ve esit puan hicbir rekor DEGIL',
  [turEnIyiKaydet(hizliAmaKirli).hizRekoru,
    turEnIyiKaydet(yavasAmaTemiz).puanRekoru], [false, false]);

// --- TAM TUR SONUC EKRANI ---
//
// Bu ekrani oyun testinde KIMSE goremedi: forklift ayagi iki kez bitirildi,
// el degistirme karti dogrulandi, ama uc ayagi birden bitirecek bir otopilot
// yazilamadi. Ekran DOM'a degil VERIYE bagli oldugu icin buradan sinaniyor.
const icerir = (ad: string, metin: string, parca: string): void => {
  const ok = metin.includes(parca);
  console.log(`${ok ? 'GECTI ' : 'KALDI '} ${ad}${ok ? '' : `  "${parca}" yok`}`);
  if (!ok) process.exitCode = 1;
};
const icermez = (ad: string, metin: string, parca: string): void => {
  const ok = !metin.includes(parca);
  console.log(`${ok ? 'GECTI ' : 'KALDI '} ${ad}${ok ? '' : `  "${parca}" VAR`}`);
  if (!ok) process.exitCode = 1;
};
const ad = (id: string): string => ({ forklift: 'YF-25 Forklift',
  dirsekli: 'YV-9 Dirsekli Vinç', vinc: 'YV-25 Teleskopik Vinç' }[id] ?? id);

// 1) Ilk tur: rekor yok, ayak dokumunde fark sutunu bos, "ilk turun" notu var.
const ilkHtml = turSonucuHtml(tamTur, { hizRekoru: true, puanRekoru: true },
  { hiz: null, puan: null }, ad);
icerir('tur sonucu: not', ilkHtml, 'data-not="A"');
icerir('tur sonucu: toplam sure', ilkHtml, '>30:40<');           // 1840 sn
icerir('tur sonucu: gorev sayisi', ilkHtml, '>15 / 15<');
icerir('tur sonucu: puan ve basari', ilkHtml, '27200 puan');
icerir('tur sonucu: uc ayagin adi da var', ilkHtml, 'YV-25 Teleskopik Vinç');
icerir('tur sonucu: ayak suresi', ilkHtml, '>3:40<');            // forklift 220 sn
icerir('tur sonucu: kumulatif bitis', ilkHtml, '>18:40<');       // dirsekli 1120
icerir('ilk turda "ilk turun" notu', ilkHtml, M.tur.ilkTur);
icerir('ilk turda iki rekor da kirildi', ilkHtml, M.tur.hizRekoru);
icerir('ilk turda puan rekoru da kirildi', ilkHtml, M.tur.puanRekoru);
icermez('ilk turda "onceki rekor" YOK', ilkHtml, 'class="onceki"');

// 2) Rekorlu tur: fark sutunu dolu, kirilmayan rekor "oncekin" olarak yaziyor.
const eskiRekor = {
  hiz: { sure: 1900, not: 'B' as const, puan: 25000, tamamlanan: 15,
    gorevSayisi: 15, usta: false, bitisler: [240, 1150, 1900] },
  puan: { sure: 2400, not: 'A' as const, puan: 29000, tamamlanan: 15,
    gorevSayisi: 15, usta: true, bitisler: [300, 1400, 2400] },
};
const ikinciHtml = turSonucuHtml(tamTur, { hizRekoru: true, puanRekoru: false },
  eskiRekor, ad);
icerir('rekor varken ayak farki yaziliyor', ikinciHtml, 'data-iyi=');
icerir('ondeyken fark EKSI ve iyi', ikinciHtml, 'data-iyi="evet"');
icermez('rekor varken "ilk turun" notu YOK', ikinciHtml, M.tur.ilkTur);
icerir('kirilmayan puan rekoru "oncekin" olarak yaziyor', ikinciHtml,
  M.tur.oncekiPuan('29000 puan'));
icermez('kirilan hiz rekoru "oncekin" olarak YAZILMIYOR', ikinciHtml,
  M.tur.oncekiHiz('31:40'));

// 3) Yarim tur: baslik "bitti" degil "terk edildi".
const yarimHtml = turSonucuHtml(yarim, { hizRekoru: false, puanRekoru: false },
  { hiz: null, puan: null }, ad);
icerir('yarim turun basligi TERK EDILDI', yarimHtml, M.tur.terkEdildi);
icermez('yarim turda TAM TUR BITTI YOK', yarimHtml, M.tur.bitti);
icerir('yarim turda gorev sayisi eksik', yarimHtml, '>11 / 15<');
icermez('yarim turda usta rozeti YOK', yarimHtml, 'class="rozet"');
icerir('temiz tam kadroda usta rozeti VAR', ilkHtml, 'class="rozet"');

// --- BOLUM ILERLEMESI ---
//
// Sahadan gelen karar: "sirayla acilsin." Ilerleme ayri bir kayit degil,
// rekorlardan TURETILIYOR — iki kaynak birbirinden kopamiyor.
esit('ilk bolumun anahtari ESKI arac anahtari',
  bolumAnahtari({ aracId: 'deneme', bolumId: 'bir', indeks: 0 }), 'deneme');
esit('sonraki bolum kendi anahtarini aliyor',
  bolumAnahtari({ aracId: 'deneme', bolumId: 'iki', indeks: 1 }), 'deneme.iki');

const uc = ['bir', 'iki', 'uc'];
esit('hic oynanmamis makinede yalniz ilk bolum acik', acikBolumSayisi('deneme', uc), 1);
enIyiKaydet(bolumAnahtari({ aracId: 'deneme', bolumId: 'bir', indeks: 0 }),
  sonuc(9000, 'A'));
esit('ilk bolum bitince ikincisi aciliyor', acikBolumSayisi('deneme', uc), 2);
// Devrilen tur kayda girmedigi icin bolum de ACMIYOR.
enIyiKaydet(bolumAnahtari({ aracId: 'deneme', bolumId: 'iki', indeks: 1 }),
  { ...sonuc(4000, 'D'), devrildi: true });
esit('devrilen tur bolum ACMIYOR', acikBolumSayisi('deneme', uc), 2);
enIyiKaydet(bolumAnahtari({ aracId: 'deneme', bolumId: 'iki', indeks: 1 }),
  sonuc(8000, 'B'));
esit('ikinci bitince ucuncu aciliyor', acikBolumSayisi('deneme', uc), 3);
enIyiKaydet(bolumAnahtari({ aracId: 'deneme', bolumId: 'uc', indeks: 2 }),
  sonuc(8000, 'B'));
esit('acik bolum sayisi bolum sayisini ASMIYOR', acikBolumSayisi('deneme', uc), 3);
esit('tek bolumlu makine hep 1', acikBolumSayisi('tek', ['yalniz']), 1);
// Bolumler gelmeden once birinci bolumu bitirmis oyuncu: kaydi eski
// anahtarda duruyor ve ikinci bolum kendiliginden acik geliyor.
esit('eski arac kaydi olan oyuncuda ikinci bolum acik',
  acikBolumSayisi('forklift', ['depo', 'rampa']), 2);

// --- TAM TUR ROTASI ---
const k0 = (aracId: string, bolumId: string, indeks: number): BolumKimligi =>
  ({ aracId, bolumId, indeks });
esit('hepsi-birinci-bolum rotasi ESKI tur anahtarlarini koruyor',
  rotaAnahtari([k0('forklift', 'depo', 0), k0('vinc', 'sanayi', 0)]), undefined);
const rotaIki = rotaAnahtari([k0('forklift', 'rampa', 1), k0('vinc', 'sanayi', 0)]);
esit('farkli bolumden gecen rota kendi anahtarini aliyor',
  rotaIki, 'forklift.rampa+vinc.sanayi');
esit('yeni rotada rekor YOK (eski rotanin rekoru tasinmiyor)',
  turEnIyiOku(rotaIki), { hiz: null, puan: null });
turEnIyiKaydet(tamTur, rotaIki);
esit('yeni rotanin rekoru kendi anahtarinda', turEnIyiOku(rotaIki).hiz?.sure, 1840);
esit('eski rotanin rekoru ETKILENMEDI', turEnIyiOku().hiz?.sure, 1450);
