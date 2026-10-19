import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoard, type GameOverPayload, type GameStatePayload, type Stone } from '@gomoku/shared';
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

const renderGame = (game: GameStatePayload, over: GameOverPayload | null = null) => {
  const onLeft = vi.fn();
  const utils = render(<GameScreen status="connected" game={game} over={over} onLeft={onLeft} />);
  return { ...utils, onLeft, user: userEvent.setup() };
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
    const { user, rerender, onLeft } = renderGame(state());
    await user.click(cell('G7'));

    rerender(
      <GameScreen
        status="connected"
        game={state({ moveCount: 2, board: withStones([[0, 0, 'black'], [0, 1, 'white']]) })}
        over={null}
        onLeft={onLeft}
      />,
    );

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

    it('무승부와 상대가 나간 경우 문구가 달라요', () => {
      const { rerender, onLeft } = renderGame(state({ moveCount: 225 }), {
        winner: null,
        reason: 'draw',
        winningLine: null,
        moveCount: 225,
      });
      expect(screen.getByText('비겼어요')).toBeInTheDocument();
      expect(screen.getByText('판이 가득 찼어요 · 총 225수')).toBeInTheDocument();

      rerender(
        <GameScreen
          status="connected"
          game={state({ moveCount: 4 })}
          over={{ winner: 'black', reason: 'left', winningLine: null, moveCount: 4 }}
          onLeft={onLeft}
        />,
      );
      expect(screen.getByText('도윤 님이 방을 나가서 이겼어요')).toBeInTheDocument();
    });

    it('로비로 나가기를 누르면 방에서 나가요', async () => {
      const { user, onLeft } = renderGame(state({ moveCount: 13 }), fiveOver);

      await user.click(screen.getByRole('button', { name: '로비로 나가기' }));

      expect(mockRequest).toHaveBeenCalledWith('room:leave');
      expect(onLeft).toHaveBeenCalled();
    });
  });
});
