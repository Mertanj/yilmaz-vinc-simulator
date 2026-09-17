/**
 * Dirsekli bomun çalışma zarfını ölçer — `npm run zarf`.
 *
 * Bölüm tasarımı bu sayılara bağlı: makine hangi duvarı aşabiliyor, aştıktan
 * sonra ne kadar uzağa ne kadar yük koyabiliyor.
 *
 * **Bu araç bir kez yanılttı ve dersi buraya yazılı.** Önce yalnızca zarfın
 * SINIRLARINI ölçüyordu (en uzak uç, en yüksek uç, her yarıçapta en alt/üst
 * kot). İki kollu bir zincirin zarfı dışbükey değil; ortasında DELİK olabiliyor
 * ve sınırlar onu göstermiyor. Bölüm o deliğin üstüne kuruldu ve oynanmadı.
 * Bölüm 7'deki HARİTA o yüzden var: sınır değil, içi.
 */
import {
  DIRSEKLI_SPEC as S, dirsekNoktasi, ucNoktasi, calismaYaricapi,
  dirsekliKapasitesi, kirmaYonuDeg, dirsekliCozum, kirmaBoyu,
  type DirsekliDurum,
} from '../src/sim/dirsekliGeometri';

/** Üç eksenli tarama — adımlar kaba, çünkü artık 3 boyut var. */
function* konfigler(anaAdim = 1, kirmaAdim = 1, uzamaAdim = 0.2): Generator<DirsekliDurum> {
  for (let a = S.anaMinDeg; a <= S.anaMaxDeg; a += anaAdim) {
    for (let k = S.kirmaMinDeg; k <= S.kirmaMaxDeg; k += kirmaAdim) {
      for (let u = 0; u <= S.kirmaUzamaM + 1e-9; u += uzamaAdim) {
        yield { anaDeg: a, kirmaDeg: k, uzamaM: u };
      }
    }
  }
}

// --- 1) uc nereye kadar gidiyor? ---
let enUzak = { r: 0, y: 0, d: null as DirsekliDurum | null };
let enYuksek = { r: 0, y: 0, d: null as DirsekliDurum | null };
for (const d of konfigler()) {
  const u = ucNoktasi(d);
  if (u.x > enUzak.r) enUzak = { r: u.x, y: u.y, d };
  if (u.y > enYuksek.y) enYuksek = { r: u.x, y: u.y, d };
}
const yaz = (d: DirsekliDurum | null): string => d
  ? `ana ${d.anaDeg.toFixed(0)}° kirma ${d.kirmaDeg.toFixed(0)}° uzama ${d.uzamaM.toFixed(1)}m`
  : '—';
console.log(`kollar: ana ${S.anaBoomM} m · kirma ${S.kirmaTabanM}`
  + `–${(S.kirmaTabanM + S.kirmaUzamaM).toFixed(1)} m (teleskop ${S.kirmaUzamaM} m)`);
console.log(`en uzak uc   R ${enUzak.r.toFixed(2)} m  y ${enUzak.y.toFixed(2)} m  (${yaz(enUzak.d)})`
  + `  kapasite ${dirsekliKapasitesi(enUzak.r).toFixed(2)} t`);
console.log(`en yuksek uc y ${enYuksek.y.toFixed(2)} m  R ${enYuksek.r.toFixed(2)} m  (${yaz(enYuksek.d)})`);

// --- 2) duvarin ustunden asabiliyor mu? ---
function dogruParcasiGecer(
  a: { x: number; y: number }, b: { x: number; y: number }, duvarX: number, duvarY: number,
): boolean {
  if ((a.x - duvarX) * (b.x - duvarX) > 0) return true;   // duvari hic kesmiyor
  const t = (duvarX - a.x) / (b.x - a.x);
  return a.y + t * (b.y - a.y) > duvarY;
}
/** Bomun iki parcasi da duvari siyiriyor mu? */
function bomTemiz(d: DirsekliDurum, duvarX: number, duvarY: number): boolean {
  const ayak = { x: S.pivotOffsetM, y: S.pivotHeightM };
  const dirsek = dirsekNoktasi(d);
  return dogruParcasiGecer(ayak, dirsek, duvarX, duvarY)
    && dogruParcasiGecer(dirsek, ucNoktasi(d), duvarX, duvarY);
}

const duvarlar: Array<[number, number]> = [[4.5, 4.0], [5.0, 4.5], [5.5, 5.0], [4.0, 5.5]];
for (const [duvarX, duvarY] of duvarlar) {
  type Coz = { d: DirsekliDurum; r: number; y: number; kap: number };
  let enIyi: Coz | null = null;
  let enUzakCoz: Coz | null = null;
  let sayi = 0;
  for (const d of konfigler()) {
    const u = ucNoktasi(d);
    if (u.x < duvarX + 1.0 || u.x > S.maxYaricapM) continue;
    if (u.y < 2.2 || u.y > 7.5) continue;
    if (!bomTemiz(d, duvarX, duvarY)) continue;
    sayi++;
    const kayit = { d, r: u.x, y: u.y, kap: dirsekliKapasitesi(u.x) };
    if (!enIyi || kayit.kap > enIyi.kap) enIyi = kayit;
    if (!enUzakCoz || kayit.r > enUzakCoz.r) enUzakCoz = kayit;
  }
  console.log(
    `\nduvar x=${duvarX} y=${duvarY}:  ${sayi} cozum`
    + (enIyi
      ? `\n  en cok kapasite: ${yaz(enIyi.d)} -> R ${enIyi.r.toFixed(2)} m`
        + ` uc ${enIyi.y.toFixed(2)} m  kapasite ${enIyi.kap.toFixed(2)} t`
        + `\n  en uzak:         ${yaz(enUzakCoz!.d)} -> R ${enUzakCoz!.r.toFixed(2)} m`
        + ` uc ${enUzakCoz!.y.toFixed(2)} m  kapasite ${enUzakCoz!.kap.toFixed(2)} t`
      : '  — hicbir konfigurasyon duvari asamiyor'),
  );
}

// --- 3) ayni ucu farkli katlanmayla tutturmak: karar var mi? ---
//
// Teleskopsuz halde bu soru CEVAPSIZ kalmisti: kirma tek yone katlandigi icin
// bir noktanin pratikte tek cozumu vardi, yani oyuncunun onunde bir karar
// yoktu. Teleskop ucuncu ekseni getiriyor ve soru yeniden anlamli oluyor:
// ayni noktaya toplu-ve-dik ya da uzun-ve-yatik gidilebiliyor, ikisinin
// kapasitesi ayni (yaricap ayni) ama duvara payi farkli.
console.log('\nayni uc noktasini veren farkli konfigurasyonlar (uc ~ 6.5, 3.0):');
let bulunan = 0;
for (const d of konfigler(1, 1, 0.4)) {
  const u = ucNoktasi(d);
  if (Math.abs(u.x - 6.5) > 0.06 || Math.abs(u.y - 3.0) > 0.06) continue;
  if (bulunan++ > 7) break;
  const dir = dirsekNoktasi(d);
  console.log(`  ${yaz(d)}  dirsek (${dir.x.toFixed(2)}, ${dir.y.toFixed(2)})`
    + `  kirma yonu ${kirmaYonuDeg(d).toFixed(0)}°  kirma boyu ${kirmaBoyu(d).toFixed(2)} m`
    + `  R ${calismaYaricapi(d).toFixed(2)} m`);
}
if (bulunan === 0) console.log('  — hicbiri');

// --- 4) erisim tablosu ---
console.log('\nerisim tablosu (tabla merkezine gore):');
console.log('   R     uc en yuksek   uc en alcak   kapasite');
for (let r = 2; r <= S.maxYaricapM; r += 0.5) {
  let yuksek = -99; let alcak = 99;
  for (const d of konfigler(0.5, 0.5, 0.1)) {
    const u = ucNoktasi(d);
    if (Math.abs(u.x - r) > 0.1) continue;
    if (u.y > yuksek) yuksek = u.y;
    if (u.y < alcak) alcak = u.y;
  }
  if (yuksek < -90) { console.log(`  ${r.toFixed(1)}   — erisilmiyor`); continue; }
  console.log(`  ${r.toFixed(1)}      ${yuksek.toFixed(2)} m        ${alcak.toFixed(2)} m`
    + `      ${dirsekliKapasitesi(r).toFixed(2)} t`);
}

// --- 5) yuk duvari GERCEKTEN asabiliyor mu? ---
//
// Duvara takilan sey bom degil, halattan sarkan YUK: uc duvarin ustunden
// gecerken yukun ALT yuzu de duvarin ustunde olmali.
function yukGecebilirMi(duvarX: number, duvarY: number, yukBoyM: number, halatM: number): {
  olur: boolean; gerekenUc: number; enYuksekUc: number;
} {
  const gereken = duvarY + halatM + yukBoyM;
  let enYuksek = -99;
  for (const d of konfigler(0.5, 0.5, 0.1)) {
    const u = ucNoktasi(d);
    if (Math.abs(u.x - duvarX) > 0.15) continue;
    if (!bomTemiz(d, duvarX, duvarY)) continue;
    if (u.y > enYuksek) enYuksek = u.y;
  }
  return { olur: enYuksek >= gereken, gerekenUc: gereken, enYuksekUc: enYuksek };
}
console.log('\nyuk duvarin ustunden gecebiliyor mu? (yuk boyu 1.4 m, halat 0.6 m)');
for (const [duvarX, duvarY] of duvarlar) {
  const s = yukGecebilirMi(duvarX, duvarY, 1.4, 0.6);
  console.log(`  duvar x=${duvarX} y=${duvarY}: uc ${s.gerekenUc.toFixed(2)} m gerekiyor,`
    + ` en fazla ${s.enYuksekUc.toFixed(2)} m  ->  ${s.olur ? 'GECER' : 'GECMEZ'}`);
}

// --- 6) ters kinematik gidis-donus ---
{
  let denenen = 0; let cozulen = 0; let enKotu = 0; let kotuNokta = { x: 0, y: 0 };
  for (let x = 1.5; x <= S.maxYaricapM; x += 0.25) {
    for (let y = -1.5; y <= 11.5; y += 0.25) {
      denenen++;
      const c = dirsekliCozum({ x, y });
      if (!c) continue;
      cozulen++;
      const geri = ucNoktasi(c);
      const hata = Math.hypot(geri.x - x, geri.y - y);
      if (hata > enKotu) { enKotu = hata; kotuNokta = { x, y }; }
    }
  }
  console.log(`\nters kinematik: ${cozulen}/${denenen} nokta cozuldu,`
    + ` en buyuk gidis-donus hatasi ${(enKotu * 1000).toFixed(2)} mm`
    + ` (${kotuNokta.x.toFixed(2)}, ${kotuNokta.y.toFixed(2)})`);
  if (enKotu > 0.06) { console.log('  HATA: ters kinematik tutarsiz'); process.exitCode = 1; }
}

// --- 7) zarfin ICI: harita ---
{
  const solX = 1; const sagX = Math.ceil(S.maxYaricapM);
  const sutun = Math.round((sagX - solX) / 0.5) + 1;
  console.log('\nzarf haritasi (# erisilir, · erisilmez) — 0.5 m adim:');
  for (let y = 11.5; y >= -2; y -= 0.5) {
    let satir = `${y.toFixed(1).padStart(5)} `;
    for (let i = 0; i < sutun; i++) satir += dirsekliCozum({ x: solX + i * 0.5, y }) ? '#' : '·';
    console.log(satir);
  }
  console.log('      ' + Array.from({ length: sutun }, (_, i) => (solX + i * 0.5) % 1 === 0
    ? String((solX + i * 0.5) % 10) : ' ').join(''));
  let acik = 0; let toplam = 0;
  let isAlani = 0; let isToplam = 0;
  for (let x = solX; x <= sagX; x += 0.25) {
    for (let y = -2; y <= 11.5; y += 0.25) {
      toplam++; const v = dirsekliCozum({ x, y }) ? 1 : 0; acik += v;
      // "Is alani": avlu isinin gectigi bant.
      if (x >= 3 && x <= 8.5 && y >= 2 && y <= 7) { isToplam++; isAlani += v; }
    }
  }
  console.log(`  erisilen alan: ${acik}/${toplam} nokta (%${((acik / toplam) * 100).toFixed(0)})`
    + `  ·  is alani (R 3–8.5, kot 2–7): %${((isAlani / isToplam) * 100).toFixed(0)}`);
}
