import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/beakblock/' : '/',
  resolve: {
    alias: {
      // Resolve @labbs/beakblock packages to their source folders for live development
      '@labbs/beakblock-core/styles/editor.css': path.resolve(__dirname, '../../packages/core/src/styles/editor.css'),
      '@labbs/beakblock-core': path.resolve(__dirname, '../../packages/core/src'),
      '@labbs/beakblock-react': path.resolve(__dirname, '../../packages/react/src'),
    },
  },
});
