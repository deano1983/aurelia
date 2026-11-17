import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  // VITE_SUPABASE_* live in the repo-root .env.local, shared by all eight apps.
  envDir: '../..',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cacheId: 'aurelia-00',
        // Scope / would otherwise delete every app's precache (pentest N-05).
        cleanupOutdatedCaches: false,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['apps/**'],
        navigateFallbackDenylist: [/^\/apps\//]
      },
      manifest: {
        name: 'Aurelia OS — Central Hub',
        short_name: 'Central Hub',
        description: 'Sovereign Command Suite Entry Point',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#0b1f3a',
        theme_color: '#1d4ed8',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {
      '/apps/01-daily-command-timeline': { target: 'http://localhost:5175', changeOrigin: true, rewrite: (p) => p.replace(/^\/apps\/01-daily-command-timeline/, '') || '/' },
      '/apps/02-cross-cloud-asset-vault': { target: 'http://localhost:5176', changeOrigin: true, rewrite: (p) => p.replace(/^\/apps\/02-cross-cloud-asset-vault/, '') || '/' },
      '/apps/03-voice-authority-studio': { target: 'http://localhost:5177', changeOrigin: true, rewrite: (p) => p.replace(/^\/apps\/03-voice-authority-studio/, '') || '/' },
      '/apps/04-ctl-encrypted-relay': { target: 'http://localhost:5174', changeOrigin: true, rewrite: (p) => p.replace(/^\/apps\/04-ctl-encrypted-relay/, '') || '/' },
      '/apps/05-glowgrid-creator-radar': { target: 'http://localhost:5179', changeOrigin: true, rewrite: (p) => p.replace(/^\/apps\/05-glowgrid-creator-radar/, '') || '/' },
      '/apps/06-expense-tax-invoice': { target: 'http://localhost:5180', changeOrigin: true, rewrite: (p) => p.replace(/^\/apps\/06-expense-tax-invoice/, '') || '/' },
      '/apps/07-distribution-affiliate-engine': { target: 'http://localhost:5178', changeOrigin: true, rewrite: (p) => p.replace(/^\/apps\/07-distribution-affiliate-engine/, '') || '/' },
    },
  },
})