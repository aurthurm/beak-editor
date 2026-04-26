import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { runOpenAICompletion } from '../shared/ai';

function aiEndpointPlugin(): Plugin {
  const handleRequest = async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const body = (await request.json()) as Parameters<typeof runOpenAICompletion>[0];
      const output = await runOpenAICompletion(body);
      return Response.json({ output });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed';
      return Response.json({ error: message }, { status: 500 });
    }
  };

  const middleware = async (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
    if (req.url !== '/api/ai' || req.method !== 'POST') return;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }

    const request = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      body: Buffer.concat(chunks),
    });

    const response = await handleRequest(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const body = Buffer.from(await response.arrayBuffer());
    res.end(body);
  };

  return {
    name: 'beakblock-basic-ai-endpoint',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), aiEndpointPlugin()],
  base: process.env.GITHUB_PAGES ? '/beakblock/' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('chart.js')) return 'chartjs';
            if (id.includes('docx')) return 'docx';
            if (id.includes('marked')) return 'marked';
            return 'vendor';
          }

          if (id.includes('/packages/core/src/')) return 'beakblock-core';
          if (id.includes('/packages/react/src/')) return 'beakblock-react';
          if (id.includes('/examples/basic/src/exportOffice.ts')) return 'export-office';

          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      // Resolve @amusendame/beakblock packages to their source folders for live development
      '@amusendame/beakblock-core/styles/editor.css': path.resolve(__dirname, '../../packages/core/src/styles/editor.css'),
      '@amusendame/beakblock-core': path.resolve(__dirname, '../../packages/core/src'),
      '@amusendame/beakblock-react': path.resolve(__dirname, '../../packages/react/src'),
    },
  },
});
