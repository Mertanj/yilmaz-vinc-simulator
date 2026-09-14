import { Text, type TextStyleOptions } from 'pixi.js';

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
