import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BeakBlockCore',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // Bare imports (dependencies, peers, workspace packages) stay external so Node
      // resolves each dependency's own node export condition at runtime.
      external: (id) => /^[^./]/.test(id),
    },
    sourcemap: true,
    minify: false,
  },
});
