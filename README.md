# 오목

로그인 없이 닉네임만 정하고 둘이서 실시간으로 두는 오목이에요. 이 저장소는 웹, 서버, 공유 패키지를 담은 모노레포예요.

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

### 테스트

```bash
pnpm test                               # shared · server · web 전부 (Vitest)
pnpm --filter @gomoku/web test:watch    # 패키지 하나만, 바뀔 때마다
```

- shared: 오목 규칙과 데이터 검사
- server: 방·입장 요청·대국·재접속 서비스 테스트 + 실제 소켓으로 두 사람이 접속하는 통합 테스트
- web: Testing Library 화면 테스트 (서버 요청과 소켓은 가짜로 바꿔 끼워요)

### 타입 검사

```bash
pnpm type-check
```

### CI

GitHub Actions([`.github/workflows/ci.yml`](.github/workflows/ci.yml))가 `development`·`main`에 올릴 때와 PR마다 설치(`--frozen-lockfile`) → 타입 검사 → 테스트 → 빌드를 돌려요.

### 기획과 디자인

- 기획: [`docs/ux-spec.md`](docs/ux-spec.md)
- 디자인 시스템: [`apps/web/DESIGN.md`](apps/web/DESIGN.md)
- 폰트를 다시 자르려면: [`apps/web/scripts/subset-fonts.py`](apps/web/scripts/subset-fonts.py) (화면 문구에 새 글자가 생기면 테스트가 알려줘요)

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

## 배포

| | 어디 | 설정 파일 | 환경변수 |
| --- | --- | --- | --- |
| web | Vercel | [`apps/web/vercel.json`](apps/web/vercel.json) | `VITE_SOCKET_URL`(서버 주소), `VITE_SITE_URL`(선택, 웹 주소 · 공유 미리보기 이미지 절대 주소용) |
| server | Render 무료 플랜 | [`render.yaml`](render.yaml) | `CLIENT_URL`(웹 주소, CORS), `PORT`(Render가 넣어줘요) |

- `main`에 합치면 배포돼요. 작업은 `development`에서 하고 PR로 합쳐요.
- `VITE_` 값은 빌드할 때 코드에 들어가서 누구나 볼 수 있어요. 비밀 값이 아니라 공개 설정이라 괜찮아요(Vercel 경고가 떠도 그대로 둬요).
- Render에서는 `corepack enable`이 안 돼요(`/usr/bin` 읽기 전용). `npx pnpm@<version>`으로 실행해요.
- Render 무료 플랜은 15분 동안 요청이 없으면 잠들어요. 첫 접속은 30초~1분쯤 걸려요(그동안 웹은 "서버를 깨우는 중" 배너를 보여줘요).
- 방과 대국은 서버 메모리에만 있어요. 서버가 다시 시작되면(배포, 잠듦) 진행 중이던 방은 사라져요.

## 운영

- 서버 로그는 한 줄짜리 JSON이에요(`{"t","level","event",...}`). Render 로그 화면에서 `event` 이름으로 찾아요.
  - `server_started`, `socket_connected`, `session_disconnected`, `room_created`, `game_over`
  - 문제: `client_error`(브라우저 오류), `rate_limited`, `room_limit_reached`, `unhandled_rejection`, `uncaught_exception`
- 남용 방지: 한 사람당 10초에 30번까지 요청, 방은 최대 200개, 방 하나에 입장 요청은 최대 10개.
- 세션 ID는 앞 8자만 로그에 남기고, 닉네임은 로그에 남기지 않아요.

## 개발 가이드

### 새 패키지 추가

1. `packages/` 또는 `apps/` 디렉토리에 새 패키지 생성
2. `package.json`에 `workspace:*` 의존성 추가
3. `pnpm install` 실행

### 공유 타입 사용

```typescript
import { findWinningLine, NicknameSchema, type ServerToClientEvents } from '@gomoku/shared';
```

## 라이선스

MIT
