import { defineConfig } from 'vitest/config';
import path from 'path';
import { stageValidatorPlugin } from './vite.config.mts';

export default defineConfig({
  plugins: [stageValidatorPlugin],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/test/**',
        '**/*.config.{ts,js}',
        'src/electron.ts',
        'src/preload.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
