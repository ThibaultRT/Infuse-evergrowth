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
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
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
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}', 'assets/**/*'],
        // Vite PWA otherwise assumes everything under assets/ has a hashed name.
        dontCacheBustURLsMatching: /^assets\/[^/]+-[\w-]{8}\.(?:js|css|svg)$/,
        // This is a revision inventory, not a request to precache the entire payload.
        // src/sw.ts separates lazy assets from the app shell before precacheAndRoute.
        maximumFileSizeToCacheInBytes: 500 * 1024 * 1024,
      }
    })
  ]
});
