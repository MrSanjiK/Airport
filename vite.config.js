import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    target: 'es2020',
    // CSS ships as written, logical properties included: lowered for older browsers they became `:not(:lang(...))`
    // rules that outranked the phone overrides (the hero copy sat 10vw right of the screen on phones)
    cssTarget: ['chrome107', 'edge107', 'firefox104', 'safari16'],
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
});
