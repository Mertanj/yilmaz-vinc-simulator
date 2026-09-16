/** Halat kat sayısı: kapasite, hız ve hangi sınırın bağladığı. */
import { halatKapasitesi, capacityAt, OutriggerState, KAT_SECENEKLERI } from '../src/sim/loadChart';
import { CRANE } from '../src/sim/crane';

console.log('kat  halat kap.  kanca hızı  blok ağırlığı   K1(13.1m) sınır   K4(22.1m) sınır');
for (const k of KAT_SECENEKLERI) {
  const rope = halatKapasitesi(k);
  const hiz = CRANE.winchSpeedMps / k;
  const blok = CRANE.hookTonnesByKat[k] ?? 0;
  const f = (R: number): string => {
    const chart = capacityAt(R, OutriggerState.Full);
    const lim = Math.min(chart, rope);
    return `${lim.toFixed(2)}t (${rope < chart ? 'halat' : 'tablo'})`;
  };
  console.log(`${k}     ${rope.toFixed(2)} t     ${hiz.toFixed(2)} m/s    ${blok.toFixed(2)} t`
    + `        ${f(13.1).padEnd(16)} ${f(22.1)}`);
}
console.log('\n--- gorevler 2 katla yapilabilir mi? ---');
const gorevler: Array<[string, number, number]> = [
  ['T1 bobin', 2.3, 13.1], ['T2 CNC', 3.1, 13.1], ['T3 jenerator', 2.2, 16.1],
  ['T4 kompresor', 1.5, 19.1], ['T5 klima', 1.05, 22.1],
];
for (const [ad, ton, R] of gorevler) {
  for (const k of KAT_SECENEKLERI) {
    const brut = ton + (CRANE.hookTonnesByKat[k] ?? 0);
    const lim = Math.min(capacityAt(R, OutriggerState.Full), halatKapasitesi(k));
    const pct = (brut / lim) * 100;
    if (k === 1) process.stdout.write(`${ad.padEnd(14)}`);
    process.stdout.write(`${k}kat %${pct.toFixed(0)}${pct > 100 ? '✗' : '✓'}  `);
  }
  console.log('');
}
