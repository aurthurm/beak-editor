import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [vue()],
  base: process.env.GITHUB_PAGES ? '/beakblock/' : '/',
  resolve: {
    alias: {
      '@aurthurm/beakblock-core': resolve(__dirname, '../../packages/core/src'),
      '@aurthurm/beakblock-vue': resolve(__dirname, '../../packages/vue/src'),
    },
  },
});
