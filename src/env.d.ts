/**
 * Vite'ın `import.meta.env`'i — yalnız kullandığımız alan.
 *
 * `vite/client` tiplerini bütünüyle çekmek yerine: projenin tip listesi
 * bilerek dar (`types: ["node"]`) ve tek ihtiyaç `DEV`.
 */
interface ImportMeta {
  readonly env: { readonly DEV: boolean };
}
