/**
 * Vinç ve saha paleti.
 *
 * **Renkler gerçek araçtan alındı.** Firma kendi kamyonunun fotoğraflarını
 * gönderdi; önceki palet (beyaz kabin + amber üst yapı) sektör ortalamasına
 * göre tahmindi ve yanlıştı. Gerçek araç: sarı Mercedes kabin, sarı Hidrokon
 * vinç, krem-sarı ahşap yanaklı kasa, kırmızı yazı, koyu hidrolik silindirler.
 */
export const C = {
  // Kabin ve gövde — gerçek araç sarısı
  cab:        0xE3B015,
  cabShade:   0xB98C0C,
  cabLight:   0xF2CA4A,
  cabLine:    0x8A6A08,

  // Kasa (flatbed) — güneşte solmuş krem-sarı
  deck:       0xD3C384,
  deckShade:  0xB0A165,
  deckLine:   0x8A7C4A,

  // Şasi
  frame:      0x2B303A,
  frameLight: 0x3E4550,
  frameDark:  0x171B21,

  // Vinç — Hidrokon sarısı, biraz daha parlak
  amber:      0xF0C21A,
  amberLight: 0xFFDC5C,
  amberDark:  0xB8900C,
  // Hidrolik silindirler ve bağlantılar koyu — fotoğrafta belirgin
  hydraulic:  0x24272E,
  hydraulicL: 0x3A3F49,

  // Giydirme
  liveryRed:  0xD01E22,
  flagRed:    0xE30A17,

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
