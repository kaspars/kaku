import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      // Type-only file compiles away to nothing — it always reports 0% and
      // drags the average down without there being anything to cover.
      exclude: ['src/types.ts'],
    },
  },
});
