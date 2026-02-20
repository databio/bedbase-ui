import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm()],
  envDir: 'env',
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@databio/gtars'],
  },
  worker: {
    plugins: () => [wasm()],
  },
});
