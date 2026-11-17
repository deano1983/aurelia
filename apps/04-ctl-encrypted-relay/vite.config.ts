import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.AURELIA_ASSEMBLE ? '/apps/04-ctl-encrypted-relay/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      manifest: {
        name: 'C.T.L. Encrypted Relay',
        short_name: 'CTL Relay',
        description: 'AES-256-GCM interoffice approval, #ctl= deep links',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#064e3b',
        theme_color: '#10b981',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    port: 5174,
    strictPort: true,
    open: false,
  },
})