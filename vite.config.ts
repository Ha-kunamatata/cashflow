import { defineConfig } from 'vite';

// firebase/gstatic은 URL import이므로 번들에서 제외 (런타임에 브라우저가 fetch)
export default defineConfig({
  base: '/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: {
    port: 5173,
    host: true,
  },
});
