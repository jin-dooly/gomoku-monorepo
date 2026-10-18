import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Ack, ErrorCode, RoomStatus, RoomSummary } from '@gomoku/shared';

/**
 * 방 상태를 메모리에 둬요 (docs/ux-spec.md 3장 "방과 입장").
 * 소켓을 모르는 순수한 상태 관리만 해서 단위 테스트로 검증해요.
 * 입장 요청(2단계), 대국(3단계), 연결 끊김 유예(5단계)는 이 구조에 이어 붙여요.
 */
export type Room = {
  id: string;
  /** 방장의 소켓 ID. 방장은 흑을 잡아요. */
  hostId: string;
  /** 방 이름이에요. 중복을 허용해요. */
  hostNickname: string;
  createdAt: number;
  status: RoomStatus;
};

const ok = <T>(data: T): Ack<T> => ({ ok: true, data });
const fail = <T>(error: ErrorCode): Ack<T> => ({ ok: false, error });

@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, Room>();
  /** 소켓마다 속한 방. 한 사람은 방 하나에만 있을 수 있어요. */
  private readonly roomIdBySocket = new Map<string, string>();

  create(socketId: string, nickname: string): Ack<RoomSummary> {
    if (this.roomIdBySocket.has(socketId)) return fail('already-in-room');

    const room: Room = {
      id: randomUUID(),
      hostId: socketId,
      hostNickname: nickname,
      createdAt: Date.now(),
      status: 'waiting',
    };
    this.rooms.set(room.id, room);
    this.roomIdBySocket.set(socketId, room.id);
    return ok(toSummary(room));
  }

  /** 방장이 대기실에서 방을 닫아요. 대국 중에는 `leave`로 나가야 해요(기권 처리). */
  close(socketId: string): Ack {
    const room = this.findBySocket(socketId);
    if (!room) return fail('not-in-room');
    if (room.hostId !== socketId) return fail('not-host');
    if (room.status !== 'waiting') return fail('room-not-waiting');

    this.remove(room);
    return ok(undefined);
  }

  /** 방에서 나가요. 방장이 나가면 방이 사라져요. */
  leave(socketId: string): Ack {
    const room = this.findBySocket(socketId);
    if (!room) return fail('not-in-room');

    // 지금은 방에 방장만 있어요. 참가자 처리는 2단계, 대국 중 기권 처리는 4단계에서 더해요.
    if (room.hostId === socketId) this.remove(room);
    return ok(undefined);
  }

  /** 연결이 끊긴 소켓을 정리해요. 30초 재접속 유예는 5단계에서 더해요. */
  disconnect(socketId: string): void {
    this.leave(socketId);
  }

  /** 새로 만든 방이 위로 오게 정렬해요. */
  list(): RoomSummary[] {
    return [...this.rooms.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(toSummary);
  }

  findBySocket(socketId: string): Room | undefined {
    const roomId = this.roomIdBySocket.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  private remove(room: Room): void {
    this.rooms.delete(room.id);
    this.roomIdBySocket.delete(room.hostId);
  }
}

export const toSummary = (room: Room): RoomSummary => ({
  id: room.id,
  hostNickname: room.hostNickname,
  createdAt: room.createdAt,
  status: room.status,
});
