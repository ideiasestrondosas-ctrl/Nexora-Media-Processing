import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/performance/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts', 'src/worker.ts'],
      thresholds: { lines: 80, branches: 75, functions: 80, statements: 80 }
    },
    testTimeout: 60000,
    hookTimeout: 30000,
    setupFiles: ['tests/setup.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@workers': path.resolve(__dirname, './src/workers'),
      '@qc': path.resolve(__dirname, './src/qc'),
      '@pipeline': path.resolve(__dirname, './src/pipeline')
    }
  }
});
