import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@/core': path.resolve(__dirname, 'src/core'),
      '@/adapters': path.resolve(__dirname, 'src/adapters'),
      '@/ui': path.resolve(__dirname, 'src/ui'),
      '@/runtime': path.resolve(__dirname, 'src/runtime'),
    },
  },
});
