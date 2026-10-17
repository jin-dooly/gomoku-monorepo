import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  Board,
  Position,
  Stone,
  createBoard,
  findWinningLine,
  isBoardFull,
  placeStone,
  toCoordinateLabel,
} from './rules';

const boardWith = (stones: [Stone, ...Position[]][]): Board => {
  const board = createBoard();
  for (const [stone, ...positions] of stones) {
    for (const { row, col } of positions) board[row][col] = stone;
  }
  return board;
};

const row = (r: number, cols: number[]): Position[] => cols.map((col) => ({ row: r, col }));

describe('createBoard', () => {
  it('15×15 빈 판을 만들어요', () => {
    const board = createBoard();
    expect(board).toHaveLength(BOARD_SIZE);
    expect(board.every((r) => r.length === BOARD_SIZE && r.every((c) => c === null))).toBe(true);
  });

  it('행끼리 배열을 공유하지 않아요', () => {
    const board = createBoard();
    board[0][0] = 'black';
    expect(board[1][0]).toBeNull();
  });
});

describe('findWinningLine', () => {
  it('가로 5목을 찾아요', () => {
    const board = boardWith([['black', ...row(7, [3, 4, 5, 6, 7])]]);
    expect(findWinningLine(board, { row: 7, col: 5 })).toEqual({
      direction: 'horizontal',
      stones: row(7, [3, 4, 5, 6, 7]),
    });
  });

  it('세로 5목을 찾아요', () => {
    const stones = [2, 3, 4, 5, 6].map((r) => ({ row: r, col: 0 }));
    const board = boardWith([['white', ...stones]]);
    expect(findWinningLine(board, { row: 6, col: 0 })).toEqual({ direction: 'vertical', stones });
  });

  it('↘ 대각선 5목을 찾아요', () => {
    const stones = [0, 1, 2, 3, 4].map((i) => ({ row: i, col: i }));
    const board = boardWith([['black', ...stones]]);
    expect(findWinningLine(board, { row: 0, col: 0 })).toEqual({ direction: 'diagonal', stones });
  });

  it('↙ 대각선 5목을 찾아요 (판 끝)', () => {
    const stones = [10, 11, 12, 13, 14].map((r) => ({ row: r, col: 24 - r }));
    const board = boardWith([['black', ...stones]]);
    expect(findWinningLine(board, { row: 12, col: 12 })).toEqual({
      direction: 'anti-diagonal',
      stones,
    });
  });

  it('6목 이상도 승리이고, 이어진 돌을 모두 돌려줘요', () => {
    const board = boardWith([['black', ...row(0, [0, 1, 2, 3, 4, 5])]]);
    expect(findWinningLine(board, { row: 0, col: 2 })?.stones).toEqual(row(0, [0, 1, 2, 3, 4, 5]));
  });

  it('4목은 승리가 아니에요', () => {
    const board = boardWith([['black', ...row(7, [3, 4, 5, 6])]]);
    expect(findWinningLine(board, { row: 7, col: 6 })).toBeNull();
  });

  it('상대 돌로 막히면 이어지지 않아요', () => {
    const board = boardWith([
      ['black', ...row(7, [3, 4, 6, 7, 8])],
      ['white', ...row(7, [5])],
    ]);
    expect(findWinningLine(board, { row: 7, col: 4 })).toBeNull();
    expect(findWinningLine(board, { row: 7, col: 7 })).toBeNull();
  });

  it('빈 칸이면 null이에요', () => {
    expect(findWinningLine(createBoard(), { row: 0, col: 0 })).toBeNull();
  });
});

describe('placeStone', () => {
  it('입력 판을 바꾸지 않고 새 판을 돌려줘요', () => {
    const board = createBoard();
    const result = placeStone(board, { row: 7, col: 7 }, 'black');
    expect(result).toMatchObject({ ok: true, outcome: { type: 'continue' } });
    expect(board[7][7]).toBeNull();
    if (result.ok) expect(result.board[7][7]).toBe('black');
  });

  it('이미 돌이 있는 곳에는 둘 수 없어요', () => {
    const board = boardWith([['white', { row: 7, col: 7 }]]);
    expect(placeStone(board, { row: 7, col: 7 }, 'black')).toEqual({ ok: false, error: 'occupied' });
  });

  it('판 밖에는 둘 수 없어요', () => {
    const board = createBoard();
    expect(placeStone(board, { row: 15, col: 0 }, 'black')).toEqual({
      ok: false,
      error: 'out-of-bounds',
    });
    expect(placeStone(board, { row: 0, col: -1 }, 'black')).toEqual({
      ok: false,
      error: 'out-of-bounds',
    });
    expect(placeStone(board, { row: 0.5, col: 0 }, 'black')).toEqual({
      ok: false,
      error: 'out-of-bounds',
    });
  });

  it('5목을 완성하면 승리예요', () => {
    const board = boardWith([['black', ...row(7, [3, 4, 6, 7])]]);
    const result = placeStone(board, { row: 7, col: 5 }, 'black');
    expect(result).toMatchObject({
      ok: true,
      outcome: { type: 'win', line: { direction: 'horizontal' } },
    });
  });

  it('마지막 칸을 채워도 승리가 없으면 무승부예요', () => {
    // 2칸씩 색을 번갈아 채우고 행마다 한 칸 밀어서 어느 방향으로도 5목이 안 생기게 해요.
    const board = createBoard().map((r, ri) =>
      r.map((_, ci): Stone => (Math.floor((ci + ri) / 2) % 2 === 0 ? 'black' : 'white')),
    );
    const last = { row: 14, col: 14 };
    const lastStone = board[last.row][last.col] as Stone;
    board[last.row][last.col] = null;

    expect(isBoardFull(board)).toBe(false);
    expect(placeStone(board, last, lastStone)).toMatchObject({ ok: true, outcome: { type: 'draw' } });
  });

  it('마지막 칸에서 5목이 생기면 무승부가 아니라 승리예요', () => {
    const board = createBoard().map((r, ri) =>
      r.map((_, ci): Stone => (Math.floor((ci + ri) / 2) % 2 === 0 ? 'black' : 'white')),
    );
    for (const p of row(14, [10, 11, 12, 13])) board[p.row][p.col] = 'black';
    board[14][14] = null;

    expect(placeStone(board, { row: 14, col: 14 }, 'black')).toMatchObject({
      ok: true,
      outcome: { type: 'win' },
    });
  });
});

describe('toCoordinateLabel', () => {
  it('열은 A–O, 행은 아래부터 1–15예요', () => {
    expect(toCoordinateLabel({ row: 14, col: 0 })).toBe('A1');
    expect(toCoordinateLabel({ row: 0, col: 14 })).toBe('O15');
    expect(toCoordinateLabel({ row: 8, col: 6 })).toBe('G7');
  });
});
