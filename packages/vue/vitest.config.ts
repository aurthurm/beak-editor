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
      '@aurthurm/beakblock-core': resolve(__dirname, '../core/src'),
      '@aurthurm/beakblock-core/styles/editor.css': resolve(__dirname, '../core/src/styles/editor.css'),
      '@aurthurm/beakblock-vue': resolve(__dirname, './src'),
    },
  },
});
