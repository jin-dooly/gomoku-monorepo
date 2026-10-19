import { useState } from 'react';
import type { JoinRequestTicket } from '@gomoku/shared';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { deadlineFrom, formatClock, useCountdown } from '../hooks/useCountdown';
import { request } from '../lib/request';
import { errorMessage, type RequestErrorCode } from '../lib/errors';
import { formatCreatedAt } from '../lib/format';
import { Logo, Marquee } from '../components/Marquee';
import { LOW_MS, Meter } from '../components/Meter';
import { PixelStone } from '../components/Pixel';
import './GuestWaitingScreen.css';

/** 서버의 입장 요청 유효 시간과 같아요 (ux-spec 3장). */
const REQUEST_TTL_MS = 60_000;

type Props = {
  status: ConnectionStatus;
  ticket: JoinRequestTicket;
  onCancelled: () => void;
};

/**
 * 03 참가자 · 승인 대기 (ux-spec 4장).
 * 결과(join:resolved)는 이 화면이 뜨기 직전에 올 수도 있어서 App이 받아요.
 */
export const GuestWaitingScreen = ({ status, ticket, onCancelled }: Props) => {
  const [deadline] = useState(() => deadlineFrom(ticket.remainingMs));
  const remaining = useCountdown(deadline);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<RequestErrorCode | null>(null);
  const host = ticket.room.hostNickname;

  const handleCancel = async () => {
    setCancelling(true);
    const result = await request('join:cancel');
    setCancelling(false);
    // 요청이 이미 끝났으면(request-not-found) 곧 결과가 오지만, 사용자가 취소를 원했으니 바로 돌아가요.
    if (result.ok || result.error === 'request-not-found') onCancelled();
    else setError(result.error);
  };

  return (
    <div className="screen">
      <Marquee status={status}>
        <Logo />
      </Marquee>

      <main className="guest">
        <div className="guest__hero">
          <PixelStone stone="white" size={80} />
          <h1 className="t-big">
            {host} 님의 수락을
            <br />
            기다리고 있어요
          </h1>
        </div>

        <section className="panel guest__room" aria-label="요청한 방">
          <div className="guest__room-row">
            <div>
              <p className="t-body muted">요청한 방</p>
              <p className="t-title">{host}</p>
            </div>
            <p className="t-body muted num guest__created">{formatCreatedAt(ticket.room.createdAt)}</p>
          </div>
          <div className="guest__color">
            <PixelStone stone="white" />
            <p className="t-body">나는 백으로, 방장이 먼저 둬요</p>
          </div>
        </section>

        <section className="guest__timer" aria-label="자동 취소까지 남은 시간">
          <div className="guest__timer-row">
            <span className="t-body muted">자동 취소까지</span>
            <span className={remaining < LOW_MS ? 't-hero num low' : 't-hero num accent'} role="timer">
              {formatClock(remaining)}
            </span>
          </div>
          <Meter remainingMs={remaining} totalMs={REQUEST_TTL_MS} />
        </section>

        <div className="guest__actions">
          {error && (
            <p className="t-body field__error" role="alert">
              {errorMessage(error)}
            </p>
          )}
          <button className="btn btn--ghost btn--wide" type="button" onClick={() => void handleCancel()} disabled={cancelling}>
            요청 취소
          </button>
        </div>
      </main>
    </div>
  );
};
