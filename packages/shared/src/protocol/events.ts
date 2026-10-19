import type { Board, Position, Stone, WinningLine } from '../game/rules';
import type {
  GameMovePayload,
  JoinDecisionPayload,
  JoinRequestPayload,
  RoomCreatePayload,
} from './schemas';

/**
 * 소켓 이벤트 계약 (docs/ux-spec.md 7장).
 *
 * - 요청/응답이 필요한 C→S 이벤트는 Socket.IO acknowledgement로 결과를 돌려줘요.
 *   에러는 코드로만 보내고, 화면 문구(한국어)는 클라이언트가 정해요.
 * - 남은 시간은 서버와 기기의 시계 차이를 피하려고 절대 시각이 아니라 `remainingMs`로 보내요.
 */

export type ErrorCode =
  | 'invalid-payload'
  | 'already-in-room'
  | 'not-in-room'
  | 'room-not-found'
  | 'room-not-waiting'
  | 'request-not-found'
  | 'not-host'
  | 'not-your-turn'
  | 'game-not-playing'
  | 'occupied'
  /** 대국이 아직 끝나지 않았어요 (재대결 요청, 대기실로 돌아가기) */
  | 'game-in-progress'
  /** 상대가 방을 나가서 재대결할 수 없어요 */
  | 'no-opponent'
  /** 상대가 아직 방에 있어서 대기실로 돌아갈 수 없어요 */
  | 'opponent-present';

export type Ack<T = void> = { ok: true; data: T } | { ok: false; error: ErrorCode };
export type AckCallback<T = void> = (result: Ack<T>) => void;

export type RoomStatus = 'waiting' | 'playing';

/** 방 목록 한 줄. 방 이름은 방장 닉네임이에요. */
export type RoomSummary = {
  id: string;
  hostNickname: string;
  /** epoch ms. 화면에는 `2026.10.18 14:32:07 생성` 형식으로 보여줘요 */
  createdAt: number;
  status: RoomStatus;
};

/** 방장 대기실에 보여줄 입장 요청 */
export type PendingJoinRequest = {
  requestId: string;
  nickname: string;
  remainingMs: number;
};

export type JoinRequestTicket = {
  requestId: string;
  room: RoomSummary;
  remainingMs: number;
};

/** 참가자에게 보내는 입장 요청 결과 */
export type JoinResolution =
  | 'accepted'
  /** 방장이 거절 */
  | 'rejected'
  /** 60초 안에 응답 없음 */
  | 'expired'
  /** 방장이 다른 사람을 수락 */
  | 'taken'
  /** 방장이 방을 닫음 (화면 문구는 미정, ux-spec 8장) */
  | 'room-closed';

export type PlayerInfo = { nickname: string };

/** 대국 화면 상태. 플레이어마다 `you`가 달라서 각자에게 따로 보내요. */
export type GameStatePayload = {
  roomId: string;
  hostNickname: string;
  players: Record<Stone, PlayerInfo>;
  you: Stone;
  board: Board;
  turn: Stone;
  moveCount: number;
  lastMove: (Position & { stone: Stone }) | null;
};

export type GameOverReason = 'five' | 'draw' | 'resign' | 'left' | 'disconnect';

export type GameOverPayload = {
  /** 무승부면 null */
  winner: Stone | null;
  reason: GameOverReason;
  /** reason이 'five'일 때만 있어요 */
  winningLine: WinningLine | null;
  moveCount: number;
};

export type RematchStatusPayload = {
  /** 재대결을 요청한 사람의 지금 판 색 */
  requestedBy: Stone[];
};

/** 끝난 판의 결과 화면에서 상대가 방을 나갔거나 연결이 끊겼어요. 재대결할 수 없어요. */
export type OpponentLeftPayload = { reason: 'left' | 'disconnect' };

export type OpponentDisconnectedPayload = { remainingMs: number };

export interface ClientToServerEvents {
  'room:list': (ack: AckCallback<RoomSummary[]>) => void;
  'room:create': (payload: RoomCreatePayload, ack: AckCallback<RoomSummary>) => void;
  /** 방장이 대기실에서 방을 닫아요 */
  'room:close': (ack: AckCallback) => void;
  /** 방에서 나가요. 대국 중이면 기권으로 처리돼요. 방장이 나가면 방이 사라져요. */
  'room:leave': (ack: AckCallback) => void;
  /** 상대가 나간 뒤 방장이 방을 유지하고 대기실로 돌아가요. 방이 다시 '대기 중'이 돼요. */
  'room:reopen': (ack: AckCallback<RoomSummary>) => void;

  'join:request': (payload: JoinRequestPayload, ack: AckCallback<JoinRequestTicket>) => void;
  'join:cancel': (ack: AckCallback) => void;
  'join:accept': (payload: JoinDecisionPayload, ack: AckCallback) => void;
  'join:reject': (payload: JoinDecisionPayload, ack: AckCallback) => void;

  'game:move': (payload: GameMovePayload, ack: AckCallback) => void;
  'game:resign': (ack: AckCallback) => void;

  'rematch:request': (ack: AckCallback) => void;
}

export interface ServerToClientEvents {
  /** 방장에게: 대기 중인 입장 요청 전체 목록 (도착·취소·만료될 때마다) */
  'join:requests': (requests: PendingJoinRequest[]) => void;
  /** 참가자에게: 입장 요청 결과 */
  'join:resolved': (payload: { resolution: JoinResolution }) => void;

  'game:state': (payload: GameStatePayload) => void;
  'game:over': (payload: GameOverPayload) => void;
  'rematch:status': (payload: RematchStatusPayload) => void;
  /** 끝난 판의 결과 화면에서 상대가 나갔어요. 두는 중에 나가면 대신 game:over(reason: left/disconnect)가 와요. */
  'opponent:left': (payload: OpponentLeftPayload) => void;

  'opponent:disconnected': (payload: OpponentDisconnectedPayload) => void;
  'opponent:reconnected': () => void;
}
