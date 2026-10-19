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

  const connect = async (): Promise<Client> => {
    const client: Client = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('connect_error', reject);
    });
    return client;
  };

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

  it('대국 중 상대의 연결이 끊기면 남은 사람에게 대국 종료를 보내요', async () => {
    const host = await connect();
    const guest = await connect();
    const created = await host.emitWithAck('room:create', { nickname: '지니' });
    if (!created.ok) throw new Error(created.error);
    const ticket = await guest.emitWithAck('join:request', { roomId: created.data.id, nickname: '도윤' });
    if (!ticket.ok) throw new Error(ticket.error);
    await host.emitWithAck('join:accept', { requestId: ticket.data.requestId });

    const over = next(host, 'game:over');
    guest.disconnect();

    expect(await over).toEqual({ winner: 'black', reason: 'disconnect', winningLine: null, moveCount: 0 });
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
});
