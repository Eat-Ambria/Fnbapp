import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Fnbapp/',
  plugins: [
    react(),
    VitePWA({
      // V96 — ripped out ALL caching/offline support after a dormant stale
      // service worker left staff genuinely unable to log in (an old SW kept
      // serving a pre-Supabase-Auth bundle indefinitely; worse, uninstalling
      // and reinstalling the home-screen icon did NOT clear it, since that
      // storage lives in the browser profile, not the shortcut — only an
      // explicit "clear site data" did). That trade-off is deliberate:
      // staff would rather the app simply not load without internet than
      // silently run stale code against a backend that's moved on. Still on
      // injectManifest (not generateSW) ONLY because push notifications need
      // a custom `push` handler, which generateSW has no hook for —
      // `injectionPoint: undefined` below means no precache manifest is
      // even generated, so there's nothing for injectManifest to inject.
      // src/sw.js has no `fetch` listener at all now: every request, cached
      // or not, hard refresh or not, always goes straight to the network.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        injectionPoint: undefined,
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
