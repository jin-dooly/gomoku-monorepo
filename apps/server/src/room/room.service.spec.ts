import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECONNECT_GRACE_MS, type Position, type Stone } from '@gomoku/shared';
import { JOIN_REQUEST_TTL_MS, MAX_PENDING_REQUESTS_PER_ROOM, MAX_ROOMS, RoomEvent, RoomService } from './room.service';

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

  const requestJoin = (roomId: string, playerId: string, nickname: string) => {
    const result = service.requestJoin(playerId, roomId, nickname);
    if (!result.ok) throw new Error(result.error);
    return result.data.requestId;
  };

  const resolutions = () =>
    events.flatMap((e) => (e.type === 'join-resolved' ? [[e.playerId, e.resolution]] : []));

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

    it('방장의 연결이 끊기고 30초가 지나면 방이 사라져요', () => {
      openRoom();
      service.create('host-2', '도윤');

      service.disconnect('host-1');
      expect(service.list()).toHaveLength(2);
      vi.advanceTimersByTime(RECONNECT_GRACE_MS);

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

    it('방장의 연결이 끊기고 30초가 지나면 기다리던 참가자에게 방 닫힘을 알려요', () => {
      const roomId = openRoom();
      requestJoin(roomId, 'guest-1', '도윤');

      service.disconnect('host-1');
      vi.advanceTimersByTime(RECONNECT_GRACE_MS);

      expect(resolutions()).toEqual([['guest-1', 'room-closed']]);
    });

    it('요청한 참가자의 연결이 끊기면 요청이 취소돼요', () => {
      const roomId = openRoom();
      requestJoin(roomId, 'guest-1', '도윤');

      service.disconnect('guest-1');

      expect(lastRequestsForHost()).toEqual([]);
    });
  });

  /** 지니(host-1, 흑)와 도윤(guest-1, 백)의 대국을 시작해요. */
  const startMatch = () => {
    const roomId = openRoom();
    service.accept('host-1', requestJoin(roomId, 'guest-1', '도윤'));
    events = [];
  };

  const SOCKET: Record<Stone, string> = { black: 'host-1', white: 'guest-1' };
  /** 흑부터 번갈아 둬요. 실패하면 바로 알려줘요. */
  const play = (...moves: [number, number][]) => {
    moves.forEach(([row, col], i) => {
      const result = service.move(SOCKET[i % 2 === 0 ? 'black' : 'white'], { row, col });
      if (!result.ok) throw new Error(`${i + 1}수 (${row},${col}): ${result.error}`);
    });
  };
  const statesFor = (playerId: string) =>
    events.flatMap((e) => (e.type === 'game-state' && e.playerId === playerId ? [e.payload] : []));
  const overs = () => events.flatMap((e) => (e.type === 'game-over' ? [[e.playerId, e.payload] as const] : []));

  describe('대국', () => {
    it('수락하면 두 사람에게 첫 판 상태를 보내요. 방장이 흑이고 먼저 둬요', () => {
      const roomId = openRoom();
      service.accept('host-1', requestJoin(roomId, 'guest-1', '도윤'));

      const [host] = statesFor('host-1');
      const [guest] = statesFor('guest-1');
      expect(host).toMatchObject({
        roomId,
        hostNickname: '지니',
        players: { black: { nickname: '지니' }, white: { nickname: '도윤' } },
        you: 'black',
        turn: 'black',
        moveCount: 0,
        lastMove: null,
      });
      expect(host.board.flat().every((c) => c === null)).toBe(true);
      expect(guest.you).toBe('white');
    });

    it('두면 두 사람 모두에게 새 판, 다음 차례, 수 수, 마지막 수를 보내요', () => {
      startMatch();

      play([7, 7]);

      for (const playerId of ['host-1', 'guest-1']) {
        const [state] = statesFor(playerId);
        expect(state.board[7][7]).toBe('black');
        expect(state).toMatchObject({ turn: 'white', moveCount: 1, lastMove: { row: 7, col: 7, stone: 'black' } });
      }
    });

    it('내 차례가 아니면 둘 수 없어요', () => {
      startMatch();
      expect(service.move('guest-1', { row: 7, col: 7 })).toEqual({ ok: false, error: 'not-your-turn' });

      play([7, 7]);
      expect(service.move('host-1', { row: 7, col: 8 })).toEqual({ ok: false, error: 'not-your-turn' });
    });

    it('돌이 있는 자리에는 둘 수 없고, 차례도 넘어가지 않아요', () => {
      startMatch();
      play([7, 7]);

      expect(service.move('guest-1', { row: 7, col: 7 })).toEqual({ ok: false, error: 'occupied' });
      expect(service.move('guest-1', { row: 7, col: 8 }).ok).toBe(true);
    });

    it('대국 중인 방에 없으면 둘 수 없어요', () => {
      expect(service.move('nobody', { row: 0, col: 0 })).toEqual({ ok: false, error: 'not-in-room' });
      openRoom();
      expect(service.move('host-1', { row: 0, col: 0 })).toEqual({ ok: false, error: 'game-not-playing' });
    });

    it('5목을 완성하면 두 사람에게 승자와 이긴 줄을 보내고, 더는 둘 수 없어요', () => {
      startMatch();
      // 흑이 7행에 3~7열, 백은 0행에 둬요. 9수째 흑이 가로 5목.
      play([7, 3], [0, 0], [7, 4], [0, 1], [7, 5], [0, 2], [7, 6], [0, 3], [7, 7]);

      const expected = {
        winner: 'black',
        reason: 'five',
        winningLine: { direction: 'horizontal', stones: [3, 4, 5, 6, 7].map((col): Position => ({ row: 7, col })) },
        moveCount: 9,
      };
      expect(overs()).toEqual([
        ['host-1', expected],
        ['guest-1', expected],
      ]);
      expect(statesFor('host-1').at(-1)).toMatchObject({ moveCount: 9, lastMove: { row: 7, col: 7, stone: 'black' } });
      expect(service.move('guest-1', { row: 1, col: 1 })).toEqual({ ok: false, error: 'game-not-playing' });
    });

    it('판이 가득 찰 때까지 5목이 없으면 무승부예요', () => {
      startMatch();
      // 마지막 한 칸만 남은 판을 만들어요. 2칸씩 색을 번갈아 채워서 어느 방향으로도 5목이 없어요.
      const game = service.findByMember('host-1')!.game!;
      game.board = game.board.map((row, r) =>
        row.map((_, c): Stone | null => (r === 14 && c === 14 ? null : Math.floor((r + c) / 2) % 2 === 0 ? 'black' : 'white')),
      );
      game.moveCount = 224;
      game.turn = 'black';

      play([14, 14]);

      expect(overs().map(([, p]) => p)).toEqual([
        { winner: null, reason: 'draw', winningLine: null, moveCount: 225 },
        { winner: null, reason: 'draw', winningLine: null, moveCount: 225 },
      ]);
    });
  });

  /** 9수째 흑(host-1)이 7행 가로 5목으로 이기는 판 */
  const FIVE_IN_A_ROW: [number, number][] = [[7, 3], [0, 0], [7, 4], [0, 1], [7, 5], [0, 2], [7, 6], [0, 3], [7, 7]];
  const finishMatch = () => {
    startMatch();
    play(...FIVE_IN_A_ROW);
    events = [];
  };
  const leftNotices = () => events.flatMap((e) => (e.type === 'opponent-left' ? [[e.playerId, e.payload.reason]] : []));
  const rematchStatuses = () =>
    events.flatMap((e) => (e.type === 'rematch-status' ? [[e.playerId, e.requestedBy]] : []));

  describe('두는 중에 나가기', () => {
    it('참가자가 나가면 방장이 이기고, 방장은 방에 남아요', () => {
      startMatch();

      expect(service.leave('guest-1').ok).toBe(true);

      expect(events).toEqual([
        {
          type: 'game-over',
          playerId: 'host-1',
          payload: { winner: 'black', reason: 'left', winningLine: null, moveCount: 0 },
        },
      ]);
      expect(service.findByMember('host-1')?.guest).toBeNull();
      expect(service.findByMember('guest-1')).toBeUndefined();
    });

    it('방장의 연결이 끊기고 30초 안에 돌아오지 않으면 참가자가 이기고 방이 사라져요', () => {
      startMatch();

      service.disconnect('host-1');
      vi.advanceTimersByTime(RECONNECT_GRACE_MS);

      expect(overs()).toEqual([['guest-1', { winner: 'white', reason: 'disconnect', winningLine: null, moveCount: 0 }]]);
      expect(service.list()).toEqual([]);
      expect(service.findByMember('guest-1')).toBeUndefined();
    });

    it('둔 수가 있으면 그 수 수를 보내요', () => {
      startMatch();
      play([7, 7], [7, 8], [8, 8]);
      events = [];

      service.leave('host-1');

      expect(overs()).toEqual([['guest-1', { winner: 'white', reason: 'left', winningLine: null, moveCount: 3 }]]);
    });
  });

  describe('기권', () => {
    it('기권하면 이번 판만 상대 승리로 끝나고, 두 사람 모두 방에 남아요', () => {
      startMatch();
      play([7, 7], [7, 8]);
      events = [];

      expect(service.resign('host-1')).toEqual({ ok: true, data: undefined });

      const expected = { winner: 'white', reason: 'resign', winningLine: null, moveCount: 2 };
      expect(overs()).toEqual([
        ['host-1', expected],
        ['guest-1', expected],
      ]);
      expect(service.findByMember('host-1')).toBe(service.findByMember('guest-1'));
      expect(service.move('guest-1', { row: 0, col: 0 })).toEqual({ ok: false, error: 'game-not-playing' });
    });

    it('끝난 판이나 대기실에서는 기권할 수 없어요', () => {
      openRoom();
      expect(service.resign('host-1')).toEqual({ ok: false, error: 'game-not-playing' });
      expect(service.resign('nobody')).toEqual({ ok: false, error: 'not-in-room' });
    });

    it('이미 끝난 판에서는 다시 기권할 수 없어요', () => {
      finishMatch();
      expect(service.resign('guest-1')).toEqual({ ok: false, error: 'game-not-playing' });
    });
  });

  describe('재대결', () => {
    it('한 사람이 요청하면 두 사람에게 요청 상태를 알리고, 다시 요청해도 그대로예요', () => {
      finishMatch();

      expect(service.requestRematch('guest-1').ok).toBe(true);
      expect(service.requestRematch('guest-1').ok).toBe(true);

      expect(rematchStatuses()).toEqual([
        ['host-1', ['white']],
        ['guest-1', ['white']],
        ['host-1', ['white']],
        ['guest-1', ['white']],
      ]);
      expect(statesFor('host-1')).toEqual([]);
    });

    it('두 사람이 모두 요청하면 흑과 백을 바꿔 새 판을 시작해요', () => {
      finishMatch();

      service.requestRematch('guest-1');
      service.requestRematch('host-1');

      const [host] = statesFor('host-1');
      const [guest] = statesFor('guest-1');
      expect(host).toMatchObject({
        you: 'white',
        turn: 'black',
        moveCount: 0,
        lastMove: null,
        players: { black: { nickname: '도윤' }, white: { nickname: '지니' } },
      });
      expect(guest.you).toBe('black');
      expect(host.board.flat().every((c) => c === null)).toBe(true);

      // 이번 판은 도윤(guest-1)이 흑이라 먼저 둬요.
      expect(service.move('host-1', { row: 7, col: 7 })).toEqual({ ok: false, error: 'not-your-turn' });
      expect(service.move('guest-1', { row: 7, col: 7 }).ok).toBe(true);
    });

    it('새 판이 끝나면 지난 요청은 남아 있지 않아요', () => {
      finishMatch();
      service.requestRematch('guest-1');
      service.requestRematch('host-1');
      // 두 번째 판: 도윤(guest-1)이 흑
      service.resign('host-1');
      events = [];

      service.requestRematch('host-1');

      expect(rematchStatuses()).toEqual([
        ['host-1', ['white']],
        ['guest-1', ['white']],
      ]);
    });

    it('두는 중이나 대국 전에는 요청할 수 없어요', () => {
      openRoom();
      expect(service.requestRematch('host-1')).toEqual({ ok: false, error: 'game-not-playing' });
      service.close('host-1');

      startMatch();
      expect(service.requestRematch('host-1')).toEqual({ ok: false, error: 'game-in-progress' });
    });
  });

  describe('결과 화면에서 나가기', () => {
    it('참가자가 나가면 방장에게 알리고, 방장은 방에 남지만 재대결은 할 수 없어요', () => {
      finishMatch();

      service.leave('guest-1');

      expect(leftNotices()).toEqual([['host-1', 'left']]);
      expect(overs()).toEqual([]);
      expect(service.requestRematch('host-1')).toEqual({ ok: false, error: 'no-opponent' });
      // 방은 남지만 방장이 대기실로 돌아가기 전까지는 입장 요청을 받지 않아요.
      expect(service.list()).toEqual([expect.objectContaining({ status: 'playing' })]);
    });

    it('방장이 나가면 참가자에게 알리고 방이 사라져요', () => {
      finishMatch();

      service.leave('host-1');

      expect(leftNotices()).toEqual([['guest-1', 'left']]);
      expect(service.list()).toEqual([]);
      expect(service.findByMember('guest-1')).toBeUndefined();
    });

    it('연결이 끊기고 30초가 지나면 이유가 연결 끊김으로 가요', () => {
      finishMatch();

      service.disconnect('guest-1');
      vi.advanceTimersByTime(RECONNECT_GRACE_MS);

      expect(leftNotices()).toEqual([['host-1', 'disconnect']]);
    });

    it('재대결을 요청해 둔 상대가 나가면 요청은 사라져요', () => {
      finishMatch();
      service.requestRematch('guest-1');
      service.leave('guest-1');

      expect(service.requestRematch('host-1')).toEqual({ ok: false, error: 'no-opponent' });
    });
  });

  describe('대기실로 돌아가기', () => {
    it('상대가 나간 뒤 방장이 돌아가면 방이 다시 대기 중이 되고 새 요청을 받아요', () => {
      finishMatch();
      service.leave('guest-1');

      const reopened = service.reopen('host-1');

      expect(reopened).toMatchObject({ ok: true, data: { hostNickname: '지니', status: 'waiting' } });
      const roomId = reopened.ok ? reopened.data.id : '';
      expect(service.requestJoin('guest-2', roomId, '하람').ok).toBe(true);
      expect(lastRequestsForHost()).toEqual(['하람']);
    });

    it('나갔던 참가자도 다시 요청할 수 있어요', () => {
      finishMatch();
      service.leave('guest-1');
      const reopened = service.reopen('host-1');

      expect(service.requestJoin('guest-1', reopened.ok ? reopened.data.id : '', '도윤').ok).toBe(true);
    });

    it('상대가 아직 있거나, 방장이 아니면 돌아갈 수 없어요', () => {
      finishMatch();
      expect(service.reopen('host-1')).toEqual({ ok: false, error: 'opponent-present' });
      expect(service.reopen('guest-1')).toEqual({ ok: false, error: 'not-host' });
      expect(service.reopen('nobody')).toEqual({ ok: false, error: 'not-in-room' });
    });
  });

  describe('연결 끊김과 재접속', () => {
    const disconnectNotices = () =>
      events.flatMap((e) => (e.type === 'opponent-disconnected' ? [[e.playerId, e.remainingMs]] : []));
    const reconnectNotices = () => events.flatMap((e) => (e.type === 'opponent-reconnected' ? [e.playerId] : []));
    const resumes = (playerId: string) =>
      events.flatMap((e) => (e.type === 'resume' && e.playerId === playerId ? [e.payload] : []));

    it('대국 중에 끊기면 상대에게 30초 기다린다고 알리고, 그 안에 돌아오면 이어서 둬요', () => {
      startMatch();
      play([7, 7]);
      events = [];

      service.disconnect('guest-1');
      expect(disconnectNotices()).toEqual([['host-1', RECONNECT_GRACE_MS]]);

      vi.advanceTimersByTime(RECONNECT_GRACE_MS - 1000);
      service.connect('guest-1');

      expect(reconnectNotices()).toEqual(['host-1']);
      const [resume] = resumes('guest-1');
      expect(resume).toMatchObject({
        role: 'guest',
        room: { hostNickname: '지니', status: 'playing' },
        game: { you: 'white', turn: 'white', moveCount: 1 },
        over: null,
        opponentDisconnected: null,
      });

      vi.advanceTimersByTime(RECONNECT_GRACE_MS);
      expect(overs()).toEqual([]);
      expect(service.move('guest-1', { row: 7, col: 8 }).ok).toBe(true);
    });

    it('기다리는 동안 남은 사람이 다시 연결하면 남은 시간도 함께 받아요', () => {
      startMatch();
      service.disconnect('guest-1');
      vi.advanceTimersByTime(12_000);

      service.connect('host-1');

      expect(resumes('host-1')[0].opponentDisconnected).toEqual({ remainingMs: RECONNECT_GRACE_MS - 12_000 });
    });

    it('연결이 끊긴 동안 두 번 끊김을 받아도 타이머는 하나예요', () => {
      startMatch();
      service.disconnect('guest-1');
      vi.advanceTimersByTime(10_000);
      service.disconnect('guest-1');

      vi.advanceTimersByTime(RECONNECT_GRACE_MS - 10_000);
      expect(overs()).toHaveLength(1);
    });

    it('기다리던 상대를 두고 남은 사람이 나가면 남은 사람이 기권한 거예요', () => {
      startMatch();
      service.disconnect('guest-1');

      service.leave('host-1');
      vi.advanceTimersByTime(RECONNECT_GRACE_MS);

      expect(overs()).toEqual([['guest-1', { winner: 'white', reason: 'left', winningLine: null, moveCount: 0 }]]);
    });

    it('방장이 대기실에서 새로고침해도 방과 입장 요청이 그대로예요', () => {
      const roomId = openRoom();
      requestJoin(roomId, 'guest-1', '도윤');
      events = [];

      service.disconnect('host-1');
      service.connect('host-1');
      vi.advanceTimersByTime(RECONNECT_GRACE_MS);

      expect(resolutions()).toEqual([]);
      const [resume] = resumes('host-1');
      expect(resume).toMatchObject({ role: 'host', room: { status: 'waiting' }, game: null });
      expect(resume.requests.map((r) => r.nickname)).toEqual(['도윤']);
    });

    it('결과 화면에서 다시 연결하면 결과와 재대결 요청도 받아요', () => {
      finishMatch();
      service.requestRematch('guest-1');

      service.connect('host-1');

      expect(resumes('host-1')[0]).toMatchObject({
        over: { winner: 'black', reason: 'five', moveCount: 9 },
        rematch: ['white'],
        opponentLeft: null,
      });
    });

    it('참가자가 떠난 결과 화면에서 다시 연결한 방장은 재대결할 수 없다는 걸 받아요', () => {
      finishMatch();
      service.leave('guest-1');

      service.connect('host-1');

      expect(resumes('host-1')[0]).toMatchObject({ opponentLeft: 'left', rematch: [] });
    });

    it('방 밖에 있는 사람은 연결해도 받을 게 없어요', () => {
      service.connect('someone');
      expect(events).toEqual([]);
    });
  });

  describe('남용 방지 한도', () => {
    it('열린 방이 한도에 닿으면 새 방을 만들 수 없어요', () => {
      for (let i = 0; i < MAX_ROOMS; i++) service.create(`h-${i}`, '방장');

      expect(service.create('one-more', '지니')).toEqual({ ok: false, error: 'too-many-rooms' });
    });

    it('한 방에 기다리는 요청이 한도에 닿으면 더 받지 않아요', () => {
      const roomId = openRoom();
      for (let i = 0; i < MAX_PENDING_REQUESTS_PER_ROOM; i++) requestJoin(roomId, `g-${i}`, '도전자');

      expect(service.requestJoin('late', roomId, '하람')).toEqual({ ok: false, error: 'too-many-requests' });
    });
  });
});
