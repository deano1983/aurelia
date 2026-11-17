import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.AURELIA_ASSEMBLE ? '/apps/05-glowgrid-creator-radar/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      manifest: {
        name: 'GlowGrid Creator Radar',
        short_name: 'GlowGrid',
        description: 'Streak tracking, AUD rate-card calculator',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#831843',
        theme_color: '#ec4899',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    port: 5179,
    strictPort: true,
    open: false,
  },
})