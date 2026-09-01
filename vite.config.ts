import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import packageInfo from './package.json' with { type: 'json' };

const repoBase = '/Infuse-evergrowth/';

export default defineConfig({
  base: repoBase,
  plugins: [
    {
      name: 'published-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: packageInfo.version }) });
      }
    },
    VitePWA({
      injectRegister: false,
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
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        runtimeCaching: [{
          urlPattern: /\/assets\/quaternius\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'quaternius-assets-v1',
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] }
          }
        }]
      }
    })
  ]
});
