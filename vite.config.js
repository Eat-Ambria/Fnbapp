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
            // V82: was StaleWhileRevalidate — that serves whatever's already in
            // the SW's OWN Cache Storage first, unconditionally, and only
            // refreshes it in the background for next time. That cache is
            // separate from the browser's HTTP cache, so a normal hard refresh
            // (Ctrl+Shift+R) does NOT bypass it — every reload could be serving
            // one-deploy-behind script/style content. NetworkFirst actually
            // prefers the network when it's reachable (this is content-hashed
            // static hosting, so a cache hit only ever helps, never masks new
            // content); the cache is still there as an offline/slow-network
            // fallback.
            urlPattern: ({ request }) =>
              request.destination === 'script' ||
              request.destination === 'style',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ambria-assets',
              networkTimeoutSeconds: 3,
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
        // V81: do NOT skipWaiting automatically — that let a freshly deployed
        // SW silently take over an already-open tab (clientsClaim) with no
        // reload, while the old JS bundle kept running and its dynamic
        // import()s targeted chunk hashes the new deploy had already deleted
        // ("Failed to fetch dynamically imported module"). A new SW now sits
        // in "waiting" until the user clicks the app's own "Update Now"
        // banner (App.jsx), which posts SKIP_WAITING and reloads in lockstep.
        clientsClaim: true,
      },
      manifest: {
        name: 'Ambria FnB Operations',
        short_name: 'Ambria FnB',
        description: 'Kitchen operations, attendance, dispatch and prep tracking for Ambria Cuisines',
        theme_color: '#6B1818',
        background_color: '#0A0908',
        display: 'standalone',
        orientation: 'any',
        scope: '/Fnbapp/',
        start_url: '/Fnbapp/',
        icons: [
          {
            src: '/Fnbapp/icons/icon-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/Fnbapp/icons/icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/Fnbapp/icons/icon-maskable-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
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
