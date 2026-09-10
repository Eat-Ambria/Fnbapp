import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Fnbapp/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ambria-pages',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'script' ||
              request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ambria-assets',
            },
          },
          {
            urlPattern: /ozibklsaweqizzyfwqmm\.supabase\.co\/rest\/v1\/.+\?.*select=/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'ambria-supabase-reads',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 86400,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'Ambria FnB Operations',
        short_name: 'Ambria FnB',
        description: 'Kitchen operations, attendance, dispatch and prep tracking for Ambria Cuisines',
        // Were #6B1818 / #0A0908 from the old warm-red theme. theme_color tints
        // the Android status bar and background_color paints the splash behind
        // the icon, so it matches the icon tile's own green.
        theme_color: '#1C3D2B',
        background_color: '#002010',
        display: 'standalone',
        orientation: 'any',
        scope: '/Fnbapp/',
        start_url: '/Fnbapp/',
        icons: [
          {
            src: '/Fnbapp/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/Fnbapp/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            // Separate art: Android crops maskable icons to a circle/squircle, so
            // this one is flattened onto the tile green with safe-zone padding.
            src: '/Fnbapp/icons/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
})
