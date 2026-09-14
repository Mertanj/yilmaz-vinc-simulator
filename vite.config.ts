import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub proje sayfaları -> '/yilmaz-vinc-simulator/'
  // Kök alan adı / Cloudflare -> '/'
  // Tek repo iki hosta doğru deploy olsun diye env değişkeni.
  base: process.env.VITE_BASE ?? '/',
  build: { target: 'es2022', sourcemap: false },
});
