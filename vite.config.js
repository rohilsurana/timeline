import { defineConfig } from 'vite';
import { writeFileSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  root: 'src',
  base: '/timeline/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'add-nojekyll',
      closeBundle() {
        // Add .nojekyll file to disable GitHub Pages Jekyll processing
        writeFileSync(join(__dirname, 'dist', '.nojekyll'), '');
      },
    },
  ],
});
