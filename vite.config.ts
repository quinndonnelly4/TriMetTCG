import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createStreetcarMiddleware } from './server/streetcar-proxy';
import { createTrimetMiddleware, trimetAppId } from './server/trimet-proxy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appId = trimetAppId(env);

  return {
    plugins: [
      react(),
      {
        name: 'trimet-key-proxy',
        configureServer(server) {
          server.middlewares.use(createTrimetMiddleware(appId));
          server.middlewares.use(createStreetcarMiddleware());
        },
        configurePreviewServer(server) {
          server.middlewares.use(createTrimetMiddleware(appId));
          server.middlewares.use(createStreetcarMiddleware());
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        workbox: {
          navigateFallbackDenylist: [/^\/api\//, /^\/\.netlify\/functions\//],
          runtimeCaching: [
            {
              urlPattern: /\/api\/trimet(?:\/|$)/,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /\/api\/streetcar(?:\/|$)/,
              handler: 'NetworkOnly',
            },
          ],
        },
        manifest: {
          name: 'TriMet TCG',
          short_name: 'TriMet TCG',
          description: 'Log Portland buses and trains. Unlock cards.',
        theme_color: '#0055a4',
        background_color: '#f3f5f8',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
      }),
    ],
  };
});
