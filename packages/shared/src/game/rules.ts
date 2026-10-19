/**
 * 오목 규칙 (docs/ux-spec.md 3장)
 * - 15×15 교차점, 흑이 먼저 둬요.
 * - 가로·세로·대각선으로 5개 이상 이으면 승리 (6목 이상도 승리, 렌주 금수 없음).
 * - 판이 가득 차면 무승부.
 *
 * 서버와 클라이언트가 같이 쓰는 순수 함수만 둬요. 입력을 바꾸지 않아요.
 */

export const BOARD_SIZE = 15;
export const WIN_LENGTH = 5;

export type Stone = 'black' | 'white';
export type Cell = Stone | null;
export type Board = Cell[][];

export type Position = { row: number; col: number };

export type LineDirection = 'horizontal' | 'vertical' | 'diagonal' | 'anti-diagonal';

export type WinningLine = {
  direction: LineDirection;
  /** 이어진 돌 전체(5개 이상), 한쪽 끝부터 순서대로 */
  stones: Position[];
};

export type MoveOutcome =
  | { type: 'continue' }
  | { type: 'win'; line: WinningLine }
  | { type: 'draw' };

export type PlaceStoneResult =
  | { ok: true; board: Board; outcome: MoveOutcome }
  | { ok: false; error: 'out-of-bounds' | 'occupied' };

const DIRECTIONS: { direction: LineDirection; dRow: number; dCol: number }[] = [
  { direction: 'horizontal', dRow: 0, dCol: 1 },
  { direction: 'vertical', dRow: 1, dCol: 0 },
  { direction: 'diagonal', dRow: 1, dCol: 1 },
  { direction: 'anti-diagonal', dRow: 1, dCol: -1 },
];

export const createBoard = (): Board =>
  Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(null));

export const isInBounds = ({ row, col }: Position): boolean =>
  Number.isInteger(row) &&
  Number.isInteger(col) &&
  row >= 0 &&
  row < BOARD_SIZE &&
  col >= 0 &&
  col < BOARD_SIZE;

export const oppositeStone = (stone: Stone): Stone => (stone === 'black' ? 'white' : 'black');

export const isBoardFull = (board: Board): boolean =>
  board.every((row) => row.every((cell) => cell !== null));

/** `position`에 놓인 돌을 지나는 5목 이상의 줄을 찾아요. 없으면 null. */
export const findWinningLine = (board: Board, position: Position): WinningLine | null => {
  const stone = board[position.row]?.[position.col];
  if (!stone) return null;

  const sameStone = (p: Position) => isInBounds(p) && board[p.row][p.col] === stone;

  for (const { direction, dRow, dCol } of DIRECTIONS) {
    let start = position;
    while (sameStone({ row: start.row - dRow, col: start.col - dCol })) {
      start = { row: start.row - dRow, col: start.col - dCol };
    }

    const stones: Position[] = [];
    let current = start;
    while (sameStone(current)) {
      stones.push(current);
      current = { row: current.row + dRow, col: current.col + dCol };
    }

    if (stones.length >= WIN_LENGTH) return { direction, stones };
  }

  return null;
};

/** 돌을 놓은 새 판과 결과를 돌려줘요. 차례 확인은 호출하는 쪽에서 해요. */
export const placeStone = (board: Board, position: Position, stone: Stone): PlaceStoneResult => {
  if (!isInBounds(position)) return { ok: false, error: 'out-of-bounds' };
  if (board[position.row][position.col] !== null) return { ok: false, error: 'occupied' };

  const next = board.map((row) => [...row]);
  next[position.row][position.col] = stone;

  const line = findWinningLine(next, position);
  if (line) return { ok: true, board: next, outcome: { type: 'win', line } };
  if (isBoardFull(next)) return { ok: true, board: next, outcome: { type: 'draw' } };
  return { ok: true, board: next, outcome: { type: 'continue' } };
};

const COLUMN_LABELS = 'ABCDEFGHIJKLMNO';

/**
 * 화면에 보여줄 좌표 이름이에요(예: "G7").
 * 열은 왼쪽부터 A–O, 행은 아래쪽부터 1–15 (바둑·오목 기보 관례).
 */
export const toCoordinateLabel = ({ row, col }: Position): string =>
  `${COLUMN_LABELS[col]}${BOARD_SIZE - row}`;
