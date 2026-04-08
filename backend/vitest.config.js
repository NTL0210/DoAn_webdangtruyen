import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/helpers/testSetup.js'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  root: path.resolve(__dirname),
});
