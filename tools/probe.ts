/**
 * Forkliftin devrilme davranışı ölçüsü.
 *
 * Vinçte devrilme ayaklar yüzünden erişilemiyordu; forkliftte erişiliyor ve
 * bu dosya onun ne kadar erişilebilir olduğunu ölçüyor. Üç durum var:
 * yasal yük, aşırı yük (çatal altta) ve yüksekte taşınan yük.
 */
import { ForkliftSahnesi } from '../src/sim/forkliftSahne';
import { FORKLIFT_TASKS } from '../src/game/forkliftTasks';
import { IDLE } from '../src/sim/scene';
import { SIM } from '../src/sim/world';

const DT = 1 / SIM.hz;

function kur(spec: (typeof FORKLIFT_TASKS)[number]): {
  s: ForkliftSahnesi;
  run: (sec: number, inp?: Partial<typeof IDLE>) => void;
  yaz: (t: string) => void;
} {
  const s = new ForkliftSahnesi();
  s.spawnLoad(spec);
  const run = (sec: number, inp: Partial<typeof IDLE> = {}): void => {
    for (let i = 0; i < Math.round(sec / DT); i++) s.step({ ...IDLE, ...inp }, DT);
  };
  const yaz = (t: string): void => {
    const f = s.forklift;
    console.log(`  ${t.padEnd(26)} egim ${s.tiltDeg.toFixed(2).padStart(7)}°`
      + `  kot ${f.liftM.toFixed(2)}m  LMI %${Math.min(999, s.olcum.percent).toFixed(0).padStart(3)}`
      + `  arka aks %${(s.arkaAksPayi * 100).toFixed(0).padStart(3)}`
      + `  ${f.hasLoad ? 'yuklu' : 'bos'}`);
  };
  return { s, run, yaz };
}

/** Çatalı paletin içine sür. */
function palete(s: ForkliftSahnesi, run: (sec: number, inp?: Partial<typeof IDLE>) => void,
                hw: number): void {
  for (let i = 0; i < 400; i++) {
    const hedef = s.load.getPosition().x - hw - 0.05;
    const dx = hedef - s.forklift.forkWorld.x;
    if (Math.abs(dx) < 0.06 && s.forklift.speedKmh < 1) break;
    run(0.1, { drive: { throttle: Math.max(-1, Math.min(1, dx / 2.2)), handbrake: false } });
  }
  run(1.5, { drive: { throttle: 0, handbrake: true } });
}

// ---------------------------------------------------------------- 1) yasal yük
{
  const spec = FORKLIFT_TASKS[4];
  if (!spec) throw new Error('gorev yok');
  console.log(`--- yasal yuk: ${spec.ad} ${spec.tonnes} t ---`);
  const { s, run, yaz } = kur(spec);
  palete(s, run, spec.halfWidth);
  console.log(`  kapi: ${s.forklift.alinabilirSebep(s.grabbables).reason}`);
  s.step({ ...IDLE, toggleHook: true }, DT); run(1);
  yaz('yuk alindi');
  for (let k = 0; k < 6; k++) {
    run(2, { crane: { luff: 1, telescope: 0, winch: 0 } });
    yaz(`kaldir +${(k + 1) * 2}s`);
  }
  run(3, { drive: { throttle: 1, handbrake: false } });
  yaz('yukselken ileri');
  run(2, { drive: { throttle: 0, handbrake: true } });
  yaz('sert fren');
}

// ------------------------------------------------- 2) aşırı yük, çatal altta
{
  console.log('\n--- asiri yuk: 3.2 t, genis palet, catal altta ---');
  const { s, run, yaz } = kur({
    kod: 'X', ad: 'test', tonnes: 3.2, halfWidth: 1.1, halfHeight: 0.5,
    kind: 'tezgah', hedef: 0, brif: '',
  });
  palete(s, run, 1.1);
  console.log(`  kapi: ${s.forklift.alinabilirSebep(s.grabbables).reason}`);
  s.step({ ...IDLE, toggleHook: true }, DT); run(1);
  yaz('yuk alindi');
  let en = 0;
  for (let k = 0; k < 6; k++) {
    run(1.5, { crane: { luff: 1, telescope: -1, winch: 0 },
               drive: { throttle: 0.6, handbrake: false } });
    en = Math.max(en, s.tiltDeg);
    yaz(`kaldir+one+gaz ${((k + 1) * 1.5).toFixed(1)}s`);
  }
  console.log(`  EN BUYUK EGIM: ${en.toFixed(2)}°  (burun catalin ustunde durmali)`);
  // Kurtarma: indir ve geri git
  run(4, { crane: { luff: -1, telescope: 1, winch: 0 },
           drive: { throttle: -0.8, handbrake: false } });
  yaz('kurtarma: geri');
}

// ------------------------------------------- 3) yüksekte taşıma — asıl tuzak
{
  const spec = FORKLIFT_TASKS[3];
  if (!spec) throw new Error('gorev yok');
  console.log(`\n--- yuksekte tasima: ${spec.ad} ${spec.tonnes} t ---`);
  const { s, run, yaz } = kur(spec);
  palete(s, run, spec.halfWidth);
  s.step({ ...IDLE, toggleHook: true }, DT); run(1);
  run(7, { crane: { luff: 1, telescope: 0, winch: 0 } });
  yaz('4.5 m e kaldirildi');
  run(2.5, { drive: { throttle: 1, handbrake: false } });
  yaz('yuksekte gaz');
  run(2, { drive: { throttle: 0, handbrake: true } });
  yaz('yuksekte sert fren');
}
