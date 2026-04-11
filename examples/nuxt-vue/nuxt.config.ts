import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

// Nuxt's built-in dotenv step only loads `.env` (not `.env.local`) before this file runs.
// Load both so secrets in `.env.local` are available to runtimeConfig.
const rootDir = __dirname;
for (const name of ['.env', '.env.local']) {
  const p = resolve(rootDir, name);
  if (existsSync(p) && statSync(p).isFile()) {
    loadDotenv({ path: p, override: true });
  }
}

export default defineNuxtConfig({
  css: ['~/assets/main.css'],
  runtimeConfig: {
    openaiApiKey: process.env.NUXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
    beakblockAiModel: process.env.BEAKBLOCK_AI_MODEL || 'gpt-4.1-mini',
    beakblockAiBaseUrl: process.env.BEAKBLOCK_AI_BASE_URL || 'https://api.openai.com',
    public: {
      /** WebSocket URL for the Yjs demo (no trailing slash). `pnpm dev` starts the server on 1234. */
      collabWsUrl: process.env.NUXT_PUBLIC_COLLAB_WS_URL || 'ws://127.0.0.1:1234',
      /** Default room name for the Live collaboration sample (each tab can override in the UI). */
      collabRoom: process.env.NUXT_PUBLIC_COLLAB_ROOM || 'beakblock-nuxt-showcase',
    },
  },
  vite: {
    resolve: {
      alias: {
        '@aurthurm/beakblock-core': resolve(__dirname, '../../packages/core/src'),
        '@aurthurm/beakblock-vue': resolve(__dirname, '../../packages/vue/src'),
        // Vite 7 still analyzes `import("#app-manifest")` in nuxt’s manifest composable during
        // pre-transform; map it so import-analysis succeeds (Nuxt’s own alias runs too late).
        '#app-manifest': resolve(__dirname, 'stubs/app-manifest.mjs'),
      },
    },
  },
});
