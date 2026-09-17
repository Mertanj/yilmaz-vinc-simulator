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
  dirsekliKapasitesi, kirmaYonuDeg,
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
