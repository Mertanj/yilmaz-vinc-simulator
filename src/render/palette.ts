/**
 * Vinç ve saha paleti.
 *
 * Piksel sanat yerine prosedürel vektör çiziyoruz, yani renkler doğrudan burada
 * yaşıyor ve anında değiştirilebiliyor. Klasik mobil vinç şeması: beyaz kabin,
 * amber üst yapı ve bom, koyu çelik şasi.
 */
export const C = {
  // Gövde
  cab:        0xF2F4F5,
  cabShade:   0xD4DADD,
  cabLine:    0x9AA6AC,
  frame:      0x2B343A,
  frameLight: 0x3C474E,
  frameDark:  0x1B2226,

  // Üst yapı ve bom
  amber:      0xD98A0B,
  amberLight: 0xF0A526,
  amberDark:  0xA96A06,
  boomSteel:  0xC8CFD3,

  // Detay
  tyre:       0x191E21,
  tyreLight:  0x2A3135,
  rim:        0x9AA4AA,
  glass:      0x5B7A8C,
  glassLight: 0x8FB0C2,
  chrome:     0xB9C3C9,
  hazardY:    0xF2C21A,
  hazardK:    0x16191B,

  // Saha
  sky:        0x8FA6B4,
  skyLow:     0xC3D0D6,
  ground:     0x6E7478,
  groundLine: 0x585E62,
  concrete:   0x8A9196,
  concreteD:  0x6A7176,
  wall:       0xA8AFB3,
  wallShade:  0x8D9498,
  roof:       0x4E565B,
  shadow:     0x0C1013,
  rust:       0x8A5A3C,
} as const;
