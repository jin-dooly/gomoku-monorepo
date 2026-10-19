import { useEffect, useId, useRef } from 'react';
import { RECONNECT_GRACE_MS } from '@gomoku/shared';
import { formatClock } from '../hooks/useCountdown';
import { Meter } from './Meter';
import './ConfirmDialog.css';

type Props = {
  opponentName: string;
  myName: string;
  remainingMs: number;
  onLeave: () => void;
  onWait: () => void;
};

/**
 * 07 예외 · 상대 연결 끊김 (ux-spec 4장).
 * 30초 진행 막대와 남은 시간, [나가기] / [계속 기다리기].
 * 나가기는 대국 중이라 기권이 되므로 바로 나가지 않고 09 확인창으로 넘겨요.
 */
export const OpponentAwayDialog = ({ opponentName, myName, remainingMs, onLeave, onWait }: Props) => {
  const titleId = useId();
  const descId = useId();
  const waitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => waitRef.current?.focus(), []);

  return (
    <div
      className="confirm__scrim"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onWait();
        }
      }}
    >
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
        <h2 id={titleId} className="t-title">
          {opponentName} 님의 연결이 끊겼어요
        </h2>
        <p id={descId} className="t-body">
          30초 안에 돌아오지 않으면 {myName} 님이 이겨요.
        </p>
        <div className="away__clock">
          <span className="t-body muted">돌아오기를 기다리는 중</span>
          <span className="t-hero num accent" role="timer">
            {formatClock(remainingMs)}
          </span>
        </div>
        <Meter remainingMs={remainingMs} totalMs={RECONNECT_GRACE_MS} />
        <div className="confirm__actions">
          <button className="btn btn--ghost" type="button" onClick={onLeave}>
            나가기
          </button>
          <button ref={waitRef} className="btn btn--coin confirm__go" type="button" onClick={onWait}>
            계속 기다리기
          </button>
        </div>
      </div>
    </div>
  );
};
