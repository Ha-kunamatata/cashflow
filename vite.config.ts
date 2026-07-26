import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: false,
    rollupOptions: {
      output: {
        // firebase SDK를 별도 청크로 분리 — 앱 코드 변경 시에도 캐시가 유지되고,
        // 번들 리포트에서 앱 코드 크기를 firebase SDK 크기와 분리해 확인 가능
        manualChunks: (id: string) =>
          id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')
            ? 'firebase'
            : undefined,
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
