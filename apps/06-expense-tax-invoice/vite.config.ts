import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.AURELIA_ASSEMBLE ? '/apps/06-expense-tax-invoice/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      manifest: {
        name: 'Expense & Tax Invoice',
        short_name: 'Tax Invoice',
        description: 'Australian Tax Invoice, ABN, finance approval memo',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#78350f',
        theme_color: '#d97706',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    port: 5180,
    strictPort: true,
    open: false,
  },
})