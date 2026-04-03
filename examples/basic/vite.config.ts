import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/beakblock/' : '/',
  resolve: {
    alias: {
      // Resolve @aurthurm/beakblock packages to their source folders for live development
      '@aurthurm/beakblock-core/styles/editor.css': path.resolve(__dirname, '../../packages/core/src/styles/editor.css'),
      '@aurthurm/beakblock-core': path.resolve(__dirname, '../../packages/core/src'),
      '@aurthurm/beakblock-react': path.resolve(__dirname, '../../packages/react/src'),
    },
  },
});
