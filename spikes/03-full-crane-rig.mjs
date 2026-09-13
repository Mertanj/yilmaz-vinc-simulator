import pl from 'planck';
const { World, Vec2, Box, Circle, RevoluteJoint, PrismaticJoint,
        DistanceJoint, RopeJoint, WheelJoint } = pl;
const DT = 1/60, G = 9.81;
const world = new World({ x: 0, y: -G });
const ground = world.createBody();
ground.createFixture(new pl.Edge({x:-200,y:0},{x:200,y:0}), { friction: 0.9 });

const chassis = world.createDynamicBody({ x: 0, y: 1.4 });
chassis.createFixture(new Box(4.0, 0.45), { density: 700, friction: 0.7 });
chassis.setMassData({ mass: 20000, center: {x:-0.3,y:0}, I: 90000 });
const mkWheel = (dx) => { const w = world.createDynamicBody({ x: dx, y: 0.55 });
  w.createFixture(new Circle(0.55), { density: 120, friction: 1.2 });
  world.createJoint(new WheelJoint({ motorSpeed:0, maxMotorTorque:900, enableMotor:true,
    frequencyHz:4.0, dampingRatio:0.7 }, chassis, w, w.getPosition(), {x:0,y:1})); };
mkWheel(-2.6); mkWheel(2.6);

const turntable = world.createDynamicBody({ x: 0, y: 2.0 });
turntable.createFixture(new Box(0.7, 0.35), { density: 500 });
world.createJoint(new RevoluteJoint({enableMotor:true,motorSpeed:0,maxMotorTorque:4000},
  chassis, turntable, {x:0,y:2.0}));
const boomBase = world.createDynamicBody({ x: 3.0, y: 2.2 });
boomBase.createFixture(new Box(3.0, 0.25), { density: 300 });
boomBase.setMassData({ mass: 2600, center:{x:0,y:0}, I: 8000 });   // DÜZELTME: kütle oranı
world.createJoint(new RevoluteJoint({ enableMotor:true, motorSpeed:0, maxMotorTorque:3.0e6,
  enableLimit:true, lowerAngle:0, upperAngle:78*Math.PI/180 }, turntable, boomBase, {x:0.6,y:2.2}));

const boomFly = world.createDynamicBody({ x: 6.0, y: 2.2 });
boomFly.createFixture(new Box(3.0, 0.18), { density: 220 });
boomFly.setMassData({ mass: 1600, center:{x:0,y:0}, I: 4200 });     // DÜZELTME
const telescope = world.createJoint(new PrismaticJoint({ enableMotor:true, motorSpeed:0,
  maxMotorForce:4.0e5, enableLimit:true, lowerTranslation:0, upperTranslation:9 },
  boomBase, boomFly, {x:3.0,y:2.2}, {x:1,y:0}));

const hook = world.createDynamicBody({ x: 9.0, y: 0.9 });
hook.createFixture(new Box(0.25,0.25), { density:1000 });
hook.setMassData({ mass:250, center:{x:0,y:0}, I:20 });
const TIP = { x: 3.0, y: 0 };
// DÜZELTME: frequencyHz YOK -> rijit mesafe kısıtı. Halat gerçekten yükü taşır.
const cable = world.createJoint(new DistanceJoint({
  length: 4.0, collideConnected: true,
}, boomFly, hook, boomFly.getWorldPoint(TIP), hook.getWorldCenter()));

const step = (n=1)=>{for(let i=0;i<n;i++){world.step(DT,10,8);world.clearForces();}};
step(240);

console.log('=== 1. TELESKOP — tam stroka kadar ===');
telescope.setMotorSpeed(1.2); step(600);   // 10 sn
console.log('  10 sn sonra:', telescope.getJointTranslation().toFixed(3), 'm (limit 9.0)');
console.log('  limitte durdu mu:', Math.abs(telescope.getJointTranslation()-9.0)<0.1?'EVET ✓':'HAYIR ✗');
telescope.setMotorSpeed(-1.2); step(300);
console.log('  geri toplandı mı:', telescope.getJointTranslation().toFixed(2), 'm');
telescope.setMotorSpeed(0); step(120);

console.log('\n=== 2. SARKAÇ — gerçek açıdan ölçüm ===');
for (const L of [2.0, 4.0, 8.0]) {
  cable.setLength(L); step(400);
  hook.setLinearVelocity({x:1.2,y:0});
  const ang = () => { const t=boomFly.getWorldPoint(TIP), h=hook.getWorldCenter();
    return Math.atan2(h.x-t.x, t.y-h.y); };
  let prev=ang(), cr=[], t=0;
  for(let i=0;i<1800;i++){ world.step(DT,10,8); world.clearForces(); t+=DT;
    const a=ang(); if(prev<0 && a>=0) cr.push(t); prev=a; }
  const m = cr.length>=2 ? (cr[cr.length-1]-cr[0])/(cr.length-1) : NaN;
  const th = 2*Math.PI*Math.sqrt(L/G);
  console.log(`  halat ${L}m: teori ${th.toFixed(2)}s | planck ${m.toFixed(2)}s | sapma %${(Math.abs(m-th)/th*100).toFixed(1)}`);
  hook.setLinearVelocity({x:0,y:0}); step(200);
}

console.log('\n=== 3. HALAT KUVVETİ (3.2 t yük asılı) ===');
cable.setLength(4.0); step(300);
const load = world.createDynamicBody({ x: hook.getPosition().x, y: hook.getPosition().y-0.8 });
load.createFixture(new Box(0.9,0.6), { density:1000 });
load.setMassData({ mass:3200, center:{x:0,y:0}, I:900 });
world.createJoint(new RevoluteJoint({}, hook, load, hook.getWorldCenter()));
step(900);
const F=cable.getReactionForce(1/DT), Fm=Math.hypot(F.x,F.y), exp=3450*G;
console.log('  ölçülen:', (Fm/1000).toFixed(1),'kN | beklenen:', (exp/1000).toFixed(1),'kN');
console.log('  eşleşiyor mu:', Math.abs(Fm-exp)/exp<0.10?'EVET ✓':'HAYIR ✗');

console.log('\n=== 4. SALINIM SPIKE — statik LMI yalan söyler mi ===');
const tipX=boomFly.getWorldPoint(TIP).x;
let peak=0; hook.applyLinearImpulse({x:9000,y:0}, hook.getWorldCenter(), true);
for(let i=0;i<600;i++){ world.step(DT,10,8); world.clearForces();
  peak=Math.max(peak, Math.hypot(...Object.values(cable.getReactionForce(1/DT)))); }
console.log('  statik kuvvet:', (exp/1000).toFixed(1),'kN');
console.log('  salınım tepe kuvveti:', (peak/1000).toFixed(1),'kN');
console.log('  artış: %'+((peak/exp-1)*100).toFixed(0), '<- salınırken LMI bunu görmeli');
console.log('\n  yarıçap:', tipX.toFixed(2),'m');
