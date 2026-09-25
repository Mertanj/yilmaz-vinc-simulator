/**
 * Vite'ın `import.meta.env`'i — yalnız kullandığımız alan.
 *
 * `vite/client` tiplerini bütünüyle çekmek yerine: projenin tip listesi
 * bilerek dar (`types: ["node"]`) ve ihtiyaç iki alan: `DEV` ve test
 * sürümünün bayrağı (bkz. `TEST_SURUMU`).
 */
interface ImportMeta {
  readonly env: { readonly DEV: boolean; readonly VITE_TEST?: string };
}
