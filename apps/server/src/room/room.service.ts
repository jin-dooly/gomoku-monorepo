import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  Ack,
  ErrorCode,
  GameOverPayload,
  JoinRequestTicket,
  JoinResolution,
  PendingJoinRequest,
  RoomStatus,
  RoomSummary,
  Stone,
} from '@gomoku/shared';

/**
 * 방과 입장 요청 상태를 메모리에 둬요 (docs/ux-spec.md 3장 "방과 입장").
 * 소켓을 모르는 순수한 상태 관리만 하고, 누군가에게 알려야 할 일은 `RoomEvent`로 내보내요.
 * 게이트웨이가 그 이벤트를 소켓 이벤트로 바꿔 보내요.
 */

/** 입장 요청은 60초 안에 방장이 답하지 않으면 자동으로 취소돼요. */
export const JOIN_REQUEST_TTL_MS = 60_000;

export type Member = { socketId: string; nickname: string };

type JoinRequest = {
  id: string;
  socketId: string;
  nickname: string;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
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
};

export type RoomEvent =
  /** 방장에게 대기 중인 요청 전체 목록을 다시 보내요. */
  | { type: 'requests-changed'; hostId: string; requests: PendingJoinRequest[] }
  /** 참가자에게 요청 결과를 알려요. */
  | { type: 'join-resolved'; socketId: string; resolution: JoinResolution }
  /** 대국이 끝났어요. 지금은 상대가 나가거나 연결이 끊긴 경우만 있어요. */
  | { type: 'game-over'; socketId: string; payload: GameOverPayload };

const ok = <T>(data: T): Ack<T> => ({ ok: true, data });
const fail = <T>(error: ErrorCode): Ack<T> => ({ ok: false, error });

@Injectable()
export class RoomService implements OnModuleDestroy {
  private readonly rooms = new Map<string, Room>();
  /** 방장이나 참가자로 들어가 있는 방 */
  private readonly roomIdByMember = new Map<string, string>();
  /** 입장 요청을 보내고 기다리는 중인 방. 한 사람은 요청을 하나만 보낼 수 있어요. */
  private readonly pendingBySocket = new Map<string, { roomId: string; requestId: string }>();
  private listener: (event: RoomEvent) => void = () => {};

  onEvent(listener: (event: RoomEvent) => void): void {
    this.listener = listener;
  }

  onModuleDestroy(): void {
    for (const room of this.rooms.values()) this.clearRequests(room);
  }

  // ---- 방 ----

  create(socketId: string, nickname: string): Ack<RoomSummary> {
    if (this.isBusy(socketId)) return fail('already-in-room');

    const room: Room = {
      id: randomUUID(),
      host: { socketId, nickname },
      guest: null,
      createdAt: Date.now(),
      status: 'waiting',
      requests: new Map(),
    };
    this.rooms.set(room.id, room);
    this.roomIdByMember.set(socketId, room.id);
    return ok(toSummary(room));
  }

  /** 방장이 대기실에서 방을 닫아요. 기다리던 요청은 모두 '방 닫힘'으로 끝나요. */
  close(socketId: string): Ack {
    const room = this.findByMember(socketId);
    if (!room) return fail('not-in-room');
    if (room.host.socketId !== socketId) return fail('not-host');
    if (room.status !== 'waiting') return fail('room-not-waiting');

    this.removeRoom(room);
    return ok(undefined);
  }

  /**
   * 방에서 나가요.
   * - 입장 요청을 기다리던 중이면 요청을 취소해요.
   * - 대기실의 방장이면 방을 닫아요.
   * - 대국 중이면 남은 사람이 이겨요(기권 처리). 재대결을 위해 방을 남기는 건 4단계에서 해요.
   */
  leave(socketId: string): Ack {
    return this.exit(socketId, 'left');
  }

  /** 연결이 끊긴 소켓을 정리해요. 30초 재접속 유예는 5단계에서 더해요. */
  disconnect(socketId: string): void {
    this.exit(socketId, 'disconnect');
  }

  /** 새로 만든 방이 위로 오게 정렬해요. */
  list(): RoomSummary[] {
    return [...this.rooms.values()].sort((a, b) => b.createdAt - a.createdAt).map(toSummary);
  }

  findByMember(socketId: string): Room | undefined {
    const roomId = this.roomIdByMember.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  /** 대국 중인 방에서 이 사람의 돌 색. 첫 판은 방장이 흑이에요. */
  stoneOf(room: Room, socketId: string): Stone | null {
    if (room.host.socketId === socketId) return 'black';
    if (room.guest?.socketId === socketId) return 'white';
    return null;
  }

  // ---- 입장 요청 ----

  requestJoin(socketId: string, roomId: string, nickname: string): Ack<JoinRequestTicket> {
    if (this.isBusy(socketId)) return fail('already-in-room');
    const room = this.rooms.get(roomId);
    if (!room) return fail('room-not-found');
    if (room.status !== 'waiting') return fail('room-not-waiting');

    const id = randomUUID();
    const request: JoinRequest = {
      id,
      socketId,
      nickname,
      expiresAt: Date.now() + JOIN_REQUEST_TTL_MS,
      timer: setTimeout(() => this.expire(room.id, id), JOIN_REQUEST_TTL_MS),
    };
    room.requests.set(id, request);
    this.pendingBySocket.set(socketId, { roomId: room.id, requestId: id });
    this.notifyRequests(room);

    return ok({ requestId: id, room: toSummary(room), remainingMs: JOIN_REQUEST_TTL_MS });
  }

  /** 참가자가 기다리다가 요청을 직접 취소해요. */
  cancelJoin(socketId: string): Ack {
    const pending = this.pendingBySocket.get(socketId);
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
    target.guest = { socketId: request.socketId, nickname: request.nickname };
    target.status = 'playing';
    this.roomIdByMember.set(request.socketId, target.id);
    this.emit({ type: 'join-resolved', socketId: request.socketId, resolution: 'accepted' });

    this.resolveAll(target, 'taken');
    this.notifyRequests(target);
    return ok(undefined);
  }

  reject(hostId: string, requestId: string): Ack {
    const room = this.hostedWaitingRoom(hostId);
    if (!room.ok) return room;
    const request = room.data.requests.get(requestId);
    if (!request) return fail('request-not-found');

    this.dropRequest(room.data, requestId);
    this.emit({ type: 'join-resolved', socketId: request.socketId, resolution: 'rejected' });
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
    this.emit({ type: 'join-resolved', socketId: request.socketId, resolution: 'expired' });
    this.notifyRequests(room);
  }

  private exit(socketId: string, reason: 'left' | 'disconnect'): Ack {
    if (this.pendingBySocket.has(socketId)) return this.cancelJoin(socketId);

    const room = this.findByMember(socketId);
    if (!room) return fail('not-in-room');

    if (room.status === 'playing') {
      const winner = room.host.socketId === socketId ? room.guest : room.host;
      if (winner) {
        this.emit({
          type: 'game-over',
          socketId: winner.socketId,
          payload: { winner: this.stoneOf(room, winner.socketId), reason, winningLine: null, moveCount: 0 },
        });
      }
    }
    this.removeRoom(room);
    return ok(undefined);
  }

  private hostedWaitingRoom(hostId: string): Ack<Room> {
    const room = this.findByMember(hostId);
    if (!room) return fail('not-in-room');
    if (room.host.socketId !== hostId) return fail('not-host');
    if (room.status !== 'waiting') return fail('room-not-waiting');
    return ok(room);
  }

  private isBusy(socketId: string): boolean {
    return this.roomIdByMember.has(socketId) || this.pendingBySocket.has(socketId);
  }

  private dropRequest(room: Room, requestId: string): void {
    const request = room.requests.get(requestId);
    if (!request) return;
    clearTimeout(request.timer);
    room.requests.delete(requestId);
    this.pendingBySocket.delete(request.socketId);
  }

  /** 남은 요청을 모두 같은 결과로 끝내요. */
  private resolveAll(room: Room, resolution: JoinResolution): void {
    for (const request of [...room.requests.values()]) {
      this.dropRequest(room, request.id);
      this.emit({ type: 'join-resolved', socketId: request.socketId, resolution });
    }
  }

  private clearRequests(room: Room): void {
    for (const request of room.requests.values()) clearTimeout(request.timer);
  }

  private removeRoom(room: Room): void {
    this.resolveAll(room, 'room-closed');
    this.rooms.delete(room.id);
    this.roomIdByMember.delete(room.host.socketId);
    if (room.guest) this.roomIdByMember.delete(room.guest.socketId);
  }

  private notifyRequests(room: Room): void {
    this.emit({ type: 'requests-changed', hostId: room.host.socketId, requests: this.pendingRequests(room) });
  }

  private emit(event: RoomEvent): void {
    this.listener(event);
  }
}

export const toSummary = (room: Room): RoomSummary => ({
  id: room.id,
  hostNickname: room.host.nickname,
  createdAt: room.createdAt,
  status: room.status,
});
