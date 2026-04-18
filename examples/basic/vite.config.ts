import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/beakblock/' : '/',
  resolve: {
    alias: {
      // Resolve @amusendame/beakblock packages to their source folders for live development
      '@amusendame/beakblock-core/styles/editor.css': path.resolve(__dirname, '../../packages/core/src/styles/editor.css'),
      '@amusendame/beakblock-core': path.resolve(__dirname, '../../packages/core/src'),
      '@amusendame/beakblock-react': path.resolve(__dirname, '../../packages/react/src'),
    },
  },
});
