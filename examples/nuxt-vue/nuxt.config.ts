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

/** Same repo slug as `examples/next-app` for GitHub project pages. */
const GITHUB_PAGES_BASE = '/beakblock/';
const isGitHubPages = process.env.GITHUB_PAGES === 'true';
/** Workspace packages aliased to their TypeScript sources (core + vue are the 1.x packages). */
const BEAKBLOCK_PACKAGES = [
  'core',
  'vue',
  'ai',
  'blocks-clinical',
  'blocks-office',
  'blocks-qms',
  'commands',
  'export-docx',
  'import-docx',
  'ir',
  'layout',
  'permissions',
  'review',
  'schema',
  'templates',
] as const;

const defaultCollabWsUrl = process.env.NODE_ENV === 'production' ? '' : 'ws://127.0.0.1:1234';

export default defineNuxtConfig({
  app: {
    baseURL: isGitHubPages ? GITHUB_PAGES_BASE : '/',
  },
  css: ['~/assets/main.css', '~/assets/v2.css'],
  runtimeConfig: {
    openaiApiKey: process.env.NUXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
    beakblockAiModel: process.env.BEAKBLOCK_AI_MODEL || 'gpt-4.1-mini',
    beakblockAiBaseUrl: process.env.BEAKBLOCK_AI_BASE_URL || 'https://api.openai.com',
    public: {
      /** WebSocket URL for the Yjs demo (no trailing slash). `pnpm dev` starts the server on 1234. */
      collabWsUrl: process.env.NUXT_PUBLIC_COLLAB_WS_URL || defaultCollabWsUrl,
      /** Default room name for the Live collaboration sample (each tab can override in the UI). */
      collabRoom: process.env.NUXT_PUBLIC_COLLAB_ROOM || 'beakblock-nuxt-showcase',
    },
  },
  vite: {
    resolve: {
      alias: {
        // Source aliases so the example always runs against the workspace packages.
        // BeakBlock 2.0 packages are included so the v2 scenarios resolve to src as well.
        ...Object.fromEntries(
          BEAKBLOCK_PACKAGES.map((name) => [
            `@amusendame/beakblock-${name}`,
            resolve(__dirname, `../../packages/${name}/src`),
          ])
        ),
        // Vite 7 still analyzes `import("#app-manifest")` in nuxt’s manifest composable during
        // pre-transform; map it so import-analysis succeeds (Nuxt’s own alias runs too late).
        '#app-manifest': resolve(__dirname, 'stubs/app-manifest.mjs'),
      },
    },
  },
});
