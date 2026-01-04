import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: '/timeline/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
