import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JOIN_REQUEST_TTL_MS, RoomEvent, RoomService } from './room.service';

describe('RoomService', () => {
  let service: RoomService;
  let events: RoomEvent[];

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-18T05:32:07Z') });
    service = new RoomService();
    events = [];
    service.onEvent((e) => events.push(e));
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  /** 방장 host-1이 '지니' 방을 만들고 방 ID를 돌려줘요. */
  const openRoom = () => {
    const result = service.create('host-1', '지니');
    if (!result.ok) throw new Error(result.error);
    return result.data.id;
  };

  const requestJoin = (roomId: string, socketId: string, nickname: string) => {
    const result = service.requestJoin(socketId, roomId, nickname);
    if (!result.ok) throw new Error(result.error);
    return result.data.requestId;
  };

  const resolutions = () =>
    events.flatMap((e) => (e.type === 'join-resolved' ? [[e.socketId, e.resolution]] : []));

  const lastRequestsForHost = () => {
    const changes = events.filter((e) => e.type === 'requests-changed');
    const last = changes[changes.length - 1];
    return last?.type === 'requests-changed' ? last.requests.map((r) => r.nickname) : null;
  };

  describe('방', () => {
    it('방을 만들면 대기 중인 방이 목록에 보여요', () => {
      const result = service.create('host-1', '지니');

      expect(result).toEqual({
        ok: true,
        data: {
          id: expect.any(String),
          hostNickname: '지니',
          createdAt: new Date('2026-10-18T05:32:07Z').getTime(),
          status: 'waiting',
        },
      });
      expect(service.list()).toHaveLength(1);
    });

    it('한 사람은 방을 하나만 만들 수 있어요', () => {
      openRoom();
      expect(service.create('host-1', '지니')).toEqual({ ok: false, error: 'already-in-room' });
    });

    it('닉네임이 같아도 다른 방으로 만들어져요', () => {
      service.create('host-1', '도윤');
      service.create('host-2', '도윤');

      const [a, b] = service.list();
      expect(a.hostNickname).toBe('도윤');
      expect(b.hostNickname).toBe('도윤');
      expect(a.id).not.toBe(b.id);
    });

    it('새로 만든 방이 목록 위에 와요', () => {
      service.create('host-1', '먼저');
      vi.advanceTimersByTime(1000);
      service.create('host-2', '나중');

      expect(service.list().map((r) => r.hostNickname)).toEqual(['나중', '먼저']);
    });

    it('방장이 방을 닫으면 목록에서 사라지고 다시 방을 만들 수 있어요', () => {
      openRoom();

      expect(service.close('host-1')).toEqual({ ok: true, data: undefined });
      expect(service.list()).toEqual([]);
      expect(service.create('host-1', '지니').ok).toBe(true);
    });

    it('방에 없는 사람은 방을 닫을 수 없어요', () => {
      expect(service.close('nobody')).toEqual({ ok: false, error: 'not-in-room' });
    });

    it('방장의 연결이 끊기면 방이 사라져요', () => {
      openRoom();
      service.create('host-2', '도윤');

      service.disconnect('host-1');

      expect(service.list().map((r) => r.hostNickname)).toEqual(['도윤']);
      expect(service.findByMember('host-1')).toBeUndefined();
    });

    it('방에 없는 소켓의 연결이 끊겨도 아무 일도 없어요', () => {
      openRoom();
      service.disconnect('stranger');
      expect(service.list()).toHaveLength(1);
    });
  });

  describe('입장 요청', () => {
    it('요청하면 방장에게 요청 목록이 가고, 참가자는 60초짜리 표를 받아요', () => {
      const roomId = openRoom();

      const result = service.requestJoin('guest-1', roomId, '도윤');

      expect(result).toMatchObject({ ok: true, data: { remainingMs: JOIN_REQUEST_TTL_MS, room: { hostNickname: '지니' } } });
      expect(events).toContainEqual({
        type: 'requests-changed',
        hostId: 'host-1',
        requests: [{ requestId: expect.any(String), nickname: '도윤', remainingMs: JOIN_REQUEST_TTL_MS }],
      });
    });

    it('없는 방, 내 방, 대국 중인 방에는 요청할 수 없어요', () => {
      const roomId = openRoom();
      expect(service.requestJoin('guest-1', 'nope', '도윤')).toEqual({ ok: false, error: 'room-not-found' });
      expect(service.requestJoin('host-1', roomId, '지니')).toEqual({ ok: false, error: 'already-in-room' });

      service.accept('host-1', requestJoin(roomId, 'guest-1', '도윤'));
      expect(service.requestJoin('guest-2', roomId, '하람')).toEqual({ ok: false, error: 'room-not-waiting' });
    });

    it('요청을 기다리는 동안에는 다른 요청을 보내거나 방을 만들 수 없어요', () => {
      const roomId = openRoom();
      const other = service.create('host-2', '하람');
      requestJoin(roomId, 'guest-1', '도윤');

      expect(service.requestJoin('guest-1', other.ok ? other.data.id : '', '도윤')).toEqual({
        ok: false,
        error: 'already-in-room',
      });
      expect(service.create('guest-1', '도윤')).toEqual({ ok: false, error: 'already-in-room' });
    });

    it('남은 시간은 기다린 만큼 줄어서 보여요', () => {
      const roomId = openRoom();
      requestJoin(roomId, 'guest-1', '도윤');
      vi.advanceTimersByTime(12_000);
      requestJoin(roomId, 'guest-2', '하람');

      const room = service.findByMember('host-1')!;
      expect(service.pendingRequests(room).map((r) => [r.nickname, r.remainingMs])).toEqual([
        ['도윤', 48_000],
        ['하람', 60_000],
      ]);
    });

    it('60초 안에 답하지 않으면 자동으로 취소되고 참가자에게 시간 초과를 알려요', () => {
      const roomId = openRoom();
      requestJoin(roomId, 'guest-1', '도윤');

      vi.advanceTimersByTime(JOIN_REQUEST_TTL_MS - 1);
      expect(resolutions()).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(resolutions()).toEqual([['guest-1', 'expired']]);
      expect(lastRequestsForHost()).toEqual([]);
      // 끝난 뒤에는 다시 요청할 수 있어요
      expect(service.requestJoin('guest-1', roomId, '도윤').ok).toBe(true);
    });

    it('참가자가 요청을 취소하면 방장 목록에서 빠져요', () => {
      const roomId = openRoom();
      requestJoin(roomId, 'guest-1', '도윤');

      expect(service.cancelJoin('guest-1')).toEqual({ ok: true, data: undefined });
      expect(lastRequestsForHost()).toEqual([]);
      expect(resolutions()).toEqual([]);

      // 취소한 요청은 60초가 지나도 다시 끝나지 않아요
      vi.advanceTimersByTime(JOIN_REQUEST_TTL_MS);
      expect(resolutions()).toEqual([]);
    });

    it('기다리는 요청이 없으면 취소할 수 없어요', () => {
      expect(service.cancelJoin('guest-1')).toEqual({ ok: false, error: 'request-not-found' });
    });

    it('방장이 거절하면 참가자에게 거절을 알려요', () => {
      const roomId = openRoom();
      const requestId = requestJoin(roomId, 'guest-1', '도윤');

      expect(service.reject('host-1', requestId).ok).toBe(true);
      expect(resolutions()).toEqual([['guest-1', 'rejected']]);
      expect(lastRequestsForHost()).toEqual([]);
    });

    it('방장만 수락하거나 거절할 수 있어요', () => {
      const roomId = openRoom();
      const requestId = requestJoin(roomId, 'guest-1', '도윤');

      expect(service.accept('guest-1', requestId)).toEqual({ ok: false, error: 'not-in-room' });
      expect(service.reject('nobody', requestId)).toEqual({ ok: false, error: 'not-in-room' });
      expect(service.accept('host-1', 'missing')).toEqual({ ok: false, error: 'request-not-found' });
    });

    it('한 명을 수락하면 대국이 시작되고 나머지는 모두 자동으로 거절돼요', () => {
      const roomId = openRoom();
      requestJoin(roomId, 'guest-1', '도윤');
      const chosen = requestJoin(roomId, 'guest-2', '하람');
      requestJoin(roomId, 'guest-3', '별빛');

      expect(service.accept('host-1', chosen).ok).toBe(true);

      expect(resolutions()).toEqual([
        ['guest-2', 'accepted'],
        ['guest-1', 'taken'],
        ['guest-3', 'taken'],
      ]);
      expect(lastRequestsForHost()).toEqual([]);
      expect(service.list()).toEqual([expect.objectContaining({ status: 'playing' })]);

      const room = service.findByMember('guest-2')!;
      expect(service.stoneOf(room, 'host-1')).toBe('black');
      expect(service.stoneOf(room, 'guest-2')).toBe('white');

      // 수락 뒤에는 남은 타이머가 아무것도 하지 않아요
      vi.advanceTimersByTime(JOIN_REQUEST_TTL_MS);
      expect(resolutions()).toHaveLength(3);
    });

    it('방장이 방을 닫으면 기다리던 참가자에게 방 닫힘을 알려요', () => {
      const roomId = openRoom();
      requestJoin(roomId, 'guest-1', '도윤');
      requestJoin(roomId, 'guest-2', '하람');

      service.close('host-1');

      expect(resolutions()).toEqual([
        ['guest-1', 'room-closed'],
        ['guest-2', 'room-closed'],
      ]);
    });

    it('방장의 연결이 끊겨도 기다리던 참가자에게 방 닫힘을 알려요', () => {
      const roomId = openRoom();
      requestJoin(roomId, 'guest-1', '도윤');

      service.disconnect('host-1');

      expect(resolutions()).toEqual([['guest-1', 'room-closed']]);
    });

    it('요청한 참가자의 연결이 끊기면 요청이 취소돼요', () => {
      const roomId = openRoom();
      requestJoin(roomId, 'guest-1', '도윤');

      service.disconnect('guest-1');

      expect(lastRequestsForHost()).toEqual([]);
    });
  });

  describe('대국 중 나가기', () => {
    const startMatch = () => {
      const roomId = openRoom();
      service.accept('host-1', requestJoin(roomId, 'guest-1', '도윤'));
      events = [];
    };

    it('참가자가 나가면 방장이 이기고 방이 사라져요', () => {
      startMatch();

      expect(service.leave('guest-1').ok).toBe(true);

      expect(events).toEqual([
        {
          type: 'game-over',
          socketId: 'host-1',
          payload: { winner: 'black', reason: 'left', winningLine: null, moveCount: 0 },
        },
      ]);
      expect(service.list()).toEqual([]);
      expect(service.findByMember('host-1')).toBeUndefined();
    });

    it('방장의 연결이 끊기면 참가자가 이겨요', () => {
      startMatch();

      service.disconnect('host-1');

      expect(events).toEqual([
        {
          type: 'game-over',
          socketId: 'guest-1',
          payload: { winner: 'white', reason: 'disconnect', winningLine: null, moveCount: 0 },
        },
      ]);
    });
  });
});
