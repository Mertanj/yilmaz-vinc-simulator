/**
 * Dirsekli bomun dönüşüm matematiğini doğrular — `npm run dirsekli:olc`.
 *
 * Tek soru: kinematik kolların UCU, geometri modülünün söylediği yere
 * düşüyor mu? Bu sınıf hata bu projede en pahalısı oldu (forkliftte
 * `mastBaseY` işaret hatası çatalı 12 cm yukarı koymuş ve makine paletleri
 * dövmüştü); göz kararı yakalanmıyor, ölçüm saniyede yakalıyor.
 */
import { createWorld, createGround, SIM, Snapshotter } from '../src/sim/world';
import { Truck } from '../src/sim/truck';
import { Outriggers } from '../src/sim/outriggers';
import { Dirsekli, DIRSEKLI, DIRSEKLI_NEUTRAL, type DirsekliInput } from '../src/sim/dirsekli';
import { calismaYaricapi, ucNoktasi, DIRSEKLI_SPEC as S } from '../src/sim/dirsekliGeometri';

const DT = 1 / SIM.hz;
const world = createWorld();
createGround(world);
const snaps = new Snapshotter();
const truck = new Truck(world, snaps);
const ayaklar = new Outriggers(world, truck.chassis, snaps);
const bom = new Dirsekli(world, truck.chassis, snaps);

function sur(sn: number, girdi: Partial<DirsekliInput> = {}): void {
  for (let i = 0; i < Math.round(sn / DT); i++) {
    ayaklar.update(DT);
    bom.update({ ...DIRSEKLI_NEUTRAL, ...girdi }, DT, bom.lmi);
    bom.applyToWorld(DT);
    world.step(DT, SIM.velocityIterations, SIM.positionIterations);
    bom.sampleLmi(DT);
    bom.flushJointQueue([]);
  }
}

function yaz(etiket: string): void {
  const tabla = bom.tablaWorld;
  const uc = bom.tipWorld;
  // Geometri modülü tabla merkezine göre söylüyor; dünyaya çevirip
  // kinematik gövdenin gerçek ucuyla karşılaştırıyoruz.
  const bek = ucNoktasi({ anaDeg: bom.anaAciDeg, kirmaDeg: bom.kirmaAciDeg });
  // Sasi egimini hesaba kat: geometri tabla merkezine gore soyluyor, dunyaya
  // cevirirken aracin acisiyla dondurmek gerekiyor.
  const aci = truck.chassis.getAngle();
  // Ayna makinenin degil, montajin ozelligi: burada da elle uyguluyoruz.
  // Aracin kendi donusturucusunu cagirsaydik bu olcum sadece setTransform
  // defter tutmasini dogrulardi, matematigi degil.
  const dx = bek.x * DIRSEKLI.yon;
  const dy = bek.y - S.pivotHeightM;
  const bekDunya = {
    x: tabla.x + dx * Math.cos(aci) - dy * Math.sin(aci),
    y: tabla.y + dx * Math.sin(aci) + dy * Math.cos(aci),
  };
  const sapma = Math.hypot(uc.x - bekDunya.x, uc.y - bekDunya.y);
  // Yaricap ayri bir soru: makinenin okudugu R ile saf geometrinin verdigi R
  // ayni mi? Bir kez ayrilmislardi (pivotOffset iki kez eklenmis, 35 cm) ve
  // uc dogru yerde oldugu icin SAPMA sutunu bunu goremiyordu. Kapasite
  // tablosu R'den okundugu icin sessiz bir yalan oluyordu.
  const bekR = calismaYaricapi({ anaDeg: bom.anaAciDeg, kirmaDeg: bom.kirmaAciDeg });
  const rFark = Math.abs(bom.radiusM - bekR);
  console.log(
    `${etiket.padEnd(30)} ana ${bom.anaAciDeg.toFixed(0).padStart(3)}°`
    + ` kirma ${bom.kirmaAciDeg.toFixed(0).padStart(3)}°`
    + `  uc (${uc.x.toFixed(2)}, ${uc.y.toFixed(2)})`
    + `  beklenen (${bekDunya.x.toFixed(2)}, ${bekDunya.y.toFixed(2)})`
    + `  SAPMA ${(sapma * 100).toFixed(1)} cm`
    + `  R ${bom.radiusM.toFixed(2)}/${bekR.toFixed(2)} m (${(rFark * 100).toFixed(1)} cm)`
    + `  kap ${bom.lmi.capacityTonnes.toFixed(2)} t`,
  );
  if (sapma > 0.02) process.exitCode = 1;
  if (rFark > 0.05) process.exitCode = 1;
}

yaz('yol konumu');
console.log(`sasi kutlesi ${(truck.chassis.getMass() / 1000).toFixed(2)} t`
  + `  tekerler ${(truck.wheels.reduce((t, w) => t + w.getMass(), 0) / 1000).toFixed(2)} t`
  + `  bom (elle) ${(DIRSEKLI.anaBomTon + DIRSEKLI.kirmaBomTon).toFixed(2)} t`);
// Ayaklari ac: calisma modunda bom yataktan kalkiyor, araci ayaklar tutuyor.
ayaklar.toggle();
for (let i = 0; i < 20; i++) {
  sur(0.5);
  if (i === 7) ayaklar.toggle();
  const pay = ayaklar.arkaPabucPayi;
  console.log(`  ayak t=${((i + 1) * 0.5).toFixed(1)}  aci `
    + `${((truck.chassis.getAngle() * 180) / Math.PI).toFixed(1)}°`
    + `  durum ${ayaklar.state}  pay ${pay === null ? '—' : (pay * 100).toFixed(0) + '%'}`);
}
bom.setStowed(false);
sur(1);
yaz('calisma moduna gecti');
sur(14, { ana: -1 });
yaz('ana bom indi');
sur(14, { kirma: 1 });
yaz('kirma acildi (duz bom)');
sur(10, { ana: 1 });
yaz('ana bom kalkti');
sur(10, { kirma: -1 });
yaz('kirma katlandi');
sur(6, { ana: 1, kirma: -1 });
yaz('ikisi birden');
console.log(`\nsasi egimi ${((truck.chassis.getAngle() * 180) / Math.PI).toFixed(2)}°`
  + `  pabuc payi ${ayaklar.arkaPabucPayi === null ? '—' : (ayaklar.arkaPabucPayi * 100).toFixed(0) + '%'}`);
console.log(`bom agirligi ${(DIRSEKLI.anaBomTon + DIRSEKLI.kirmaBomTon).toFixed(2)} t`);
