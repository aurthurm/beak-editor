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
      name: 'BeakBlockReact',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@labbs/beakblock-core',
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
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
