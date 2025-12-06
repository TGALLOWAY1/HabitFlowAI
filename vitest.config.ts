import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // Use jsdom for React component tests
    include: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./src/test/setup.ts'],
  },
});

