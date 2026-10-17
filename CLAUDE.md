# CLAUDE.md

실시간 2인 오목 게임 모노레포예요. pnpm + Turborepo로 구성돼 있고, `apps/web`(React + Vite), `apps/server`(NestJS + Socket.IO), `packages/shared`(공유 타입과 Zod 스키마)가 있어요.

## 기획 문서 (작업 전에 반드시 읽기)

- [`docs/ux-spec.md`](docs/ux-spec.md): 확정된 유저플로우, 화면 명세, 게임 규칙, 해야 할 일, 미정 사항. **화면이나 게임 로직을 건드리는 작업은 이 문서를 기준으로 해요.**
- [`apps/web/PRODUCT.md`](apps/web/PRODUCT.md): 사용자, 제품 원칙, 범위
- 와이어프레임: https://claude.ai/artifact/JgydUTX1vGzZJSU82yRtEp
- 디자인 목업(비주얼 기준): https://claude.ai/artifact/BTsJtEEcTz7gAi2ADuFwDD

기획과 다르게 구현해야 할 것 같으면 먼저 사용자에게 확인해요. 새로 정한 기획은 `docs/ux-spec.md`(결정 기록 포함)에 반영해요. 미정 사항은 임의로 정하지 말고 물어봐요.

## 명령어

```bash
pnpm install
pnpm dev     # web(:3000) + server(:3001) + shared watch
pnpm build   # shared → web, server 순서로 빌드
```

## 배포

- web은 Vercel(`apps/web/vercel.json`), server는 Render(`render.yaml`, 무료 플랜)에 배포해요.
- 환경변수: server는 `PORT`, `CLIENT_URL`, web은 `VITE_SOCKET_URL`(빌드할 때 코드에 들어가요).
- Render에서는 `corepack enable`을 쓰지 않아요. `/usr/bin`이 읽기 전용이라 실패해요. 대신 `npx pnpm@<version>`으로 실행해요.
