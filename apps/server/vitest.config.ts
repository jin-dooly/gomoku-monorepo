import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Nest의 의존성 주입은 데코레이터 메타데이터가 필요해서 esbuild 대신 SWC로 변환해요.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
  },
});
