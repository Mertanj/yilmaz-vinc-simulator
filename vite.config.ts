import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub proje sayfaları -> '/yilmaz-vinc-simulator/'
  // Kök alan adı / Cloudflare -> '/'
  // Tek repo iki hosta doğru deploy olsun diye env değişkeni.
  base: process.env.VITE_BASE ?? '/',
  build: {
    target: 'es2022',
    sourcemap: false,
    // VITE_SINGLE=1 tek dosyalık çıktı üretir. Artifact gibi göreli yoldan
    // servis edilen ortamlarda dinamik import parça yollarıyla uğraşmamak için.
    rollupOptions: process.env.VITE_SINGLE
      ? { output: { inlineDynamicImports: true } }
      : {},
  },
});
