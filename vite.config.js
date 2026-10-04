import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Fnbapp/',
  plugins: [
    react(),
    VitePWA({
      // V92: switched from generateSW to injectManifest so the service worker
      // can carry a `push` handler (web push notifications) — generateSW only
      // lets you configure routing/caching, there's no hook for custom event
      // listeners. src/sw.js hand-writes the same routing/caching rules this
      // used to get for free from a `workbox: {...}` block here, plus the push
      // handler. The update-gating behavior (no auto skipWaiting — see
      // src/sw.js) is unchanged.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
