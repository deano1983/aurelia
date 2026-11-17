import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.AURELIA_ASSEMBLE ? '/apps/03-voice-authority-studio/' : '/',
  // VITE_SUPABASE_* live in the repo-root .env.local, shared by all eight apps.
  envDir: '../..',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      manifest: {
        name: 'Voice-to-Authority Studio',
        short_name: 'Voice Studio',
        description: '90-sec voice note → 3 LinkedIn draft options',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#5b21b6',
        theme_color: '#7c3aed',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    port: 5177,
    strictPort: true,
    open: false,
  },
})
