import { defineConfig } from 'vite';

// The game page lives in client/. The built files go to dist/client,
// and the boss server (server/index.ts) sends them to phones.
export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    // Three.js alone is ~540 kB (~135 kB zipped). That's fine for a game.
    chunkSizeWarningLimit: 1000,
  },
});
