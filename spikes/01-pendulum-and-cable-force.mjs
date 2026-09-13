import pl from 'planck';
const { World, Box, RevoluteJoint, DistanceJoint } = pl;
const DT=1/60, G=9.81;

// ---------- A: İZOLE SARKAÇ (sabit ankraj) — teori doğrulaması ----------
console.log('=== A. İZOLE SARKAÇ: rijit DistanceJoint ===');
for (const L of [2.0,4.0,8.0]) {
  const w=new World({x:0,y:-G});
  const anchor=w.createBody({x:0,y:30});
  const bob=w.createDynamicBody({x:0,y:30-L});
  bob.createFixture(new Box(0.3,0.3),{density:1000});
  bob.setMassData({mass:3450,center:{x:0,y:0},I:1200});
  w.createJoint(new DistanceJoint({length:L},anchor,bob,{x:0,y:30},bob.getWorldCenter()));
  // küçük açıyla başlat (küçük salınım varsayımı geçerli kalsın)
  bob.setTransform({x:L*Math.sin(0.15), y:30-L*Math.cos(0.15)}, 0);
  const ang=()=>Math.atan2(bob.getWorldCenter().x-0, 30-bob.getWorldCenter().y);
  let prev=ang(), cr=[], t=0;
  for(let i=0;i<3000;i++){ w.step(DT,10,8); w.clearForces(); t+=DT;
    const a=ang(); if(prev<0&&a>=0) cr.push(t); prev=a; }
  const m=cr.length>=2?(cr[cr.length-1]-cr[0])/(cr.length-1):NaN;
  const th=2*Math.PI*Math.sqrt(L/G);
  console.log(`  L=${L}m: teori ${th.toFixed(3)}s | planck ${m.toFixed(3)}s | sapma %${(Math.abs(m-th)/th*100).toFixed(2)}  ${Math.abs(m-th)/th<0.03?'✓':'✗'}`);
}

// ---------- B: HALAT KUVVETİ, yük serbest asılı ----------
console.log('\n=== B. HALAT KUVVETİ (yük yerden serbest) ===');
{
  const w=new World({x:0,y:-G});
  w.createBody().createFixture(new pl.Edge({x:-100,y:0},{x:100,y:0}),{friction:0.9});
  const anchor=w.createBody({x:12,y:18});           // bom ucu yüksekliği
  const hook=w.createDynamicBody({x:12,y:14});
  hook.createFixture(new Box(0.25,0.25),{density:1000});
  hook.setMassData({mass:250,center:{x:0,y:0},I:20});
  const cable=w.createJoint(new DistanceJoint({length:4.0},anchor,hook,{x:12,y:18},hook.getWorldCenter()));
  const load=w.createDynamicBody({x:12,y:13.2});
  load.createFixture(new Box(0.9,0.6),{density:1000});
  load.setMassData({mass:3200,center:{x:0,y:0},I:900});
  w.createJoint(new RevoluteJoint({},hook,load,hook.getWorldCenter()));
  for(let i=0;i<1200;i++){ w.step(DT,10,8); w.clearForces(); }
  const F=cable.getReactionForce(1/DT), Fm=Math.hypot(F.x,F.y), exp=3450*G;
  console.log('  yük yüksekliği:', load.getWorldCenter().y.toFixed(2),'m (serbest mi:', load.getWorldCenter().y>1?'EVET ✓':'HAYIR ✗',')');
  console.log('  ölçülen:',(Fm/1000).toFixed(2),'kN | beklenen:',(exp/1000).toFixed(2),'kN | sapma %'+(Math.abs(Fm-exp)/exp*100).toFixed(2));
  console.log('  eşleşiyor mu:', Math.abs(Fm-exp)/exp<0.02?'EVET ✓':'HAYIR ✗');

  // salınım tepe kuvveti
  console.log('\n=== C. SALINIM SPIKE: statik LMI neden yalan söyler ===');
  hook.applyLinearImpulse({x:12000,y:0},hook.getWorldCenter(),true);
  let peak=0, maxAng=0;
  for(let i=0;i<900;i++){ w.step(DT,10,8); w.clearForces();
    const R=cable.getReactionForce(1/DT); peak=Math.max(peak,Math.hypot(R.x,R.y));
    maxAng=Math.max(maxAng,Math.abs(Math.atan2(hook.getWorldCenter().x-12,18-hook.getWorldCenter().y))); }
  console.log('  maks salınım açısı: '+(maxAng*180/Math.PI).toFixed(1)+'°');
  console.log('  statik: '+(exp/1000).toFixed(1)+' kN | salınım tepesi: '+(peak/1000).toFixed(1)+' kN | artış %'+((peak/exp-1)*100).toFixed(0));
  console.log('  -> LMI statik yükten değil, ANLIK halat kuvvetinden okunmalı.');
}
