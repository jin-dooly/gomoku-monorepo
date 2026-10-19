import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoard, type SessionResumePayload } from '@gomoku/shared';
import { request } from './lib/request';
import App from './App';

const fake = vi.hoisted(() => ({ socket: null as unknown as ReturnType<typeof import('./test/fakeSocket').createFakeSocket> }));
vi.mock('./lib/socket', async () => {
  const { createFakeSocket } = await import('./test/fakeSocket');
  fake.socket = createFakeSocket();
  return { socket: fake.socket };
});
vi.mock('./lib/request', () => ({ request: vi.fn() }));
vi.mocked(request).mockResolvedValue({ ok: true, data: [] });

const room = { id: 'r1', hostNickname: '지니', createdAt: 0, status: 'playing' as const };

const resume = (over: Partial<SessionResumePayload> = {}): SessionResumePayload => ({
  role: 'guest',
  room,
  game: {
    roomId: 'r1',
    hostNickname: '지니',
    players: { black: { nickname: '지니' }, white: { nickname: '도윤' } },
    you: 'white',
    board: createBoard(),
    turn: 'black',
    moveCount: 4,
    lastMove: null,
  },
  over: null,
  rematch: [],
  opponentLeft: null,
  opponentDisconnected: null,
  requests: [],
  ...over,
});

const send: typeof fake.socket.serverSends = (...args) => act(() => fake.socket.serverSends(...args));

describe('App: 새로고침과 재접속', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.useRealTimers();
    window.sessionStorage.clear();
  });

  it('세션이 있는 탭은 새로고침 직후 이전 화면을 불러오고, 서버가 보내 주면 그 화면으로 가요', () => {
    window.sessionStorage.setItem('gomoku.sessionId', 's1');
    render(<App />);
    expect(screen.getByText('이전 화면을 불러오고 있어요')).toBeInTheDocument();

    send('session:assigned', { sessionId: 's1' });
    send('session:resume', resume({ opponentDisconnected: { remainingMs: 18_000 } }));

    expect(screen.getByRole('heading', { name: '지니의 방' })).toBeInTheDocument();
    expect(screen.getByText('4수')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog', { name: '지니 님의 연결이 끊겼어요' })).toBeInTheDocument();
  });

  it('이전 화면이 오지 않으면 홈으로 가요', () => {
    window.sessionStorage.setItem('gomoku.sessionId', 's1');
    render(<App />);

    send('session:assigned', { sessionId: 's1' });
    act(() => vi.advanceTimersByTime(1500));

    expect(screen.getByLabelText('닉네임')).toBeInTheDocument();
  });

  it('방장 대기실로 돌아오면 기다리던 입장 요청도 그대로 보여요', () => {
    window.sessionStorage.setItem('gomoku.sessionId', 's1');
    render(<App />);

    send('session:resume', resume({
      role: 'host',
      room: { ...room, status: 'waiting' },
      game: null,
      requests: [{ requestId: 'q1', nickname: '도윤', remainingMs: 40_000 }],
    }));

    expect(screen.getByText('40초 후 자동 취소')).toBeInTheDocument();
  });

  it('대국 중 다시 연결됐는데 이전 화면이 오지 않으면 방에서 빠진 거라 홈에서 알려줘요', () => {
    window.sessionStorage.setItem('gomoku.sessionId', 's1');
    render(<App />);
    send('session:resume', resume());

    send('session:assigned', { sessionId: 's1' });
    act(() => vi.advanceTimersByTime(1500));

    expect(screen.getByText('연결이 오래 끊겨서 방에서 나왔어요.')).toBeInTheDocument();
  });

  it('상대가 끊겼다가 돌아오면 07 대화상자가 사라져요', () => {
    window.sessionStorage.setItem('gomoku.sessionId', 's1');
    render(<App />);
    send('session:resume', resume());

    send('opponent:disconnected', { remainingMs: 30_000 });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    send('opponent:reconnected');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('세션이 없는 새 탭은 바로 홈이에요', () => {
    render(<App />);
    expect(screen.getByLabelText('닉네임')).toBeInTheDocument();
  });
});
