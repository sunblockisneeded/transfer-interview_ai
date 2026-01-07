import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./test/setup.ts'],
    include: [
      'test/unit/**/*.test.ts',
      'test/validators/**/*.test.ts',
      'test/components/**/*.test.tsx',
      'test/integration/**/*.test.ts',
    ],
    exclude: [
      'test/experiments/**',
      'test/*.ts', // 기존 수동 테스트 파일 제외
      'node_modules/**',
    ],
    environment: 'jsdom',
    globals: true,
    testTimeout: 30000,
    coverage: {
      reporter: ['text', 'html'],
      include: ['api/**', 'components/**'],
    },
  },
});
