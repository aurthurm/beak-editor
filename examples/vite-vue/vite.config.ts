import { defineConfig, loadEnv, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { runOpenAICompletion } from '../shared/ai';

function beakBlockAIPlugin(env: Record<string, string>): Plugin {
  const handler = async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => {
    if (req.url !== '/api/ai') {
      next();
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
      }
      const request = JSON.parse(raw);
      const output = await runOpenAICompletion(request, env);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ output }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'AI request failed' }));
    }
  };

  return {
    name: 'beakblock-ai-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    plugins: [vue(), beakBlockAIPlugin(env)],
    base: process.env.GITHUB_PAGES ? '/beakblock/' : '/',
    resolve: {
      alias: {
        '@amusendame/beakblock-core': resolve(__dirname, '../../packages/core/src'),
        '@amusendame/beakblock-vue': resolve(__dirname, '../../packages/vue/src'),
      },
    },
  };
});
