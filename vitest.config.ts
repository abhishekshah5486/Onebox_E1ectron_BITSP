import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: { provider: 'v8', include: ['src/**'], exclude: ['**/*.test.*', 'src/**/test/**'] },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/{main,preload,shared}/**/*.test.ts'],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['src/renderer/src/test/setup.ts'],
        },
      },
    ],
  },
});
