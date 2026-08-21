import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const repoBase = '/Infuse-evergrowth/';

export default defineConfig({
  base: repoBase,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Infuse: Evergrowth',
        short_name: 'Evergrowth',
        description: 'An active incremental RPG about absorbing power and growing without limits.',
        theme_color: '#111823',
        background_color: '#111823',
        display: 'standalone',
        orientation: 'portrait',
        start_url: repoBase,
        scope: repoBase,
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}']
      }
    })
  ]
});
