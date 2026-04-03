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
      external: [
        'prosemirror-commands',
        'prosemirror-dropcursor',
        'prosemirror-gapcursor',
        'prosemirror-history',
        'prosemirror-inputrules',
        'prosemirror-keymap',
        'prosemirror-model',
        'prosemirror-schema-list',
        'prosemirror-state',
        'prosemirror-transform',
        'prosemirror-view',
        'uuid',
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
