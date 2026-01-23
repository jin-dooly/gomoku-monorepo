# Socket.IO 사용 가이드

서버의 Socket.IO 기능을 React에서 사용하는 방법입니다.

## 기본 사용법

### 1. Socket 연결

```typescript
import { useSocket } from './hooks/useSocket';

const socket = useSocket('http://localhost:3001');
```

### 2. 게임 기능 사용

```typescript
import { useGameSocket } from './hooks/useGameSocket';

const {
  gameState,    // 현재 게임 상태
  player,       // 내 플레이어 정보
  isConnected,  // 연결 상태
  joinGame,     // 게임 참가 함수
  makeMove,     // 수 두기 함수
  resetGame,    // 게임 리셋 함수
  error,        // 에러 메시지
} = useGameSocket(socket);
```

## 서버 이벤트 매핑

### 클라이언트 → 서버 (emit)

| 이벤트 | 데이터 | 설명 |
|--------|--------|------|
| `join-game` | `{ playerName: string }` | 게임에 참가 |
| `make-move` | `GameMove` | 수 두기 |
| `reset-game` | - | 게임 리셋 |

### 서버 → 클라이언트 (on)

| 이벤트 | 데이터 | 설명 |
|--------|--------|------|
| `player-joined` | `Player` | 플레이어 참가 완료 |
| `game-state` | `GameState` | 게임 상태 업데이트 |
| `game-over` | `{ winner: 1 \| 2 }` | 게임 종료 |
| `move-error` | `{ message: string }` | 수 두기 에러 |

## 예시 코드

### 게임 참가

```typescript
const handleJoin = () => {
  joinGame('플레이어 이름');
};
```

### 수 두기

```typescript
const handleCellClick = (row: number, col: number) => {
  makeMove(row, col);
};
```

### 게임 상태 확인

```typescript
if (gameState) {
  console.log('현재 플레이어:', gameState.currentPlayer);
  console.log('게임 종료 여부:', gameState.isGameOver);
  console.log('보드 상태:', gameState.board);
}
```

## 타입 사용

```typescript
import { GameState, Player, GameMove } from '@gomoku/shared';
import { GameMoveSchema } from '@gomoku/shared';

// 타입 안전한 데이터 사용
const move: GameMove = {
  row: 5,
  col: 5,
  player: 1,
  timestamp: Date.now(),
};

// Zod 스키마로 검증
const validatedMove = GameMoveSchema.parse(move);
```
