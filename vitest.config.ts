import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "paths": { "@/*": ["./src/*"] } — needed
    // as of Phase 8, whose tests are the first to import a file under
    // app/api/** (which itself imports src/lib/** via the `@/` alias).
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
