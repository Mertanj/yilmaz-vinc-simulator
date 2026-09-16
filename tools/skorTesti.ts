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
    sapmalar: [0.1, 0.12, 0.12, 0.12, 0.12], puan,
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
  { puan: 5000, not: 'D', sure: 0, tamamlanan: 0, usta: false });
