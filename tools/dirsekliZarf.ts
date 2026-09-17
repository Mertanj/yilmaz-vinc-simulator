/**
 * Dirsekli bomun çalışma zarfını ölçer — `npm run zarf`.
 *
 * Bölüm tasarımı bu sayılara bağlı: makine hangi duvarı aşabiliyor, aştıktan
 * sonra ne kadar uzağa ne kadar yük koyabiliyor. Bu projede her karar ölçümle
 * alındı; "aynı ucu farklı katlanmayla tutturmak bir karar olur" hipotezi de
 * tam burada çürüdü — kırma tek yönlü olduğu için aynı noktanın pratikte tek
 * çözümü var, asıl karar erişim–kapasite takası.
 */
import {
  DIRSEKLI_SPEC as S, dirsekNoktasi, ucNoktasi, calismaYaricapi,
  dirsekliKapasitesi, kirmaYonuDeg, dirsekliCozum,
} from '../src/sim/dirsekliGeometri';

// --- 1) uc nereye kadar gidiyor? ---
let enUzak = { r: 0, ana: 0, kirma: 0, y: 0 };
let enYuksek = { y: 0, ana: 0, kirma: 0, r: 0 };
for (let a = S.anaMinDeg; a <= S.anaMaxDeg; a += 1) {
  for (let k = S.kirmaMinDeg; k <= S.kirmaMaxDeg; k += 1) {
    const u = ucNoktasi({ anaDeg: a, kirmaDeg: k });
    if (u.x > enUzak.r) enUzak = { r: u.x, ana: a, kirma: k, y: u.y };
    if (u.y > enYuksek.y) enYuksek = { y: u.y, ana: a, kirma: k, r: u.x };
  }
}
console.log(`en uzak uc   R ${enUzak.r.toFixed(2)} m  y ${enUzak.y.toFixed(2)} m`
  + `  (ana ${enUzak.ana}° kirma ${enUzak.kirma}°)  kapasite ${dirsekliKapasitesi(enUzak.r).toFixed(2)} t`);
console.log(`en yuksek uc y ${enYuksek.y.toFixed(2)} m  R ${enYuksek.r.toFixed(2)} m`
  + `  (ana ${enYuksek.ana}° kirma ${enYuksek.kirma}°)`);

// --- 2) duvarin ustunden asabiliyor mu? ---
// Duvar: tabla merkezinden DUVAR_X metre otede, DUVAR_Y metre yuksek.
// Hedef: duvarin arkasinda, ucun HEDEF_Y kotunda durmasi gerekiyor ki
// halatla asagi inilebilsin.
function dogruParcasiGecer(
  a: { x: number; y: number }, b: { x: number; y: number }, duvarX: number, duvarY: number,
): boolean {
  // Duvar x=duvarX'te, 0..duvarY arasi dolu. Parca o dikeyi duvarY'nin
  // ALTINDA kesiyorsa carpiyor.
  if ((a.x - duvarX) * (b.x - duvarX) > 0) return true;   // duvari hic kesmiyor
  const t = (duvarX - a.x) / (b.x - a.x);
  return a.y + t * (b.y - a.y) > duvarY;
}

const duvarlar: Array<[number, number]> = [[4.5, 4.0], [5.0, 4.5], [5.5, 5.0], [4.0, 5.5]];
for (const [duvarX, duvarY] of duvarlar) {
  const cozumler: Array<{ ana: number; kirma: number; r: number; y: number; kap: number }> = [];
  for (let a = S.anaMinDeg; a <= S.anaMaxDeg; a += 1) {
    for (let k = S.kirmaMinDeg; k <= S.kirmaMaxDeg; k += 1) {
      const d = { anaDeg: a, kirmaDeg: k };
      const dirsek = dirsekNoktasi(d);
      const u = ucNoktasi(d);
      if (u.x < duvarX + 1.0 || u.x > S.maxYaricapM) continue;      // duvarin arkasinda
      if (u.y < 2.2 || u.y > 7.5) continue;                          // halat icin makul kot
      const ayak = { x: S.pivotOffsetM, y: S.pivotHeightM };
      if (!dogruParcasiGecer(ayak, dirsek, duvarX, duvarY)) continue;  // ana bom duvara carpiyor
      if (!dogruParcasiGecer(dirsek, u, duvarX, duvarY)) continue;     // kirma duvara carpiyor
      cozumler.push({ ana: a, kirma: k, r: u.x, y: u.y, kap: dirsekliKapasitesi(u.x) });
    }
  }
  const enIyi = cozumler.slice().sort((p, q) => q.kap - p.kap)[0];
  const enUzakCoz = cozumler.slice().sort((p, q) => q.r - p.r)[0];
  console.log(
    `\nduvar x=${duvarX} y=${duvarY}:  ${cozumler.length} cozum`
    + (enIyi
      ? `\n  en cok kapasite: ana ${enIyi.ana}° kirma ${enIyi.kirma}° -> R ${enIyi.r.toFixed(2)} m`
        + ` uc ${enIyi.y.toFixed(2)} m  kapasite ${enIyi.kap.toFixed(2)} t`
        + `\n  en uzak:         ana ${enUzakCoz!.ana}° kirma ${enUzakCoz!.kirma}° -> R ${enUzakCoz!.r.toFixed(2)} m`
        + ` uc ${enUzakCoz!.y.toFixed(2)} m  kapasite ${enUzakCoz!.kap.toFixed(2)} t`
      : '  — hicbir konfigurasyon duvari asamiyor'),
  );
}

// --- 3) ayni ucu farkli katlanmayla tutturmak: karar var mi? ---
console.log('\nayni uc noktasini veren farkli konfigurasyonlar (uc ~ 6.5, 3.0):');
for (let a = S.anaMinDeg; a <= S.anaMaxDeg; a += 1) {
  for (let k = S.kirmaMinDeg; k <= S.kirmaMaxDeg; k += 1) {
    const d = { anaDeg: a, kirmaDeg: k };
    const u = ucNoktasi(d);
    if (Math.abs(u.x - 6.5) < 0.08 && Math.abs(u.y - 3.0) < 0.08) {
      const dir = dirsekNoktasi(d);
      console.log(`  ana ${String(a).padStart(3)}° kirma ${String(k).padStart(3)}°`
        + `  dirsek (${dir.x.toFixed(2)}, ${dir.y.toFixed(2)})`
        + `  kirma yonu ${kirmaYonuDeg(d).toFixed(0)}°`
        + `  R ${calismaYaricapi(d).toFixed(2)} m`);
    }
  }
}

// --- 4) erisim tablosu: her yariciapta uc ne kadar yukari/asagi gidiyor? ---
//
// Bolum tasarimi dogrudan buna bakiyor: bir hedefi "R su kadar, kot bu kadar"
// diye koymadan once ucun oraya YETIP yetmedigini bilmek gerekiyor. Gozle
// kestirilmiyor, cunku iki eklemin birlesik zarfi disbukey degil.
console.log('\nerisim tablosu (tabla merkezine gore):');
console.log('   R     uc en yuksek   uc en alcak   kapasite');
for (let r = 2; r <= 9; r += 0.5) {
  let yuksek = -99; let alcak = 99;
  for (let a = S.anaMinDeg; a <= S.anaMaxDeg; a += 0.5) {
    for (let k = S.kirmaMinDeg; k <= S.kirmaMaxDeg; k += 0.5) {
      const u = ucNoktasi({ anaDeg: a, kirmaDeg: k });
      if (Math.abs(u.x - r) > 0.1) continue;
      if (u.y > yuksek) yuksek = u.y;
      if (u.y < alcak) alcak = u.y;
    }
  }
  if (yuksek < -90) { console.log(`  ${r.toFixed(1)}   — erisilmiyor`); continue; }
  console.log(`  ${r.toFixed(1)}      ${yuksek.toFixed(2)} m        ${alcak.toFixed(2)} m`
    + `      ${dirsekliKapasitesi(r).toFixed(2)} t`);
}

// --- 5) yuk duvari GERCEKTEN asabiliyor mu? ---
//
// Bolum 3'teki denetim yalnizca BOMUN duvari siyirdigini soyluyordu. Oysa
// duvara takilan sey bom degil, halattan sarkan YUK: uc duvarin ustunden
// gecerken yukun ALT yuzu de duvarin ustunde olmali. Yuk yuksekligi ve halat
// payi buraya giriyor.
function yukGecebilirMi(duvarX: number, duvarY: number, yukBoyM: number, halatM: number): {
  olur: boolean; gerekenUc: number; enYuksekUc: number;
} {
  const gereken = duvarY + halatM + yukBoyM;
  let enYuksek = -99;
  for (let a = S.anaMinDeg; a <= S.anaMaxDeg; a += 0.5) {
    for (let k = S.kirmaMinDeg; k <= S.kirmaMaxDeg; k += 0.5) {
      const d = { anaDeg: a, kirmaDeg: k };
      const u = ucNoktasi(d);
      if (Math.abs(u.x - duvarX) > 0.15) continue;
      const dirsek = dirsekNoktasi(d);
      const ayak = { x: S.pivotOffsetM, y: S.pivotHeightM };
      if (!dogruParcasiGecer(ayak, dirsek, duvarX, duvarY)) continue;
      if (!dogruParcasiGecer(dirsek, u, duvarX, duvarY)) continue;
      if (u.y > enYuksek) enYuksek = u.y;
    }
  }
  return { olur: enYuksek >= gereken, gerekenUc: gereken, enYuksekUc: enYuksek };
}

console.log('\nyuk duvarin ustunden gecebiliyor mu? (yuk boyu 1.4 m, halat 0.6 m)');
for (const [duvarX, duvarY] of duvarlar) {
  const s = yukGecebilirMi(duvarX, duvarY, 1.4, 0.6);
  console.log(`  duvar x=${duvarX} y=${duvarY}: uc ${s.gerekenUc.toFixed(2)} m gerekiyor,`
    + ` en fazla ${s.enYuksekUc.toFixed(2)} m  ->  ${s.olur ? 'GECER' : 'GECMEZ'}`);
}

// --- 6) ters kinematik gidis-donus: cozum gercekten o noktaya gotururuyor mu? ---
//
// Rig ve otopilot bu fonksiyona guveniyor. Yanlis kok secilirse (dirsek yukari)
// uc hedefin AYNASINA gider ve hata ancak oyun icinde, "vinc ters tarafa
// gidiyor" diye fark edilir. Gidis-donus testi bunu burada yakaliyor.
{
  let denenen = 0; let cozulen = 0; let enKotu = 0; let kotuNokta = { x: 0, y: 0 };
  for (let x = 1.5; x <= 8.8; x += 0.25) {
    for (let y = -1.5; y <= 10.5; y += 0.25) {
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
  if (enKotu > 0.001) { console.log('  HATA: ters kinematik tutarsiz'); process.exitCode = 1; }
}

// --- 7) zarfin ICI: harita ---
//
// 1. ve 4. bolumler yalnizca SINIRLARI olcuyordu (en uzak, en yuksek, her
// yaricapta en alt/en ust) ve bu yanilticiydi: iki kollu bir zincirin zarfi
// disbukey degil, ortasinda DELIK olabiliyor. Bolum tasarimi "R 4.5'te uc
// 10.18 m'ye cikiyor" satirina bakip yuku duvarin ustunden gecirmeyi
// planladi; oysa ayni yaricapta 6 metre kotu HIC erisilmiyordu. Delik ancak
// haritasi cizilince gorundu.
{
  console.log('\nzarf haritasi (# erisilir, · erisilmez) — dikey 0.5 m, yatay 0.5 m:');
  const satirlar: string[] = [];
  for (let y = 11; y >= -2; y -= 0.5) {
    let satir = `${y.toFixed(1).padStart(5)} `;
    for (let x = 1; x <= 9; x += 0.5) {
      satir += dirsekliCozum({ x, y }) ? '#' : '·';
    }
    satirlar.push(satir);
  }
  console.log(satirlar.join('\n'));
  console.log('      ' + Array.from({ length: 17 }, (_, i) => (1 + i * 0.5) % 1 === 0
    ? String((1 + i * 0.5) % 10) : ' ').join(''));
  let acik = 0; let toplam = 0;
  for (let x = 1; x <= 9; x += 0.25) {
    for (let y = -2; y <= 11; y += 0.25) { toplam++; if (dirsekliCozum({ x, y })) acik++; }
  }
  console.log(`  erisilen alan: ${acik}/${toplam} nokta (%${((acik / toplam) * 100).toFixed(0)})`);
}
