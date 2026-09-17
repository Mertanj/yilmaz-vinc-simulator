import { Container, Graphics } from 'pixi.js';
import { C } from './palette';
import { DIRSEKLI_SPEC as S } from '../sim/dirsekliGeometri';

/**
 * Dirsekli bomun kol takımı.
 *
 * **Kollar kamyon görünümünün ÇOCUĞU değil, ayrı aktörler.** Fizikte de
 * öyleler: iki kinematik gövde, her adımda `setTransform` ile sürülüyor ve
 * Snapshotter tarafından izleniyor. Çizimi doğrudan o gövdelerin ara
 * değerlerinden almak, aynı açıyı bir de görünüm tarafında yeniden hesaplamaya
 * yeğ — teleskopik bomda o ikinci hesap bir kez ters işaretle yazıldı ve bom
 * yere doğru çizildi.
 *
 * Kollar YEREL çerçevede +x yönünde çiziliyor; aynayı gövdenin kendi açısı
 * taşıyor (`Dirsekli.dunyaAcisi`), dolayısıyla burada `yon` diye bir şey yok.
 */

/** Kolon: kasanın en arkasındaki kaide. Kamyon görünümüne çocuk olarak girer. */
export function drawKolon(): Graphics {
  const g = new Graphics();
  const yuk = S.pivotHeightM - 1.81;   // kasa üstünden bom ayağına
  // Kaide: geniş taban, dara doğru incelen gövde.
  g.moveTo(-0.55, 0).lineTo(0.55, 0).lineTo(0.34, yuk).lineTo(-0.34, yuk)
    .closePath().fill(C.amberDark);
  g.moveTo(-0.34, 0).lineTo(0.06, 0).lineTo(0.06, yuk).lineTo(-0.16, yuk)
    .closePath().fill({ color: C.amber, alpha: 0.85 });
  // Taban plakası ve bağlantı cıvataları.
  g.rect(-0.62, -0.12, 1.24, 0.14).fill(C.frame);
  for (let x = -0.46; x <= 0.46; x += 0.23) {
    g.circle(x, -0.05, 0.045).fill(C.chrome);
  }
  // Bom pimi.
  g.circle(0, yuk, 0.14).fill(C.hydraulic);
  g.circle(0, yuk, 0.07).fill(C.chrome);
  return g;
}

/**
 * Bir kol — kutu kesit, uca doğru incelen.
 *
 * Merkez kolun ORTASINDA, çünkü fizik gövdesinin merkezi orada; gövdenin
 * konumunu doğrudan yazabilmek için çizimin de öyle olması gerekiyor.
 */
function drawKol(boyM: number, dipYuk: number, ucYuk: number, renk: number): Graphics {
  const g = new Graphics();
  const yari = boyM / 2;
  // Gövde: dipten uca incelen dörtgen.
  g.moveTo(-yari, -dipYuk / 2).lineTo(yari, -ucYuk / 2)
    .lineTo(yari, ucYuk / 2).lineTo(-yari, dipYuk / 2)
    .closePath().fill(renk);
  // Üst pah — ışığı yakalayan şerit.
  g.moveTo(-yari, -dipYuk / 2).lineTo(yari, -ucYuk / 2)
    .lineTo(yari, -ucYuk / 2 + ucYuk * 0.26)
    .lineTo(-yari, -dipYuk / 2 + dipYuk * 0.26)
    .closePath().fill({ color: C.amberLight, alpha: 0.55 });
  // Alt gölge.
  g.moveTo(-yari, dipYuk / 2).lineTo(yari, ucYuk / 2)
    .lineTo(yari, ucYuk / 2 - ucYuk * 0.22)
    .lineTo(-yari, dipYuk / 2 - dipYuk * 0.22)
    .closePath().fill({ color: C.amberDark, alpha: 0.8 });
  // Pimler: iki ucta.
  g.circle(-yari, 0, dipYuk * 0.30).fill(C.hydraulic);
  g.circle(-yari, 0, dipYuk * 0.15).fill(C.chrome);
  g.circle(yari, 0, ucYuk * 0.32).fill(C.hydraulic);
  return g;
}

/** Ana bom — kolonla dirsek arasında, kaldırma silindiri altında. */
export function drawAnaBom(): Container {
  const c = new Container();
  const yari = S.anaBoomM / 2;
  // Kaldırma silindiri: ayağın altından kolun ortasına.
  const sil = new Graphics();
  sil.moveTo(-yari + 0.15, 0.30).lineTo(0.35, -0.02)
    .lineTo(0.35, 0.26).lineTo(-yari + 0.15, 0.58)
    .closePath().fill(C.hydraulic);
  sil.moveTo(-yari + 0.9, 0.24).lineTo(0.30, -0.02)
    .lineTo(0.30, 0.10).lineTo(-yari + 0.9, 0.36)
    .closePath().fill(C.chrome);
  c.addChild(sil, drawKol(S.anaBoomM, 0.86, 0.62, C.amber));
  return c;
}

/** Kırma kolu — daha kısa ve ince; ucunda halat makarası. */
export function drawKirmaBom(): Container {
  const c = new Container();
  const yari = S.kirmaBoomM / 2;
  const sil = new Graphics();
  sil.moveTo(-yari + 0.10, -0.34).lineTo(0.10, -0.06)
    .lineTo(0.10, 0.16).lineTo(-yari + 0.10, -0.12)
    .closePath().fill(C.hydraulic);
  c.addChild(sil, drawKol(S.kirmaBoomM, 0.62, 0.44, C.amber));
  // Uç makarası — halatın çıktığı yer. Kancanın asıldığı nokta tam burası.
  const makara = new Graphics();
  makara.circle(yari, 0, 0.17).fill(C.hydraulic);
  makara.circle(yari, 0, 0.10).fill(C.chrome);
  c.addChild(makara);
  return c;
}
