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
      '@amusendame/beakblock-core': resolve(__dirname, '../core/src'),
      '@amusendame/beakblock-core/styles/editor.css': resolve(__dirname, '../core/src/styles/editor.css'),
      '@amusendame/beakblock-vue': resolve(__dirname, './src'),
    },
  },
});
