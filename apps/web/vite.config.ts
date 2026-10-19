import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * 링크 공유 미리보기는 이미지 주소가 절대 주소여야 잘 보여요.
 * 배포할 때 VITE_SITE_URL(예: https://omok.vercel.app)을 주면 og:image를 절대 주소로 바꾸고 og:url을 넣어요.
 */
const socialMeta = (siteUrl: string | undefined): Plugin => ({
  name: 'gomoku-social-meta',
  transformIndexHtml(html) {
    if (!siteUrl) return html;
    const base = siteUrl.replace(/\/$/, '');
    return html
      .replace('content="/og-image.png"', `content="${base}/og-image.png"`)
      .replace('<meta property="og:type"', `<meta property="og:url" content="${base}/" />
    <meta property="og:type"`);
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), socialMeta(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // shared는 서버(Nest)를 위해 CommonJS로 빌드돼요. 웹은 ESM이 필요해서 TypeScript 소스를 바로 써요.
      '@gomoku/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
}));
