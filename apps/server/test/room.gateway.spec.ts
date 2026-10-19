import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '@gomoku/shared';
import { RoomGateway } from '../src/room/room.gateway';
import { RoomService } from '../src/room/room.service';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * 실제 Nest 서버를 띄우고 두세 명이 접속해서 이벤트가 맞는 사람에게 가는지 확인해요.
 * 로직 자체는 room.service.spec.ts에서 검증하고, 여기서는 소켓 연결만 봐요.
 */
describe('RoomGateway (소켓 통합)', () => {
  let app: INestApplication;
  let url: string;
  const clients: Client[] = [];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [RoomGateway, RoomService] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0);
    // Windows에서 localhost는 IPv6를 먼저 시도하느라 느려서 IPv4 주소로 바로 붙어요.
    url = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.disconnect());
    await app.close();
  });

  /** 연결하고 서버가 준 세션 ID까지 받아요. sessionId를 주면 그 세션으로 다시 연결해요(새로고침 흉내). */
  const connectSession = async (sessionId?: string): Promise<{ client: Client; sessionId: string }> => {
    const client: Client = io(url, { transports: ['websocket'], forceNew: true, auth: sessionId ? { sessionId } : {} });
    clients.push(client);
    const assigned = await new Promise<string>((resolve, reject) => {
      client.once('session:assigned', (p) => resolve(p.sessionId));
      client.once('connect_error', reject);
    });
    return { client, sessionId: assigned };
  };

  const connect = async (): Promise<Client> => (await connectSession()).client;

  const next = <E extends keyof ServerToClientEvents>(client: Client, event: E) =>
    new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve) => {
      client.once(event, ((payload: Parameters<ServerToClientEvents[E]>[0]) => resolve(payload)) as never);
    });

  it('방을 만들면 다른 사람의 방 목록에 보여요', async () => {
    const host = await connect();
    const guest = await connect();

    const created = await host.emitWithAck('room:create', { nickname: '지니' });
    const listed = await guest.emitWithAck('room:list');

    expect(created.ok).toBe(true);
    expect(listed).toEqual({ ok: true, data: [expect.objectContaining({ hostNickname: '지니', status: 'waiting' })] });
  });

  it('잘못된 닉네임은 서버도 거절해요', async () => {
    const host = await connect();
    expect(await host.emitWithAck('room:create', { nickname: '지' })).toEqual({ ok: false, error: 'invalid-payload' });
  });

  it('요청 → 방장에게 목록 → 수락하면 참가자는 수락, 다른 참가자는 다른 상대와 시작을 받아요', async () => {
    const host = await connect();
    const guest = await connect();
    const other = await connect();
    const created = await host.emitWithAck('room:create', { nickname: '지니' });
    if (!created.ok) throw new Error(created.error);

    const firstList = next(host, 'join:requests');
    const ticket = await guest.emitWithAck('join:request', { roomId: created.data.id, nickname: '도윤' });
    expect(ticket).toMatchObject({ ok: true, data: { remainingMs: 60_000 } });
    expect(await firstList).toEqual([expect.objectContaining({ nickname: '도윤' })]);

    const secondList = next(host, 'join:requests');
    await other.emitWithAck('join:request', { roomId: created.data.id, nickname: '하람' });
    const requests = await secondList;
    const doyun = requests.find((r) => r.nickname === '도윤')!;

    const guestResult = next(guest, 'join:resolved');
    const otherResult = next(other, 'join:resolved');
    expect(await host.emitWithAck('join:accept', { requestId: doyun.requestId })).toEqual({ ok: true, data: undefined });

    expect(await guestResult).toEqual({ resolution: 'accepted' });
    expect(await otherResult).toEqual({ resolution: 'taken' });

    const listed = await other.emitWithAck('room:list');
    expect(listed).toEqual({ ok: true, data: [expect.objectContaining({ status: 'playing' })] });
  });

  it('방장이 방을 닫으면 기다리던 참가자는 방 닫힘을 받아요', async () => {
    const host = await connect();
    const guest = await connect();
    const created = await host.emitWithAck('room:create', { nickname: '지니' });
    if (!created.ok) throw new Error(created.error);
    await guest.emitWithAck('join:request', { roomId: created.data.id, nickname: '도윤' });

    const result = next(guest, 'join:resolved');
    await host.emitWithAck('room:close');

    expect(await result).toEqual({ resolution: 'room-closed' });
  });

  it('수락하면 두 사람이 각자 색을 받고, 번갈아 두다가 5목이면 둘 다 결과를 받아요', async () => {
    const host = await connect();
    const guest = await connect();
    const created = await host.emitWithAck('room:create', { nickname: '지니' });
    if (!created.ok) throw new Error(created.error);
    const ticket = await guest.emitWithAck('join:request', { roomId: created.data.id, nickname: '도윤' });
    if (!ticket.ok) throw new Error(ticket.error);

    const hostStart = next(host, 'game:state');
    const guestStart = next(guest, 'game:state');
    await host.emitWithAck('join:accept', { requestId: ticket.data.requestId });
    expect(await hostStart).toMatchObject({ you: 'black', turn: 'black', moveCount: 0 });
    expect(await guestStart).toMatchObject({ you: 'white', turn: 'black', moveCount: 0 });

    expect(await guest.emitWithAck('game:move', { row: 7, col: 7 })).toEqual({ ok: false, error: 'not-your-turn' });
    expect(await host.emitWithAck('game:move', { row: 15, col: 0 })).toEqual({ ok: false, error: 'invalid-payload' });

    const moves: [Client, number, number][] = [
      [host, 7, 3], [guest, 0, 0], [host, 7, 4], [guest, 0, 1],
      [host, 7, 5], [guest, 0, 2], [host, 7, 6], [guest, 0, 3],
    ];
    for (const [player, row, col] of moves) {
      const seen = next(guest, 'game:state');
      expect(await player.emitWithAck('game:move', { row, col })).toEqual({ ok: true, data: undefined });
      await seen;
    }

    const hostOver = next(host, 'game:over');
    const guestOver = next(guest, 'game:over');
    await host.emitWithAck('game:move', { row: 7, col: 7 });

    const expected = { winner: 'black', reason: 'five', moveCount: 9 };
    expect(await hostOver).toMatchObject(expected);
    expect(await guestOver).toMatchObject({ ...expected, winningLine: { direction: 'horizontal' } });
  });

  /** 지니(방장, 흑)와 도윤(참가자, 백)이 대국을 시작한 상태를 만들어요. */
  const startMatch = async () => {
    const host = await connect();
    const guest = await connect();
    const created = await host.emitWithAck('room:create', { nickname: '지니' });
    if (!created.ok) throw new Error(created.error);
    const ticket = await guest.emitWithAck('join:request', { roomId: created.data.id, nickname: '도윤' });
    if (!ticket.ok) throw new Error(ticket.error);
    const started = next(guest, 'game:state');
    await host.emitWithAck('join:accept', { requestId: ticket.data.requestId });
    await started;
    return { host, guest };
  };

  it('기권 → 둘 다 재대결 요청 → 색을 바꿔 새 판이 시작돼요', async () => {
    const { host, guest } = await startMatch();

    const over = next(guest, 'game:over');
    expect(await host.emitWithAck('game:resign')).toEqual({ ok: true, data: undefined });
    expect(await over).toEqual({ winner: 'white', reason: 'resign', winningLine: null, moveCount: 0 });

    const status = next(host, 'rematch:status');
    await guest.emitWithAck('rematch:request');
    expect(await status).toEqual({ requestedBy: ['white'] });

    const hostState = next(host, 'game:state');
    const guestState = next(guest, 'game:state');
    await host.emitWithAck('rematch:request');
    expect(await hostState).toMatchObject({ you: 'white', turn: 'black', moveCount: 0 });
    expect(await guestState).toMatchObject({ you: 'black', players: { black: { nickname: '도윤' } } });
  });

  it('결과 화면에서 참가자가 나가면 방장에게 알리고, 방장은 대기실로 돌아가 새 요청을 받아요', async () => {
    const { host, guest } = await startMatch();
    await host.emitWithAck('game:resign');

    const left = next(host, 'opponent:left');
    await guest.emitWithAck('room:leave');
    expect(await left).toEqual({ reason: 'left' });

    expect(await host.emitWithAck('rematch:request')).toEqual({ ok: false, error: 'no-opponent' });
    const reopened = await host.emitWithAck('room:reopen');
    expect(reopened).toMatchObject({ ok: true, data: { status: 'waiting' } });

    const newcomer = await connect();
    const requests = next(host, 'join:requests');
    await newcomer.emitWithAck('join:request', { roomId: reopened.ok ? reopened.data.id : '', nickname: '하람' });
    expect(await requests).toEqual([expect.objectContaining({ nickname: '하람' })]);
  });

  describe('세션과 재접속', () => {
    it('처음 연결하면 세션 ID를 받고, 그 ID로 다시 연결하면 같은 ID를 받아요', async () => {
      const first = await connectSession();
      expect(first.sessionId).toMatch(/^[0-9a-f-]{36}$/);

      const again = await connectSession(first.sessionId);
      expect(again.sessionId).toBe(first.sessionId);

      const bogus = await connectSession('not-a-session');
      expect(bogus.sessionId).not.toBe('not-a-session');
    });

    it('대국 중 상대가 끊기면 기다린다고 알리고, 같은 세션으로 돌아오면 이어서 둬요', async () => {
      const host = await connectSession();
      const guest = await connectSession();
      const created = await host.client.emitWithAck('room:create', { nickname: '지니' });
      if (!created.ok) throw new Error(created.error);
      const ticket = await guest.client.emitWithAck('join:request', { roomId: created.data.id, nickname: '도윤' });
      if (!ticket.ok) throw new Error(ticket.error);
      const started = next(guest.client, 'game:state');
      await host.client.emitWithAck('join:accept', { requestId: ticket.data.requestId });
      await started;
      await host.client.emitWithAck('game:move', { row: 7, col: 7 });

      // 새로고침: 소켓을 닫고 같은 세션으로 새로 연결
      const waiting = next(host.client, 'opponent:disconnected');
      guest.client.disconnect();
      expect(await waiting).toEqual({ remainingMs: 30_000 });

      const back = next(host.client, 'opponent:reconnected');
      const reloaded: Client = io(url, { transports: ['websocket'], forceNew: true, auth: { sessionId: guest.sessionId } });
      clients.push(reloaded);
      const resume = await next(reloaded, 'session:resume');
      await back;

      expect(resume).toMatchObject({ role: 'guest', game: { you: 'white', turn: 'white', moveCount: 1 }, over: null });
      expect(await reloaded.emitWithAck('game:move', { row: 7, col: 8 })).toEqual({ ok: true, data: undefined });
    });
  });

  it('한 세션이 짧은 시간에 요청을 퍼부으면 한도부터는 거절해요', async () => {
    const client = await connect();
    const results = await Promise.all(Array.from({ length: 31 }, () => client.emitWithAck('room:list')));

    expect(results.filter((r) => r.ok)).toHaveLength(30);
    expect(results.at(-1)).toEqual({ ok: false, error: 'rate-limited' });
  });
});
