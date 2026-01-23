# Gomoku Monorepo

오목 게임 모노레포 프로젝트입니다.

## 스택

- **패키지 매니저**: pnpm
- **빌드 시스템**: Turborepo
- **웹 앱**: React + TypeScript + Vite
- **서버**: NestJS + Socket.IO
- **공유 패키지**: Zod + TypeScript Types

## 프로젝트 구조

```
gomoku-monorepo/
├── apps/
│   ├── web/          # React 웹 앱
│   └── server/       # NestJS 서버
├── packages/
│   └── shared/       # 공유 타입 및 스키마
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 시작하기

### 설치

```bash
pnpm install
```

### 개발 모드 실행

```bash
# 모든 앱 동시 실행
pnpm dev

# 개별 실행
pnpm --filter @gomoku/web dev
pnpm --filter @gomoku/server dev
```

### 빌드

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```

## 패키지

### @gomoku/shared

공유 타입 정의 및 Zod 스키마를 포함하는 패키지입니다.

### @gomoku/web

React + TypeScript로 작성된 웹 클라이언트입니다.
- 포트: 3000
- Vite 개발 서버 사용

### @gomoku/server

NestJS + Socket.IO로 작성된 게임 서버입니다.
- 포트: 3001
- WebSocket을 통한 실시간 게임 통신

## 개발 가이드

### 새 패키지 추가

1. `packages/` 또는 `apps/` 디렉토리에 새 패키지 생성
2. `package.json`에 `workspace:*` 의존성 추가
3. `pnpm install` 실행

### 공유 타입 사용

```typescript
import { GameState, GameMove, Player } from '@gomoku/shared';
import { GameMoveSchema } from '@gomoku/shared';
```

## 라이선스

MIT
