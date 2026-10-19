import { render, screen, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoard, type GameOverPayload, type GameStatePayload, type Stone } from '@gomoku/shared';
import type { ComponentProps } from 'react';
import { request } from '../lib/request';
import { GameScreen } from './GameScreen';

vi.mock('../lib/request', () => ({ request: vi.fn() }));
const mockRequest = vi.mocked(request);

/** 지니(흑)와 도윤(백)의 판. 기본은 지니 시점, 흑 차례, 둔 수 없음. */
const state = (over: Partial<GameStatePayload> = {}): GameStatePayload => ({
  roomId: 'r1',
  hostNickname: '지니',
  players: { black: { nickname: '지니' }, white: { nickname: '도윤' } },
  you: 'black',
  board: createBoard(),
  turn: 'black',
  moveCount: 0,
  lastMove: null,
  ...over,
});

const withStones = (stones: [number, number, Stone][]) => {
  const board = createBoard();
  for (const [r, c, s] of stones) board[r][c] = s;
  return board;
};

type GameProps = ComponentProps<typeof GameScreen>;

const renderGame = (game: GameStatePayload, over: GameOverPayload | null = null, extra: Partial<GameProps> = {}) => {
  const props: GameProps = {
    status: 'connected',
    game,
    over,
    isHost: true,
    rematch: [],
    opponentLeft: null,
    opponentAway: null,
    onLeft: vi.fn(),
    onReopened: vi.fn(),
    ...extra,
  };
  const utils: RenderResult = render(<GameScreen {...props} />);
  const rerenderWith = (next: Partial<GameProps>) => utils.rerender(<GameScreen {...props} {...next} />);
  return { ...utils, props, rerenderWith, onLeft: props.onLeft, user: userEvent.setup() };
};

const cell = (label: string) => screen.getByRole('gridcell', { name: new RegExp(`^${label},`) });

describe('GameScreen', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({ ok: true, data: undefined });
  });

  it('내 차례면 내 카드에 불이 들어오고, 고른 자리에 두기 버튼이 생겨요', async () => {
    const { user } = renderGame(state());

    const me = screen.getByRole('region', { name: '흑 지니' });
    expect(me).toHaveAttribute('aria-current', 'true');
    expect(within(me).getByText('흑 · 내 차례')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '자리를 골라요' })).toBeDisabled();

    await user.click(cell('G7'));

    expect(cell('G7')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'G7에 두기' }));
    expect(mockRequest).toHaveBeenCalledWith('game:move', { row: 8, col: 6 });
  });

  it('다른 곳을 누르면 미리보기가 옮겨지고, 취소하면 지워져요', async () => {
    const { user } = renderGame(state());

    await user.click(cell('G7'));
    await user.click(cell('H8'));
    expect(screen.getByRole('button', { name: 'H8에 두기' })).toBeEnabled();
    expect(cell('G7')).toHaveAttribute('aria-selected', 'false');

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByRole('button', { name: '자리를 골라요' })).toBeDisabled();
  });

  it('상대 차례에는 판을 누를 수 없고, 상대가 두는 중과 마지막 수를 보여줘요', () => {
    renderGame(
      state({
        turn: 'white',
        moveCount: 1,
        board: withStones([[8, 6, 'black']]),
        lastMove: { row: 8, col: 6, stone: 'black' },
      }),
    );

    expect(screen.getByRole('grid', { name: '오목판' })).toHaveAttribute('aria-disabled', 'true');
    expect(cell('A1')).toBeDisabled();
    expect(screen.getByText('도윤 님이 두고 있어요')).toBeInTheDocument();
    expect(screen.getByText('마지막 수 · 지니 G7')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '백 도윤' })).toHaveAttribute('aria-current', 'true');
  });

  it('백 시점에서는 내 카드가 백이에요', () => {
    renderGame(state({ you: 'white' }));
    expect(within(screen.getByRole('region', { name: '백 도윤' })).getByText('백 · 기다리는 중')).toBeInTheDocument();
  });

  it('돌이 있는 자리는 골라지지 않아요', async () => {
    const { user } = renderGame(state({ board: withStones([[7, 7, 'white']]), moveCount: 2 }));

    await user.click(cell('H8'));
    expect(screen.getByRole('button', { name: '자리를 골라요' })).toBeDisabled();
  });

  it('서버가 거절하면 이유를 보여줘요', async () => {
    mockRequest.mockResolvedValue({ ok: false, error: 'not-your-turn' });
    const { user } = renderGame(state());

    await user.click(cell('G7'));
    await user.click(screen.getByRole('button', { name: 'G7에 두기' }));

    expect(screen.getByRole('alert')).toHaveTextContent('지금은 상대 차례예요.');
  });

  it('새 수가 오면 고른 자리를 지워요', async () => {
    const { user, rerenderWith } = renderGame(state());
    await user.click(cell('G7'));

    rerenderWith({ game: state({ moveCount: 2, board: withStones([[0, 0, 'black'], [0, 1, 'white']]) }) });

    expect(screen.getByRole('button', { name: '자리를 골라요' })).toBeDisabled();
  });

  it('방향키로 미리보기를 옮겨요', async () => {
    const { user } = renderGame(state());
    await user.click(cell('H8'));

    await user.keyboard('{ArrowLeft}{ArrowDown}');

    expect(screen.getByRole('button', { name: 'G7에 두기' })).toBeEnabled();
  });

  describe('대국이 끝나면', () => {
    const line = [3, 4, 5, 6, 7].map((col) => ({ row: 8, col }));
    const fiveOver: GameOverPayload = {
      winner: 'black',
      reason: 'five',
      winningLine: { direction: 'horizontal', stones: line },
      moveCount: 13,
    };

    it('이긴 사람에게 승리와 요약을 보여주고 판을 막아요', () => {
      renderGame(state({ board: withStones(line.map((p) => [p.row, p.col, 'black'])), moveCount: 13 }), fiveOver);

      expect(screen.getByText('승리했어요')).toBeInTheDocument();
      expect(screen.getByText('흑 가로 5목 완성 · 총 13수')).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: '흑 지니' })).getByText('승리')).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: '백 도윤' })).getByText('패배')).toBeInTheDocument();
      expect(cell('D7')).toHaveAccessibleName('D7, 흑, 이긴 줄');
      expect(screen.getByRole('grid', { name: '오목판' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('진 사람에게는 졌어요를 보여줘요', () => {
      renderGame(state({ you: 'white', moveCount: 13 }), fiveOver);
      expect(screen.getByText('졌어요')).toBeInTheDocument();
    });

    it('무승부면 비겼어요와 양쪽 무승부 도장을 보여줘요', () => {
      renderGame(state({ moveCount: 225 }), { winner: null, reason: 'draw', winningLine: null, moveCount: 225 });

      expect(screen.getByText('비겼어요')).toBeInTheDocument();
      expect(screen.getByText('판이 가득 찼어요 · 총 225수')).toBeInTheDocument();
      expect(screen.getAllByText('무승부')).toHaveLength(2);
    });

    it('상대가 기권하면 승리 링 없이 이유를 보여줘요', () => {
      renderGame(state({ moveCount: 12 }), { winner: 'black', reason: 'resign', winningLine: null, moveCount: 12 });

      expect(screen.getByText('승리했어요')).toBeInTheDocument();
      expect(screen.getByText('도윤 님이 기권했어요 · 총 12수')).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: '백 도윤' })).getByText('백 · 기권')).toBeInTheDocument();
    });

    it('대국이 끝나면 ⋮ 메뉴가 사라져요', () => {
      renderGame(state({ moveCount: 13 }), fiveOver);
      expect(screen.queryByRole('button', { name: '대국 메뉴' })).not.toBeInTheDocument();
    });

    it('로비로 나가기를 누르면 방에서 나가요', async () => {
      const { user, onLeft } = renderGame(state({ moveCount: 13 }), fiveOver);

      await user.click(screen.getByRole('button', { name: '로비로 나가기' }));

      expect(mockRequest).toHaveBeenCalledWith('room:leave');
      expect(onLeft).toHaveBeenCalled();
    });
  });

  describe('재대결', () => {
    const over: GameOverPayload = { winner: 'white', reason: 'five', winningLine: null, moveCount: 30 };

    it('아무도 요청하지 않았으면 재대결 요청 버튼이 있어요', async () => {
      const { user } = renderGame(state({ moveCount: 30 }), over);

      expect(screen.getByText('아직 아무도 재대결을 요청하지 않았어요')).toBeInTheDocument();
      expect(screen.getByText('재대결하면 흑과 백이 바뀌어요')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '재대결 요청' }));
      expect(mockRequest).toHaveBeenCalledWith('rematch:request');
    });

    it('상대가 요청했으면 알려주고 수락 버튼이 돼요', () => {
      renderGame(state({ moveCount: 30 }), over, { rematch: ['white'] });

      expect(screen.getByText('도윤 님이 재대결을 원해요')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '재대결 수락' })).toBeEnabled();
    });

    it('내가 요청했으면 상대의 답을 기다려요', () => {
      renderGame(state({ moveCount: 30 }), over, { rematch: ['black'] });

      expect(screen.getByText('도윤 님의 답을 기다리고 있어요')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '답을 기다리는 중' })).toBeDisabled();
    });
  });

  describe('상대가 나갔을 때', () => {
    const over: GameOverPayload = { winner: 'black', reason: 'five', winningLine: null, moveCount: 20 };

    it('방장이면 재대결 없이 대기실로 돌아가거나 로비로 나갈 수 있어요', async () => {
      const room = { id: 'r1', hostNickname: '지니', createdAt: 0, status: 'waiting' as const };
      mockRequest.mockResolvedValue({ ok: true, data: room });
      const { user, props } = renderGame(state({ moveCount: 20 }), over, { opponentLeft: 'left' });

      expect(screen.getByText('도윤 님이 방을 나가서 재대결할 수 없어요')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /재대결/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '로비로 나가기' })).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: '백 도윤' })).getByText('백 · 방을 나감')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '대기실로 돌아가기' }));

      expect(mockRequest).toHaveBeenCalledWith('room:reopen');
      expect(props.onReopened).toHaveBeenCalledWith(room);
    });

    it('참가자면 로비로 나가기만 있어요', () => {
      renderGame(state({ you: 'white', moveCount: 20 }), { ...over, winner: 'white', reason: 'left' }, { isHost: false });

      expect(screen.getByText('지니 님이 방을 나갔어요 · 총 20수')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '대기실로 돌아가기' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '로비로 나가기' })).toBeInTheDocument();
    });

    it('연결이 끊긴 경우 문구가 달라요', () => {
      renderGame(state({ moveCount: 20 }), over, { opponentLeft: 'disconnect' });
      expect(screen.getByText('도윤 님의 연결이 끊겨서 재대결할 수 없어요')).toBeInTheDocument();
    });
  });

  describe('⋮ 메뉴와 확인창', () => {
    it('메뉴에서 기권을 고르면 확인창을 거쳐 기권해요', async () => {
      const { user } = renderGame(state({ moveCount: 4 }));

      await user.click(screen.getByRole('button', { name: '대국 메뉴' }));
      expect(screen.getByRole('menuitem', { name: /기권하기/ })).toHaveFocus();
      await user.click(screen.getByRole('menuitem', { name: /기권하기/ }));

      const dialog = screen.getByRole('alertdialog', { name: '기권할까요?' });
      expect(dialog).toHaveTextContent('이번 판은 도윤 님의 승리로 끝나요.');
      expect(within(dialog).getByRole('button', { name: '계속 두기' })).toHaveFocus();
      expect(mockRequest).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole('button', { name: '기권하기' }));
      expect(mockRequest).toHaveBeenCalledWith('game:resign');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('계속 두기나 Esc를 누르면 아무 일 없이 닫혀요', async () => {
      const { user } = renderGame(state({ moveCount: 4 }));

      await user.click(screen.getByRole('button', { name: '대국 메뉴' }));
      await user.click(screen.getByRole('menuitem', { name: /기권하기/ }));
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('방 나가기는 기권 처리 안내 후 나가요', async () => {
      const { user, onLeft } = renderGame(state({ moveCount: 4 }));

      await user.click(screen.getByRole('button', { name: '대국 메뉴' }));
      await user.click(screen.getByRole('menuitem', { name: /방 나가기/ }));
      const dialog = screen.getByRole('alertdialog', { name: '방에서 나갈까요?' });
      await user.click(within(dialog).getByRole('button', { name: '기권하고 나가기' }));

      expect(mockRequest).toHaveBeenCalledWith('room:leave');
      expect(onLeft).toHaveBeenCalled();
    });

    it('메뉴에서 규칙 보기를 열면 지금 내 차례인지도 함께 보여주고, 닫으면 ⋮로 돌아가요', async () => {
      const { user } = renderGame(state({ moveCount: 4 }));

      await user.click(screen.getByRole('button', { name: '대국 메뉴' }));
      await user.click(screen.getByRole('menuitem', { name: '규칙 보기' }));

      const rules = screen.getByRole('dialog', { name: '규칙' });
      expect(within(rules).getByRole('status')).toHaveTextContent('내 차례예요');

      await user.click(within(rules).getByRole('button', { name: '닫기' }));
      expect(screen.queryByRole('dialog', { name: '규칙' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '대국 메뉴' })).toHaveFocus();
    });

    it('규칙을 보는 동안 상대 연결이 끊기면 07 대화상자 대신 규칙 위에 알려줘요', async () => {
      const { user, rerenderWith } = renderGame(state({ moveCount: 4 }));
      await user.click(screen.getByRole('button', { name: '대국 메뉴' }));
      await user.click(screen.getByRole('menuitem', { name: '규칙 보기' }));

      rerenderWith({ opponentAway: Date.now() + 25_000 });

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(within(screen.getByRole('dialog', { name: '규칙' })).getByRole('status')).toHaveTextContent(
        /도윤 님의 연결이 끊겼어요 0:2\d/,
      );

      await user.click(screen.getByRole('button', { name: '닫기' }));
      expect(screen.getByRole('alertdialog', { name: '도윤 님의 연결이 끊겼어요' })).toBeInTheDocument();
    });

    it('메뉴는 Esc로 닫히고 ⋮ 버튼으로 포커스가 돌아가요', async () => {
      const { user } = renderGame(state({ moveCount: 4 }));

      await user.click(screen.getByRole('button', { name: '대국 메뉴' }));
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '대국 메뉴' })).toHaveFocus();
    });
  });

  describe('연결이 끊겼을 때', () => {
    it('상대 연결이 끊기면 07 대화상자와 남은 시간을 보여주고, 계속 기다리기로 닫아요', async () => {
      const { user } = renderGame(state({ moveCount: 3, turn: 'white' }), null, { opponentAway: Date.now() + 21_000 });

      const dialog = screen.getByRole('alertdialog', { name: '도윤 님의 연결이 끊겼어요' });
      expect(dialog).toHaveTextContent('30초 안에 돌아오지 않으면 지니 님이 이겨요.');
      expect(within(dialog).getByRole('timer')).toHaveTextContent('0:21');
      expect(within(dialog).getByRole('button', { name: '계속 기다리기' })).toHaveFocus();

      await user.click(within(dialog).getByRole('button', { name: '계속 기다리기' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      // 대화상자를 닫아도 상대 카드에는 남은 시간이 계속 보여요.
      expect(within(screen.getByRole('region', { name: '백 도윤' })).getByText(/연결 끊김 0:2\d/)).toBeInTheDocument();
    });

    it('07에서 나가기를 누르면 기권 안내 확인창을 거쳐요', async () => {
      const { user, onLeft } = renderGame(state({ moveCount: 3 }), null, { opponentAway: Date.now() + 20_000 });

      await user.click(screen.getByRole('button', { name: '나가기' }));
      const confirm = screen.getByRole('alertdialog', { name: '방에서 나갈까요?' });
      await user.click(within(confirm).getByRole('button', { name: '기권하고 나가기' }));

      expect(mockRequest).toHaveBeenCalledWith('room:leave');
      expect(onLeft).toHaveBeenCalled();
    });

    it('상대가 돌아오면(opponentAway가 null) 대화상자와 끊김 표시가 사라져요', () => {
      const { rerenderWith } = renderGame(state({ moveCount: 3 }), null, { opponentAway: Date.now() + 20_000 });

      rerenderWith({ opponentAway: null });

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.queryByText(/연결 끊김/)).not.toBeInTheDocument();
    });

    it('결과 화면에서 상대가 끊기면 돌아오면 재대결할 수 있다고 알려줘요', () => {
      renderGame(
        state({ moveCount: 9 }),
        { winner: 'black', reason: 'five', winningLine: null, moveCount: 9 },
        { opponentAway: Date.now() + 15_000 },
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByText(/도윤 님의 연결이 끊겼어요 · 0:1\d 안에 돌아오면 재대결할 수 있어요/)).toBeInTheDocument();
    });

    it('내 연결이 끊기면 판을 막고 다시 연결하는 중이라고 알려요', () => {
      renderGame(state(), null, { status: 'reconnecting' });

      expect(screen.getByText('연결이 끊겨서 다시 연결하고 있어요')).toBeInTheDocument();
      expect(screen.getByRole('grid', { name: '오목판' })).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
