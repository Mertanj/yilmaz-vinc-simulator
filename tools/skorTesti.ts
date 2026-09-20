/**
 * En iyi derece kaydının birim testi.
 *
 * Fizik rigleri (`npm run sahne`) bölümü baştan sona oynuyor ama skor KAYDINA
 * hiç dokunmuyor — o tarayıcı tarafında, bölüm bitince yazılıyor. Buradaki
 * riskler de fizik değil: rekorun yanlış tarafa yazılması, bir aracın diğerinin
 * kaydını ezmesi, ve elle kurcalanmış/eski bir `localStorage` kaydının oyunu
 * açılışta düşürmesi. Üçü de sessizce olur, üçü de burada yakalanıyor.
 */
import { enIyiOku, enIyiKaydet } from '../src/game/enIyi';
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
