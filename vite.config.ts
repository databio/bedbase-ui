import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';

// Set GTARS_LOCAL in env/.env.local to use a local gtars WASM build:
//   GTARS_LOCAL=1          → resolves to ../gtars/gtars-wasm/pkg (workspace default)
//   GTARS_LOCAL=/some/path → resolves to that absolute path
// Unset or empty → uses the published @databio/gtars npm package.

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, 'env'), '');
  const gtarsLocal = env.GTARS_LOCAL;
  const gtarsAlias: Record<string, string> = gtarsLocal
    ? {
        '@databio/gtars': path.resolve(
          __dirname,
          gtarsLocal === '1' || gtarsLocal === 'true'
            ? '../gtars/gtars-wasm/pkg'
            : gtarsLocal,
        ),
      }
    : {};

  // Allow the dev server to serve the local WASM pkg directory
  const fsAllow = gtarsAlias['@databio/gtars']
    ? [gtarsAlias['@databio/gtars']]
    : [];

  return {
    plugins: [react(), tailwindcss(), wasm()],
    envDir: 'env',
    build: {
      target: 'esnext',
    },
    resolve: {
      alias: gtarsAlias,
    },
    server: {
      fs: {
        allow: ['..', ...fsAllow],
      },
    },
    optimizeDeps: {
      exclude: ['@databio/gtars'],
    },
    worker: {
      plugins: () => [wasm()],
    },
  };
});
