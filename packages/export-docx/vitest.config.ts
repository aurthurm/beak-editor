import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      // Tests build documents from the schema fixtures. The schema is not a
      // dependency of this package, so resolve it from the workspace source.
      {
        find: /^@amusendame\/beakblock-schema$/,
        replacement: fileURLToPath(new URL('../schema/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'jsdom',
  },
});
