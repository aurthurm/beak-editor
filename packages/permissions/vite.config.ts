import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['src/**/*.test.ts', 'src/testing.ts'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BeakBlockPermissions',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // Bare imports (dependencies, peers, workspace packages) stay external.
      external: (id) => /^[^./]/.test(id),
    },
    sourcemap: true,
    minify: false,
  },
});
