import { resolve } from 'node:path';

export default defineNuxtConfig({
  css: ['~/assets/main.css'],
  vite: {
    resolve: {
      alias: {
        '@labbs/beakblock-core': resolve(__dirname, '../../packages/core/src'),
        '@labbs/beakblock-vue': resolve(__dirname, '../../packages/vue/src'),
      },
    },
  },
});
