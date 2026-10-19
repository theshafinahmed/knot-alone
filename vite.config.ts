import { defineConfig } from 'vite';

// The game page lives in client/. The built files go to dist/client,
// and the boss server (server/index.ts) sends them to phones.
export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    // Three.js (~540 kB) + the Rapier physics engine (~4 MB, it carries its own engine inside).
    // The server squeezes it to ~1.5 MB before sending. That's fine for a game.
    chunkSizeWarningLimit: 6000,
  },
});
