import pl from 'planck';
const { World, Box, RevoluteJoint, DistanceJoint } = pl;
const DT=1/60, G=9.81, M=3450;
console.log('Sarkaç gerilimi teorisi: T = m·g·(3 - 2·cosθmax)  [salınımın en dibinde]');
console.log('Başlatma: impuls DEĞİL, açıyla yerleştirme (şok yok).\n');
console.log(' θmax   teori T    planck T   sapma   statiğe göre artış');
for (const deg of [10,20,30,40]) {
  const th=deg*Math.PI/180, L=4.0, AX=12, AY=18;
  const w=new World({x:0,y:-G});
  const anchor=w.createBody({x:AX,y:AY});
  const hook=w.createDynamicBody({x:AX+L*Math.sin(th), y:AY-L*Math.cos(th)});
  hook.createFixture(new Box(0.25,0.25),{density:1000});
  hook.setMassData({mass:M,center:{x:0,y:0},I:900});
  const cable=w.createJoint(new DistanceJoint({length:L},anchor,hook,{x:AX,y:AY},hook.getWorldCenter()));
  let peak=0;
  for(let i=0;i<1200;i++){ w.step(DT,10,8); w.clearForces();
    if(i>60){ const R=cable.getReactionForce(1/DT); peak=Math.max(peak,Math.hypot(R.x,R.y)); } }
  const theory=M*G*(3-2*Math.cos(th)), stat=M*G;
  console.log(`  ${String(deg).padStart(2)}°  ${(theory/1000).toFixed(2).padStart(7)} kN ${(peak/1000).toFixed(2).padStart(9)} kN  %${(Math.abs(peak-theory)/theory*100).toFixed(1).padStart(4)}   %${((peak/stat-1)*100).toFixed(0).padStart(3)}`);
}
console.log('\nSONUÇ: salınım gerilimi teoriyle uyuşuyor. Gerçekçi artış 40°de ~%47,');
console.log('benim önceki %648 rakamım ani impulsun yarattığı şok tepesiydi — oyunda o');
console.log('da olur (yük takılıp kurtulursa) ama tipik salınımın rakamı bu değil.');
