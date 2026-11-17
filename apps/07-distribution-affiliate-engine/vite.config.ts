import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.AURELIA_ASSEMBLE ? '/apps/07-distribution-affiliate-engine/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      manifest: {
        name: 'Distribution Affiliate Engine',
        short_name: 'Affiliate Engine',
        description: '30–35% recurring, partner pitches, 2-tap close',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#312e81',
        theme_color: '#4f46e5',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    port: 5178,
    strictPort: true,
    open: false,
  },
})
