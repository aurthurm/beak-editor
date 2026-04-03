import { resolve } from 'node:path';

export default defineNuxtConfig({
  css: ['~/assets/main.css'],
  vite: {
    resolve: {
      alias: {
        '@aurthurm/beakblock-core': resolve(__dirname, '../../packages/core/src'),
        '@aurthurm/beakblock-vue': resolve(__dirname, '../../packages/vue/src'),
      },
    },
  },
});
