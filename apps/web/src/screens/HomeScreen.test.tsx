import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomSummary } from '@gomoku/shared';
import { request } from '../lib/request';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { HomeScreen } from './HomeScreen';

vi.mock('../lib/request', () => ({ request: vi.fn() }));
const mockRequest = vi.mocked(request);

const room = (over: Partial<RoomSummary> = {}): RoomSummary => ({
  id: 'r1',
  hostNickname: '도윤',
  createdAt: new Date(2026, 9, 18, 14, 31, 52).getTime(),
  status: 'waiting',
  ...over,
});

/** 서버 응답을 이벤트별로 정해 둬요. */
const respond = (handlers: Record<string, unknown>) => {
  mockRequest.mockImplementation((async (event: string) => handlers[event]) as typeof request);
};

const renderHome = (status: ConnectionStatus = 'connected', onRoomCreated = vi.fn(), onJoinRequested = vi.fn()) => {
  const Harness = () => {
    const [nickname, setNickname] = useState('');
    return (
      <HomeScreen
        status={status}
        nickname={nickname}
        onNicknameChange={setNickname}
        onRoomCreated={onRoomCreated}
        onJoinRequested={onJoinRequested}
        notice={null}
      />
    );
  };
  render(<Harness />);
  return { onRoomCreated, onJoinRequested, user: userEvent.setup() };
};

describe('HomeScreen', () => {
  beforeEach(() => mockRequest.mockReset());

  it('서버가 깨어나기 전에는 배너를 보여주고 방 만들기를 막아요', () => {
    renderHome('waking');

    expect(screen.getByText('서버를 깨우는 중이에요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '방 만들기' })).toBeDisabled();
    expect(screen.getByText('서버가 깨어나면 방 목록을 불러와요')).toBeInTheDocument();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('닉네임이 2자보다 짧으면 입력칸 아래에 알려주고 서버에 보내지 않아요', async () => {
    respond({ 'room:list': { ok: true, data: [] } });
    const { user } = renderHome();

    await user.type(screen.getByLabelText('닉네임'), '지');
    await user.click(screen.getByRole('button', { name: '방 만들기' }));

    expect(screen.getByText('닉네임은 2–10자로 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByLabelText('닉네임')).toHaveAttribute('aria-invalid', 'true');
    expect(mockRequest).not.toHaveBeenCalledWith('room:create', expect.anything());
  });

  it('앞뒤 공백을 지운 닉네임으로 방을 만들어요', async () => {
    const created = room({ hostNickname: '지니' });
    respond({ 'room:list': { ok: true, data: [] }, 'room:create': { ok: true, data: created } });
    const { user, onRoomCreated } = renderHome();

    await user.type(screen.getByLabelText('닉네임'), '  지니 ');
    await user.click(screen.getByRole('button', { name: '방 만들기' }));

    expect(mockRequest).toHaveBeenCalledWith('room:create', { nickname: '지니' });
    expect(onRoomCreated).toHaveBeenCalledWith(created);
  });

  it('방 목록에 생성일시와 대국 중 표시를 보여줘요', async () => {
    respond({
      'room:list': {
        ok: true,
        data: [room(), room({ id: 'r2', hostNickname: '하람', status: 'playing' })],
      },
    });
    renderHome();

    const list = await screen.findByRole('list');
    const [waiting, playing] = within(list).getAllByRole('listitem');
    expect(within(waiting).getByText('2026.10.18 14:31:52 생성')).toBeInTheDocument();
    expect(within(waiting).getByRole('button', { name: '도윤 방에 입장 요청' })).toBeInTheDocument();
    expect(within(playing).getByText('대국 중')).toBeInTheDocument();
    expect(within(playing).queryByRole('button')).not.toBeInTheDocument();
  });

  it('열린 방이 없으면 빈 상태를 보여줘요', async () => {
    respond({ 'room:list': { ok: true, data: [] } });
    renderHome();

    expect(await screen.findByText('아직 열린 방이 없어요')).toBeInTheDocument();
  });

  it('목록을 못 불러오면 한국어 에러 문구를 보여줘요', async () => {
    respond({ 'room:list': { ok: false, error: 'timeout' } });
    renderHome();

    expect(await screen.findByRole('alert')).toHaveTextContent('서버가 답하지 않아요. 잠시 후 다시 해 주세요.');
  });

  it('새로고침 버튼을 누르면 목록을 다시 불러와요', async () => {
    respond({ 'room:list': { ok: true, data: [] } });
    const { user } = renderHome();
    await screen.findByText('아직 열린 방이 없어요');

    respond({ 'room:list': { ok: true, data: [room()] } });
    await user.click(screen.getByRole('button', { name: '방 목록 새로고침' }));

    expect(await screen.findByText('도윤')).toBeInTheDocument();
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('헤더의 규칙 버튼으로 규칙을 볼 수 있어요', async () => {
    respond({ 'room:list': { ok: true, data: [] } });
    const { user } = renderHome();

    await user.click(screen.getByRole('button', { name: '규칙' }));

    expect(screen.getByRole('dialog', { name: '규칙' })).toBeInTheDocument();
  });

  describe('입장 요청', () => {
    it('닉네임이 없으면 요청하지 않고 입력칸으로 보내요', async () => {
      respond({ 'room:list': { ok: true, data: [room()] } });
      const { user } = renderHome();

      await user.click(await screen.findByRole('button', { name: '도윤 방에 입장 요청' }));

      expect(screen.getByLabelText('닉네임')).toHaveFocus();
      expect(screen.getByText('닉네임은 2–10자로 입력해 주세요.')).toBeInTheDocument();
      expect(mockRequest).not.toHaveBeenCalledWith('join:request', expect.anything());
    });

    it('내 닉네임으로 요청하고, 표를 받으면 대기 화면으로 넘겨요', async () => {
      const ticket = { requestId: 'q1', room: room(), remainingMs: 60_000 };
      respond({ 'room:list': { ok: true, data: [room()] }, 'join:request': { ok: true, data: ticket } });
      const { user, onJoinRequested } = renderHome();

      await user.type(screen.getByLabelText('닉네임'), '지니');
      await user.click(await screen.findByRole('button', { name: '도윤 방에 입장 요청' }));

      expect(mockRequest).toHaveBeenCalledWith('join:request', { roomId: 'r1', nickname: '지니' });
      expect(onJoinRequested).toHaveBeenCalledWith(ticket);
    });

    it('그 사이 대국이 시작된 방이면 알려주고 목록을 다시 불러와요', async () => {
      respond({ 'room:list': { ok: true, data: [room()] }, 'join:request': { ok: false, error: 'room-not-waiting' } });
      const { user } = renderHome();

      await user.type(screen.getByLabelText('닉네임'), '지니');
      await user.click(await screen.findByRole('button', { name: '도윤 방에 입장 요청' }));

      expect(await screen.findByText('이미 대국이 시작된 방이에요.')).toBeInTheDocument();
      expect(mockRequest.mock.calls.filter(([e]) => e === 'room:list')).toHaveLength(2);
    });
  });
});
