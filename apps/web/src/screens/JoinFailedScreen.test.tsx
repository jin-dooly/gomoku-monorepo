import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoomSummary } from '@gomoku/shared';
import { request } from '../lib/request';
import { JoinFailedScreen, type FailedResolution } from './JoinFailedScreen';

vi.mock('../lib/request', () => ({ request: vi.fn() }));
const mockRequest = vi.mocked(request);

const room: RoomSummary = { id: 'r1', hostNickname: '지니', createdAt: 0, status: 'waiting' };

const renderFailed = (resolution: FailedResolution) => {
  const props = { onBackToList: vi.fn(), onRoomCreated: vi.fn() };
  render(<JoinFailedScreen status="connected" room={room} resolution={resolution} nickname="도윤" {...props} />);
  return { ...props, user: userEvent.setup() };
};

describe('JoinFailedScreen', () => {
  it.each<[FailedResolution, string, string]>([
    ['rejected', '거절', '방장이 요청을 거절했어요.'],
    ['expired', '시간 초과', '60초 동안 방장의 응답이 없었어요.'],
    ['taken', '다른 상대와 시작', '방장이 다른 상대와 대국을 시작했어요.'],
    ['room-closed', '방 닫힘', '방장이 방을 닫았어요.'],
  ])('%s: 도장 "%s"와 이유를 보여줘요', (resolution, stamp, text) => {
    renderFailed(resolution);
    expect(screen.getByText(stamp)).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('내 방 만들기를 누르면 같은 닉네임으로 바로 방을 만들어요', async () => {
    const created = { ...room, id: 'r2', hostNickname: '도윤' };
    mockRequest.mockResolvedValue({ ok: true, data: created });
    const { user, onRoomCreated } = renderFailed('rejected');

    await user.click(screen.getByRole('button', { name: '내 방 만들기' }));

    expect(mockRequest).toHaveBeenCalledWith('room:create', { nickname: '도윤' });
    expect(onRoomCreated).toHaveBeenCalledWith(created);
  });
});
