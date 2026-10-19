import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomSummary } from '@gomoku/shared';
import { request } from '../lib/request';
import { HostWaitingScreen } from './HostWaitingScreen';

const fake = vi.hoisted(() => ({ socket: null as unknown as ReturnType<typeof import('../test/fakeSocket').createFakeSocket> }));
vi.mock('../lib/socket', async () => {
  const { createFakeSocket } = await import('../test/fakeSocket');
  fake.socket = createFakeSocket();
  return { socket: fake.socket };
});
vi.mock('../lib/request', () => ({ request: vi.fn() }));
const mockRequest = vi.mocked(request);

const room: RoomSummary = { id: 'r1', hostNickname: '지니', createdAt: 0, status: 'waiting' };

const renderHost = () => {
  const onMatched = vi.fn();
  const onClosed = vi.fn();
  render(<HostWaitingScreen status="connected" room={room} onClosed={onClosed} onMatched={onMatched} />);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  return { onMatched, onClosed, user };
};

const sendRequests = (requests: { requestId: string; nickname: string; remainingMs: number }[]) =>
  act(() => fake.socket.serverSends('join:requests', requests));

describe('HostWaitingScreen', () => {
  beforeEach(() => {
    // user-event가 내부에서 setTimeout을 기다려서, 가짜 타이머도 실제 시간에 맞춰 흐르게 해요.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({ ok: true, data: undefined });
  });
  afterEach(() => vi.useRealTimers());

  it('요청이 없으면 빈 상태를 보여줘요', () => {
    renderHost();
    expect(screen.getByText('아직 입장 요청이 없어요')).toBeInTheDocument();
  });

  it('요청이 오면 카드로 보여주고 남은 시간이 줄어들어요', () => {
    renderHost();
    sendRequests([{ requestId: 'q1', nickname: '도윤', remainingMs: 48_000 }]);

    expect(screen.getByText('도윤')).toBeInTheDocument();
    expect(screen.getByText('48초 후 자동 취소')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText('38초 후 자동 취소')).toBeInTheDocument();
  });

  it('수락하면 서버에 알리고 그 참가자와 대국으로 넘어가요', async () => {
    const { user, onMatched } = renderHost();
    sendRequests([
      { requestId: 'q1', nickname: '도윤', remainingMs: 60_000 },
      { requestId: 'q2', nickname: '하람', remainingMs: 60_000 },
    ]);

    await user.click(screen.getAllByRole('button', { name: '수락하고 시작' })[1]);

    expect(mockRequest).toHaveBeenCalledWith('join:accept', { requestId: 'q2' });
    expect(onMatched).toHaveBeenCalledWith('하람');
  });

  it('거절한 요청은 도장 없이 사라져요', async () => {
    const { user } = renderHost();
    sendRequests([{ requestId: 'q1', nickname: '도윤', remainingMs: 60_000 }]);

    await user.click(screen.getByRole('button', { name: '거절' }));
    sendRequests([]);

    expect(mockRequest).toHaveBeenCalledWith('join:reject', { requestId: 'q1' });
    expect(screen.queryByText('도윤')).not.toBeInTheDocument();
    expect(screen.getByText('아직 입장 요청이 없어요')).toBeInTheDocument();
  });

  it('시간이 다 돼서 사라진 요청은 시간 초과 도장으로 남아요', () => {
    renderHost();
    sendRequests([{ requestId: 'q1', nickname: '도윤', remainingMs: 5_000 }]);

    act(() => vi.advanceTimersByTime(5_000));
    sendRequests([]);

    expect(screen.getByText('시간 초과')).toBeInTheDocument();
    expect(screen.getByText('응답이 없어 자동으로 취소됐어요')).toBeInTheDocument();
  });

  it('참가자가 취소한 요청은 요청 취소 도장으로 남아요', () => {
    renderHost();
    sendRequests([{ requestId: 'q1', nickname: '도윤', remainingMs: 50_000 }]);
    sendRequests([]);

    expect(screen.getByText('요청 취소')).toBeInTheDocument();
  });

  it('수락이 실패하면 이유를 보여주고 그대로 기다려요', async () => {
    mockRequest.mockResolvedValue({ ok: false, error: 'request-not-found' });
    const { user, onMatched } = renderHost();
    sendRequests([{ requestId: 'q1', nickname: '도윤', remainingMs: 60_000 }]);

    await user.click(screen.getByRole('button', { name: '수락하고 시작' }));

    expect(screen.getByRole('alert')).toHaveTextContent('입장 요청이 이미 끝났어요.');
    expect(onMatched).not.toHaveBeenCalled();
  });

  it('뒤로가기를 누르면 방을 닫아요', async () => {
    const { user, onClosed } = renderHost();

    await user.click(screen.getByRole('button', { name: '방 닫기' }));

    expect(mockRequest).toHaveBeenCalledWith('room:close');
    expect(onClosed).toHaveBeenCalled();
  });
});
