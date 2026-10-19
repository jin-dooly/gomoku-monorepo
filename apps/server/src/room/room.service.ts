import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  RECONNECT_GRACE_MS,
  createBoard,
  oppositeStone,
  placeStone,
  type Ack,
  type Board,
  type ErrorCode,
  type GameOverPayload,
  type GameStatePayload,
  type JoinRequestTicket,
  type JoinResolution,
  type OpponentLeftPayload,
  type PendingJoinRequest,
  type Position,
  type RoomStatus,
  type RoomSummary,
  type SessionResumePayload,
  type Stone,
} from '@gomoku/shared';

/**
 * 방, 입장 요청, 대국 상태를 메모리에 둬요 (docs/ux-spec.md 3장).
 * 플레이어는 세션 ID(playerId)로 구분해요. 새로고침해도 같은 세션이면 같은 사람이에요.
 * 소켓을 모르는 순수한 상태 관리만 하고, 누군가에게 알려야 할 일은 `RoomEvent`로 내보내요.
 * 게이트웨이가 그 이벤트를 소켓 이벤트로 바꿔 보내요.
 */

/** 입장 요청은 60초 안에 방장이 답하지 않으면 자동으로 취소돼요. */
export const JOIN_REQUEST_TTL_MS = 60_000;

/** 무료 서버 한 대가 감당할 만큼만 받아요. 넘으면 새 방·요청을 잠시 막아요. */
export const MAX_ROOMS = 200;
export const MAX_PENDING_REQUESTS_PER_ROOM = 10;

export type Member = { playerId: string; nickname: string };

type JoinRequest = {
  id: string;
  playerId: string;
  nickname: string;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

/** 한 판의 상태 (docs/ux-spec.md 3장 "대국"). 판이 끝나도 결과 화면을 위해 남겨 둬요. */
export type Game = {
  /** 이번 판의 흑과 백. 첫 판은 방장이 흑이고, 재대결하면 바뀌어요(4단계). */
  players: Record<Stone, Member>;
  board: Board;
  turn: Stone;
  moveCount: number;
  lastMove: (Position & { stone: Stone }) | null;
  over: boolean;
  /** 끝난 판의 결과. 다시 연결한 사람에게 결과 화면을 보여줄 때 써요. */
  result: GameOverPayload | null;
};

export type Room = {
  id: string;
  /** 방장. 첫 판은 흑을 잡아요. 방 이름이 방장 닉네임이에요(중복 허용). */
  host: Member;
  /** 수락된 참가자. 첫 판은 백을 잡아요. */
  guest: Member | null;
  createdAt: number;
  status: RoomStatus;
  /** 들어온 순서대로 */
  requests: Map<string, JoinRequest>;
  /** 수락한 뒤부터 있어요. */
  game: Game | null;
  /** 끝난 판에서 재대결을 요청한 사람의 이번 판 색 */
  rematch: Set<Stone>;
  /** 끝난 판의 결과 화면에서 참가자가 떠났어요. 방장에게 재대결할 수 없다고 보여줘요. */
  departed: OpponentLeftPayload['reason'] | null;
};

export type RoomEvent =
  /** 방장에게 대기 중인 요청 전체 목록을 다시 보내요. */
  | { type: 'requests-changed'; hostId: string; requests: PendingJoinRequest[] }
  /** 참가자에게 요청 결과를 알려요. */
  | { type: 'join-resolved'; playerId: string; resolution: JoinResolution }
  /** 한 사람에게 판 상태를 보내요. 내 색(`you`)이 사람마다 달라서 따로 보내요. */
  | { type: 'game-state'; playerId: string; payload: GameStatePayload }
  /** 대국이 끝났어요. */
  | { type: 'game-over'; playerId: string; payload: GameOverPayload }
  /** 재대결 요청 상태가 바뀌었어요. */
  | { type: 'rematch-status'; playerId: string; requestedBy: Stone[] }
  /** 결과 화면에서 상대가 나갔어요. */
  | { type: 'opponent-left'; playerId: string; payload: OpponentLeftPayload }
  /** 상대 연결이 끊겨서 기다리는 중이에요. */
  | { type: 'opponent-disconnected'; playerId: string; remainingMs: number }
  /** 기다리던 상대가 돌아왔어요. */
  | { type: 'opponent-reconnected'; playerId: string }
  /** 다시 연결한 사람에게 지금 있던 곳을 알려줘요. */
  | { type: 'resume'; playerId: string; payload: SessionResumePayload };

const ok = <T>(data: T): Ack<T> => ({ ok: true, data });
const fail = <T>(error: ErrorCode): Ack<T> => ({ ok: false, error });

@Injectable()
export class RoomService implements OnModuleDestroy {
  private readonly rooms = new Map<string, Room>();
  /** 방장이나 참가자로 들어가 있는 방 */
  private readonly roomIdByMember = new Map<string, string>();
  /** 입장 요청을 보내고 기다리는 중인 방. 한 사람은 요청을 하나만 보낼 수 있어요. */
  private readonly pendingByPlayer = new Map<string, { roomId: string; requestId: string }>();
  /** 연결이 끊겨 돌아오기를 기다리는 사람 (30초) */
  private readonly grace = new Map<string, { timer: ReturnType<typeof setTimeout>; until: number }>();
  private listener: (event: RoomEvent) => void = () => {};

  onEvent(listener: (event: RoomEvent) => void): void {
    this.listener = listener;
  }

  onModuleDestroy(): void {
    for (const room of this.rooms.values()) this.clearRequests(room);
    for (const { timer } of this.grace.values()) clearTimeout(timer);
    this.grace.clear();
  }

  // ---- 방 ----

  create(playerId: string, nickname: string): Ack<RoomSummary> {
    if (this.isBusy(playerId)) return fail('already-in-room');
    if (this.rooms.size >= MAX_ROOMS) return fail('too-many-rooms');

    const room: Room = {
      id: randomUUID(),
      host: { playerId, nickname },
      guest: null,
      createdAt: Date.now(),
      status: 'waiting',
      requests: new Map(),
      game: null,
      rematch: new Set(),
      departed: null,
    };
    this.rooms.set(room.id, room);
    this.roomIdByMember.set(playerId, room.id);
    return ok(toSummary(room));
  }

  /** 방장이 대기실에서 방을 닫아요. 기다리던 요청은 모두 '방 닫힘'으로 끝나요. */
  close(playerId: string): Ack {
    const room = this.findByMember(playerId);
    if (!room) return fail('not-in-room');
    if (room.host.playerId !== playerId) return fail('not-host');
    if (room.status !== 'waiting') return fail('room-not-waiting');

    this.removeRoom(room);
    return ok(undefined);
  }

  /**
   * 방에서 나가요 (docs/ux-spec.md 3장 "대국 중 / 대국 후").
   * - 입장 요청을 기다리던 중이면 요청을 취소해요.
   * - 방장이 나가면 방이 사라져요. 남은 참가자에게는 두는 중이면 대국 종료(승리)를, 끝난 판이면 상대가 나갔다고 알려요.
   * - 참가자가 나가면 방장은 방에 남아요. 두는 중이면 방장이 이기고, 끝난 판이면 상대가 나갔다고 알려요.
   *   방장은 대기실로 돌아가거나(reopen) 로비로 나가요(방 닫힘).
   */
  leave(playerId: string): Ack {
    return this.exit(playerId, 'left');
  }

  /**
   * 상대가 나간 뒤 방장이 방을 유지하고 대기실로 돌아가요.
   * 방이 다시 '대기 중'이 되어 목록에서 입장 요청을 받을 수 있어요.
   */
  reopen(hostId: string): Ack<RoomSummary> {
    const room = this.findByMember(hostId);
    if (!room) return fail('not-in-room');
    if (room.host.playerId !== hostId) return fail('not-host');
    if (room.guest) return fail('opponent-present');
    if (room.game && !room.game.over) return fail('game-in-progress');

    room.status = 'waiting';
    room.game = null;
    room.rematch.clear();
    room.departed = null;
    return ok(toSummary(room));
  }

  /**
   * 이 세션의 연결이 모두 끊겼어요 (docs/ux-spec.md 3장, 07).
   * - 입장 요청을 기다리던 중이면 요청을 바로 취소해요.
   * - 방에 있으면 30초 동안 돌아오기를 기다리고, 상대에게 기다리는 중이라고 알려요.
   *   그 안에 돌아오지 않으면 방에서 나간 것으로 처리해요(두는 중이면 상대 승리).
   */
  disconnect(playerId: string): void {
    if (this.pendingByPlayer.has(playerId)) {
      this.cancelJoin(playerId);
      return;
    }
    const room = this.findByMember(playerId);
    if (!room || this.grace.has(playerId)) return;

    const timer = setTimeout(() => this.expireGrace(playerId), RECONNECT_GRACE_MS);
    this.grace.set(playerId, { timer, until: Date.now() + RECONNECT_GRACE_MS });
    const other = this.otherMember(room, playerId);
    if (other) {
      this.emit({ type: 'opponent-disconnected', playerId: other.playerId, remainingMs: RECONNECT_GRACE_MS });
    }
  }

  /**
   * 이 세션이 연결됐어요(처음, 새로고침, 순간 끊김 뒤 복구).
   * 기다리던 중이었으면 상대에게 돌아왔다고 알리고, 방에 있으면 지금 상태를 보내요.
   */
  connect(playerId: string): void {
    const room = this.findByMember(playerId);
    const waiting = this.grace.get(playerId);
    if (waiting) {
      clearTimeout(waiting.timer);
      this.grace.delete(playerId);
      const other = room && this.otherMember(room, playerId);
      if (other) this.emit({ type: 'opponent-reconnected', playerId: other.playerId });
    }
    if (room) this.emit({ type: 'resume', playerId, payload: this.snapshot(room, playerId) });
  }

  /** 연결이 끊겨 기다리는 중이면 남은 시간, 아니면 null */
  graceRemaining(playerId: string): number | null {
    const waiting = this.grace.get(playerId);
    return waiting ? Math.max(0, waiting.until - Date.now()) : null;
  }

  /** 새로 만든 방이 위로 오게 정렬해요. */
  list(): RoomSummary[] {
    return [...this.rooms.values()].sort((a, b) => b.createdAt - a.createdAt).map(toSummary);
  }

  findByMember(playerId: string): Room | undefined {
    const roomId = this.roomIdByMember.get(playerId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  /** 이번 판에서 이 사람의 돌 색. 대국 전이면 null이에요. */
  stoneOf(room: Room, playerId: string): Stone | null {
    if (!room.game) return null;
    if (room.game.players.black.playerId === playerId) return 'black';
    if (room.game.players.white.playerId === playerId) return 'white';
    return null;
  }

  // ---- 대국 ----

  /**
   * 내 차례에 빈 교차점에 돌을 둬요. 두 사람 모두에게 새 판 상태를 보내고,
   * 5목이 생기거나 판이 가득 차면 대국 종료를 보내요.
   */
  move(playerId: string, position: Position): Ack {
    const room = this.findByMember(playerId);
    if (!room) return fail('not-in-room');
    const game = room.game;
    if (!game || game.over) return fail('game-not-playing');
    if (this.stoneOf(room, playerId) !== game.turn) return fail('not-your-turn');

    const stone = game.turn;
    const result = placeStone(game.board, position, stone);
    if (!result.ok) return fail(result.error === 'occupied' ? 'occupied' : 'invalid-payload');

    game.board = result.board;
    game.moveCount += 1;
    game.lastMove = { ...position, stone };
    game.turn = oppositeStone(stone);
    if (result.outcome.type !== 'continue') game.over = true;

    this.broadcastState(room);

    if (result.outcome.type === 'win') {
      this.broadcastOver(room, { winner: stone, reason: 'five', winningLine: result.outcome.line, moveCount: game.moveCount });
    } else if (result.outcome.type === 'draw') {
      this.broadcastOver(room, { winner: null, reason: 'draw', winningLine: null, moveCount: game.moveCount });
    }
    return ok(undefined);
  }

  /** 기권하면 이번 판만 패배로 끝나고, 둘 다 방에 남아 재대결할 수 있어요. */
  resign(playerId: string): Ack {
    const room = this.findByMember(playerId);
    if (!room) return fail('not-in-room');
    const game = room.game;
    const stone = this.stoneOf(room, playerId);
    if (!game || game.over || !stone) return fail('game-not-playing');

    game.over = true;
    this.broadcastOver(room, {
      winner: oppositeStone(stone),
      reason: 'resign',
      winningLine: null,
      moveCount: game.moveCount,
    });
    return ok(undefined);
  }

  /**
   * 끝난 판에서 재대결을 요청해요. 두 사람이 모두 요청하면 흑과 백을 바꿔 새 판을 시작해요.
   * 이미 요청했으면 다시 요청해도 그대로예요.
   */
  requestRematch(playerId: string): Ack {
    const room = this.findByMember(playerId);
    if (!room) return fail('not-in-room');
    const game = room.game;
    if (!game) return fail('game-not-playing');
    if (!game.over) return fail('game-in-progress');
    if (!room.guest) return fail('no-opponent');
    const stone = this.stoneOf(room, playerId);
    if (!stone) return fail('not-in-room');

    room.rematch.add(stone);
    if (room.rematch.size < 2) {
      this.broadcastRematch(room);
      return ok(undefined);
    }

    room.rematch.clear();
    room.departed = null;
    room.game = newGame({ black: game.players.white, white: game.players.black });
    this.broadcastState(room);
    return ok(undefined);
  }

  /** 이 사람에게 보낼 판 상태예요. 대국 중이 아니면 null이에요. */
  gameStateFor(room: Room, playerId: string): GameStatePayload | null {
    const game = room.game;
    const you = this.stoneOf(room, playerId);
    if (!game || !you) return null;
    return {
      roomId: room.id,
      hostNickname: room.host.nickname,
      players: { black: { nickname: game.players.black.nickname }, white: { nickname: game.players.white.nickname } },
      you,
      board: game.board.map((row) => [...row]),
      turn: game.turn,
      moveCount: game.moveCount,
      lastMove: game.lastMove,
    };
  }

  // ---- 입장 요청 ----

  requestJoin(playerId: string, roomId: string, nickname: string): Ack<JoinRequestTicket> {
    if (this.isBusy(playerId)) return fail('already-in-room');
    const room = this.rooms.get(roomId);
    if (!room) return fail('room-not-found');
    if (room.status !== 'waiting') return fail('room-not-waiting');
    if (room.requests.size >= MAX_PENDING_REQUESTS_PER_ROOM) return fail('too-many-requests');

    const id = randomUUID();
    const request: JoinRequest = {
      id,
      playerId,
      nickname,
      expiresAt: Date.now() + JOIN_REQUEST_TTL_MS,
      timer: setTimeout(() => this.expire(room.id, id), JOIN_REQUEST_TTL_MS),
    };
    room.requests.set(id, request);
    this.pendingByPlayer.set(playerId, { roomId: room.id, requestId: id });
    this.notifyRequests(room);

    return ok({ requestId: id, room: toSummary(room), remainingMs: JOIN_REQUEST_TTL_MS });
  }

  /** 참가자가 기다리다가 요청을 직접 취소해요. */
  cancelJoin(playerId: string): Ack {
    const pending = this.pendingByPlayer.get(playerId);
    const room = pending && this.rooms.get(pending.roomId);
    if (!pending || !room) return fail('request-not-found');

    this.dropRequest(room, pending.requestId);
    this.notifyRequests(room);
    return ok(undefined);
  }

  /** 방장이 한 명을 수락하면 대국이 시작되고, 나머지 요청은 모두 자동으로 거절돼요. */
  accept(hostId: string, requestId: string): Ack {
    const room = this.hostedWaitingRoom(hostId);
    if (!room.ok) return room;
    const request = room.data.requests.get(requestId);
    if (!request) return fail('request-not-found');

    const target = room.data;
    this.dropRequest(target, requestId);
    const guest = { playerId: request.playerId, nickname: request.nickname };
    target.guest = guest;
    target.status = 'playing';
    this.roomIdByMember.set(guest.playerId, target.id);
    this.emit({ type: 'join-resolved', playerId: guest.playerId, resolution: 'accepted' });

    this.resolveAll(target, 'taken');
    this.notifyRequests(target);

    // 첫 판은 방장이 흑이고 먼저 둬요.
    target.game = newGame({ black: target.host, white: guest });
    this.broadcastState(target);
    return ok(undefined);
  }

  reject(hostId: string, requestId: string): Ack {
    const room = this.hostedWaitingRoom(hostId);
    if (!room.ok) return room;
    const request = room.data.requests.get(requestId);
    if (!request) return fail('request-not-found');

    this.dropRequest(room.data, requestId);
    this.emit({ type: 'join-resolved', playerId: request.playerId, resolution: 'rejected' });
    this.notifyRequests(room.data);
    return ok(undefined);
  }

  pendingRequests(room: Room): PendingJoinRequest[] {
    const now = Date.now();
    return [...room.requests.values()].map((r) => ({
      requestId: r.id,
      nickname: r.nickname,
      remainingMs: Math.max(0, r.expiresAt - now),
    }));
  }

  // ---- 내부 ----

  private expire(roomId: string, requestId: string): void {
    const room = this.rooms.get(roomId);
    const request = room?.requests.get(requestId);
    if (!room || !request) return;

    this.dropRequest(room, requestId);
    this.emit({ type: 'join-resolved', playerId: request.playerId, resolution: 'expired' });
    this.notifyRequests(room);
  }

  private expireGrace(playerId: string): void {
    this.grace.delete(playerId);
    this.exit(playerId, 'disconnect');
  }

  private exit(playerId: string, reason: 'left' | 'disconnect'): Ack {
    if (this.pendingByPlayer.has(playerId)) return this.cancelJoin(playerId);

    const room = this.findByMember(playerId);
    if (!room) return fail('not-in-room');
    this.clearGrace(playerId);

    const isHost = room.host.playerId === playerId;
    const other = isHost ? room.guest : room.host;
    const game = room.game;

    if (other && game) {
      if (!game.over) {
        // 두는 중에 나가면 남은 사람이 이겨요.
        game.over = true;
        this.emit({
          type: 'game-over',
          playerId: other.playerId,
          payload: { winner: this.stoneOf(room, other.playerId), reason, winningLine: null, moveCount: game.moveCount },
        });
      } else {
        // 결과 화면에서 나가면 남은 사람에게 재대결할 수 없다고 알려요.
        this.emit({ type: 'opponent-left', playerId: other.playerId, payload: { reason } });
      }
    }

    if (isHost) {
      if (room.guest) this.clearGrace(room.guest.playerId);
      this.removeRoom(room);
    } else {
      // 참가자만 빠지고 방장은 방에 남아요. 대기실로 돌아갈지는 방장이 정해요.
      this.roomIdByMember.delete(playerId);
      room.guest = null;
      room.rematch.clear();
      if (room.game) room.departed = reason;
    }
    return ok(undefined);
  }

  private hostedWaitingRoom(hostId: string): Ack<Room> {
    const room = this.findByMember(hostId);
    if (!room) return fail('not-in-room');
    if (room.host.playerId !== hostId) return fail('not-host');
    if (room.status !== 'waiting') return fail('room-not-waiting');
    return ok(room);
  }

  private isBusy(playerId: string): boolean {
    return this.roomIdByMember.has(playerId) || this.pendingByPlayer.has(playerId);
  }

  private dropRequest(room: Room, requestId: string): void {
    const request = room.requests.get(requestId);
    if (!request) return;
    clearTimeout(request.timer);
    room.requests.delete(requestId);
    this.pendingByPlayer.delete(request.playerId);
  }

  /** 남은 요청을 모두 같은 결과로 끝내요. */
  private resolveAll(room: Room, resolution: JoinResolution): void {
    for (const request of [...room.requests.values()]) {
      this.dropRequest(room, request.id);
      this.emit({ type: 'join-resolved', playerId: request.playerId, resolution });
    }
  }

  private clearRequests(room: Room): void {
    for (const request of room.requests.values()) clearTimeout(request.timer);
  }

  private removeRoom(room: Room): void {
    this.resolveAll(room, 'room-closed');
    this.rooms.delete(room.id);
    this.roomIdByMember.delete(room.host.playerId);
    if (room.guest) this.roomIdByMember.delete(room.guest.playerId);
  }

  private otherMember(room: Room, playerId: string): Member | null {
    if (room.host.playerId === playerId) return room.guest;
    if (room.guest?.playerId === playerId) return room.host;
    return null;
  }

  private clearGrace(playerId: string): void {
    const waiting = this.grace.get(playerId);
    if (!waiting) return;
    clearTimeout(waiting.timer);
    this.grace.delete(playerId);
  }

  /** 다시 연결한 사람이 지금 있던 곳을 그대로 볼 수 있게 모아요. */
  private snapshot(room: Room, playerId: string): SessionResumePayload {
    const isHost = room.host.playerId === playerId;
    const other = this.otherMember(room, playerId);
    const otherRemaining = other ? this.graceRemaining(other.playerId) : null;
    return {
      role: isHost ? 'host' : 'guest',
      room: toSummary(room),
      game: this.gameStateFor(room, playerId),
      over: room.game?.result ?? null,
      rematch: [...room.rematch],
      opponentLeft: isHost ? room.departed : null,
      opponentDisconnected: otherRemaining === null ? null : { remainingMs: otherRemaining },
      requests: isHost && room.status === 'waiting' ? this.pendingRequests(room) : [],
    };
  }

  private members(room: Room): Member[] {
    return room.guest ? [room.host, room.guest] : [room.host];
  }

  private broadcastState(room: Room): void {
    for (const member of this.members(room)) {
      const payload = this.gameStateFor(room, member.playerId);
      if (payload) this.emit({ type: 'game-state', playerId: member.playerId, payload });
    }
  }

  private broadcastOver(room: Room, payload: GameOverPayload): void {
    room.rematch.clear();
    if (room.game) room.game.result = payload;
    for (const member of this.members(room)) this.emit({ type: 'game-over', playerId: member.playerId, payload });
  }

  private broadcastRematch(room: Room): void {
    const requestedBy = [...room.rematch];
    for (const member of this.members(room)) {
      this.emit({ type: 'rematch-status', playerId: member.playerId, requestedBy });
    }
  }

  private notifyRequests(room: Room): void {
    this.emit({ type: 'requests-changed', hostId: room.host.playerId, requests: this.pendingRequests(room) });
  }

  private emit(event: RoomEvent): void {
    this.listener(event);
  }
}

const newGame = (players: Record<Stone, Member>): Game => ({
  players,
  board: createBoard(),
  turn: 'black',
  moveCount: 0,
  lastMove: null,
  over: false,
  result: null,
});

export const toSummary = (room: Room): RoomSummary => ({
  id: room.id,
  hostNickname: room.host.nickname,
  createdAt: room.createdAt,
  status: room.status,
});
