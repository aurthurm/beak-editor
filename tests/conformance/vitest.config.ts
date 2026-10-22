import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packagesDir = fileURLToPath(new URL('../../packages/', import.meta.url));

/**
 * Resolve every `@amusendame/beakblock-<name>` import to the package source. This keeps the
 * conformance suites independent of whether a package has been built, and avoids testing
 * stale dist output while other packages are still in flight.
 */
const PACKAGE_NAMES = [
  'core',
  'schema',
  'ir',
  'commands',
  'permissions',
  'review',
  'layout',
  'export-docx',
  'import-docx',
  'templates',
  'blocks-qms',
  'blocks-office',
  'blocks-clinical',
  'ai',
];

export default defineConfig({
  resolve: {
    alias: PACKAGE_NAMES.map((name) => ({
      find: new RegExp(`^@amusendame/beakblock-${name}$`),
      replacement: `${packagesDir}${name}/src/index.ts`,
    })),
  },
  test: {
    environment: 'jsdom',
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['src/**/*.test.ts'],
  },
});
