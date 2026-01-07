import { defineConfig } from 'vite';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'src',
  base: '/timeline/',
  publicDir: '../public',
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
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Timeline Viewer',
        short_name: 'Timeline',
        description: 'Visualize and explore your location history with an interactive timeline on a map',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        scope: '/timeline/',
        start_url: '/timeline/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
});
