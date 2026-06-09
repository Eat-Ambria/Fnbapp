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
        ],
        skipWaiting: true,
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
