import { useRef, type KeyboardEvent } from 'react';
import {
  BOARD_SIZE,
  toCoordinateLabel,
  type Board as BoardCells,
  type Position,
  type Stone,
  type WinningLine,
} from '@gomoku/shared';
import { PixelStone } from './Pixel';
import './Board.css';

type Props = {
  board: BoardCells;
  /** 마지막 수에 주황 점을 찍어요. */
  lastMove: Position | null;
  /** 내가 고른 위치. 반투명 돌과 청록 점선으로 보여줘요. */
  preview: Position | null;
  /** 미리보기 돌의 색(내 색) */
  previewStone: Stone;
  /** 이긴 돌에 청록 링을 둘러요. */
  winningLine: WinningLine | null;
  /** 내 차례이고 대국 중일 때만 눌러요 (ux-spec 05: 내 차례가 아니면 판을 누를 수 없어요). */
  interactive: boolean;
  onPick: (position: Position) => void;
};

/** 화점 5개 (ux-spec 4장 오목판) */
const STARS = new Set(['3,3', '3,11', '11,3', '11,11', '7,7']);
const key = (row: number, col: number) => `${row},${col}`;
const CENTER: Position = { row: 7, col: 7 };

/**
 * 15×15 도트 오목판. 돌은 교차점에 둬요.
 * 키보드로도 둘 수 있게 판 전체를 하나의 격자로 다루고, 방향키로 미리보기를 옮겨요.
 */
export const Board = ({ board, lastMove, preview, previewStone, winningLine, interactive, onPick }: Props) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const winning = new Set(winningLine?.stones.map((p) => key(p.row, p.col)));
  const focusTarget = preview ?? lastMove ?? CENTER;

  const moveFocus = (e: KeyboardEvent<HTMLButtonElement>, from: Position) => {
    const delta: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const row = Math.min(BOARD_SIZE - 1, Math.max(0, from.row + d[0]));
    const col = Math.min(BOARD_SIZE - 1, Math.max(0, from.col + d[1]));
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${key(row, col)}"]`)?.focus();
    // 키보드로 옮겨 다니면 빈 자리에서는 미리보기도 따라가요.
    if (!board[row][col]) onPick({ row, col });
  };

  return (
    <div className="board" role="grid" aria-label="오목판" aria-disabled={!interactive} ref={gridRef}>
      <svg className="board__lines" viewBox="0 0 15 15" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {Array.from({ length: BOARD_SIZE }, (_, i) => (
          <g key={i}>
            <line x1="0.5" y1={i + 0.5} x2={BOARD_SIZE - 0.5} y2={i + 0.5} />
            <line x1={i + 0.5} y1="0.5" x2={i + 0.5} y2={BOARD_SIZE - 0.5} />
          </g>
        ))}
      </svg>

      {board.map((row, r) => (
        <div className="board__row" role="row" key={r}>
          {row.map((cell, c) => {
            const pos = { row: r, col: c };
            const k = key(r, c);
            const isPreview = !cell && preview?.row === r && preview?.col === c;
            const isLast = lastMove?.row === r && lastMove?.col === c;
            const label = `${toCoordinateLabel(pos)}, ${cell === 'black' ? '흑' : cell === 'white' ? '백' : '빈 자리'}${isLast ? ', 마지막 수' : ''}${winning.has(k) ? ', 이긴 줄' : ''}`;
            const isFocusTarget = focusTarget.row === r && focusTarget.col === c;

            return (
              <button
                key={c}
                type="button"
                role="gridcell"
                className="board__cell"
                data-cell={k}
                aria-label={label}
                aria-selected={isPreview}
                tabIndex={interactive && isFocusTarget ? 0 : -1}
                disabled={!interactive}
                onClick={() => !cell && onPick(pos)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!cell) onPick(pos);
                    return;
                  }
                  moveFocus(e, pos);
                }}
              >
                {STARS.has(k) && !cell && !isPreview && <span className="board__star" />}
                {cell && (
                  <span className={winning.has(k) ? 'board__stone board__stone--win' : 'board__stone'}>
                    <PixelStone stone={cell} size={100} className="board__sprite" />
                  </span>
                )}
                {isPreview && (
                  <span className="board__preview">
                    <PixelStone stone={previewStone} size={100} className="board__sprite" />
                  </span>
                )}
                {isLast && !winning.size && <span className="board__last" />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
