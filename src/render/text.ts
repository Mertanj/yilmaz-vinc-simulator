import { Container, Text, type TextStyleOptions } from 'pixi.js';

/** Metni büyük punto çizip dünya ölçeğine küçültüyoruz; doğrudan 0.4 punto ile
 *  çizip 34 kat büyütmek bulanık çıkıyor. scale.y negatif çünkü dünya katmanı
 *  y eksenini ters çeviriyor. */
const BASE = 96;

export function worldText(
  content: string,
  heightM: number,
  style: Partial<TextStyleOptions> = {},
): Text {
  const t = new Text({
    text: content,
    style: {
      fontFamily: 'Barlow Condensed, Impact, sans-serif',
      fontSize: BASE,
      fontWeight: '700',
      fill: 0xffffff,
      ...style,
    },
  });
  const k = heightM / BASE;
  t.scale.set(k, -k);
  t.anchor.set(0.5, 0.5);
  return t;
}

/**
 * Bir çizimi ve üstüne binecek çocukları tek kapta toplar.
 *
 * `Graphics.addChild` PixiJS 8'de kullanımdan kalkıyor — *"Only Containers
 * will be allowed to add children in v8.0.0"* — ve her sahne kurulumunda
 * konsola bir kullanımdan kalkma uyarısı düşüyordu (üç makinede de). Bugün
 * çalışıyor, yarın çalışmayacak: bir gün Pixi güncellendiğinde kamyonun
 * yazısı, forkliftin logosu ve zeminin adres stensilleri sessizce
 * kaybolurdu.
 *
 * Çözüm çizime çocuk eklememek: çizim ve üstündekiler bir kabın içinde
 * kardeş oluyorlar. Sıra aynı, sonuç aynı, uyarı yok.
 */
export function kapla(g: Container, ...cocuklar: Container[]): Container {
  const c = new Container();
  c.addChild(g, ...cocuklar);
  return c;
}
