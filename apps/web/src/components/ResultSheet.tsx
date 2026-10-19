import { useState } from 'react';
import type { GameOverPayload, LineDirection, RoomSummary, Stone } from '@gomoku/shared';
import { request } from '../lib/request';
import { errorMessage, type RequestErrorCode } from '../lib/errors';
import './ResultSheet.css';

export type OpponentGone = 'left' | 'disconnect';

type Props = {
  over: GameOverPayload;
  me: Stone;
  opponentName: string;
  isHost: boolean;
  /** 재대결을 요청한 사람의 이번 판 색 */
  rematch: Stone[];
  /** 상대가 방을 나갔거나 연결이 끊겼어요. 재대결할 수 없어요. */
  opponentGone: OpponentGone | null;
  onLeft: () => void;
  onReopened: (room: RoomSummary) => void;
};

const STONE_LABEL: Record<Stone, string> = { black: '흑', white: '백' };
const DIRECTION_LABEL: Record<LineDirection, string> = {
  horizontal: '가로',
  vertical: '세로',
  diagonal: '대각선',
  'anti-diagonal': '대각선',
};

/**
 * 06 결과 · 재대결 시트 (ux-spec 4장, 결정 기록 2026-10-19).
 * - 제목: 승리만 청록, 패배·무승부는 종이색
 * - 상대가 나가거나 연결이 끊기면 재대결 없이, 방장은 [대기실로 돌아가기]와 [로비로 나가기] 중에 골라요.
 */
export const ResultSheet = ({ over, me, opponentName, isHost, rematch, opponentGone, onLeft, onReopened }: Props) => {
  const [busy, setBusy] = useState<'rematch' | 'leave' | 'reopen' | null>(null);
  const [error, setError] = useState<RequestErrorCode | null>(null);

  const won = over.winner === me;
  const title = over.winner === null ? '비겼어요' : won ? '승리했어요' : '졌어요';
  const iAsked = rematch.includes(me);
  const theyAsked = rematch.some((stone) => stone !== me);

  const run = async (kind: 'rematch' | 'leave' | 'reopen') => {
    setBusy(kind);
    setError(null);
    if (kind === 'leave') {
      // 방이 이미 사라졌어도(not-in-room) 로비로 가요.
      await request('room:leave');
      onLeft();
      return;
    }
    if (kind === 'reopen') {
      const result = await request('room:reopen');
      setBusy(null);
      if (result.ok) onReopened(result.data);
      else setError(result.error);
      return;
    }
    const result = await request('rematch:request');
    setBusy(null);
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="result">
      <div className="result__head">
        <h2 className={won ? 't-hero accent' : 't-hero'}>{title}</h2>
        <p className="t-body">{summaryOf(over, me, opponentName)}</p>
      </div>

      <p className="result__status t-body" role="status">
        <span className={opponentGone || !(iAsked || theyAsked) ? 'lampdot lampdot--off' : 'lampdot blink'} aria-hidden="true" />
        {opponentGone === 'left'
          ? `${opponentName} 님이 방을 나가서 재대결할 수 없어요`
          : opponentGone === 'disconnect'
            ? `${opponentName} 님의 연결이 끊겨서 재대결할 수 없어요`
            : theyAsked
              ? `${opponentName} 님이 재대결을 원해요`
              : iAsked
                ? `${opponentName} 님의 답을 기다리고 있어요`
                : '아직 아무도 재대결을 요청하지 않았어요'}
      </p>

      {error && (
        <p className="t-body field__error" role="alert">
          {errorMessage(error)}
        </p>
      )}

      <div className="result__actions">
        {opponentGone ? (
          isHost ? (
            <>
              <button className="btn btn--ghost" type="button" onClick={() => void run('leave')} disabled={busy !== null}>
                로비로 나가기
              </button>
              <button
                className="btn btn--coin result__main"
                type="button"
                onClick={() => void run('reopen')}
                disabled={busy !== null}
              >
                대기실로 돌아가기
              </button>
            </>
          ) : (
            <button className="btn btn--coin btn--wide" type="button" onClick={() => void run('leave')} disabled={busy !== null}>
              로비로 나가기
            </button>
          )
        ) : (
          <>
            <button className="btn btn--ghost" type="button" onClick={() => void run('leave')} disabled={busy !== null}>
              로비로 나가기
            </button>
            <button
              className="btn btn--coin result__main"
              type="button"
              onClick={() => void run('rematch')}
              disabled={busy !== null || iAsked}
              aria-busy={busy === 'rematch'}
            >
              {iAsked ? '답을 기다리는 중' : theyAsked ? '재대결 수락' : '재대결 요청'}
            </button>
          </>
        )}
      </div>

      {!opponentGone && <p className="t-body muted">재대결하면 흑과 백이 바뀌어요</p>}
    </div>
  );
};

const summaryOf = (over: GameOverPayload, me: Stone, opponentName: string): string => {
  const moves = `총 ${over.moveCount}수`;
  switch (over.reason) {
    case 'five':
      return over.winner && over.winningLine
        ? `${STONE_LABEL[over.winner]} ${DIRECTION_LABEL[over.winningLine.direction]} 5목 완성 · ${moves}`
        : moves;
    case 'draw':
      return `판이 가득 찼어요 · ${moves}`;
    case 'resign':
      return over.winner === me ? `${opponentName} 님이 기권했어요 · ${moves}` : `기권했어요 · ${moves}`;
    case 'left':
      return `${opponentName} 님이 방을 나갔어요 · ${moves}`;
    case 'disconnect':
      return `${opponentName} 님의 연결이 끊겼어요 · ${moves}`;
  }
};
