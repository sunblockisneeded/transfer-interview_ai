/**
 * Vitest 글로벌 설정
 * - dotenv로 .env.local 로드
 * - Testing Library 매처 확장
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import '@testing-library/jest-dom';

// .env.local 로드
config({ path: resolve(process.cwd(), '.env.local') });

// 환경변수 확인
if (!process.env.API_KEY) {
  console.warn('⚠️  API_KEY not set - Integration tests will be skipped');
}

// 글로벌 타임아웃 설정
if (typeof globalThis.vi !== 'undefined') {
  globalThis.vi.setConfig({ testTimeout: 30000 });
}
