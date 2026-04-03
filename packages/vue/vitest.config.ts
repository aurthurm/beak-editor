import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@labbs/beakblock-core': resolve(__dirname, '../core/src'),
      '@labbs/beakblock-core/styles/editor.css': resolve(__dirname, '../core/src/styles/editor.css'),
      '@labbs/beakblock-vue': resolve(__dirname, './src'),
    },
  },
});
