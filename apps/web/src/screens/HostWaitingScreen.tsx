import { useRef, useState } from 'react';
import type { PendingJoinRequest, RoomSummary } from '@gomoku/shared';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { deadlineFrom, secondsLeft, useCountdown } from '../hooks/useCountdown';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { request } from '../lib/request';
import { errorMessage, type RequestErrorCode } from '../lib/errors';
import { Marquee } from '../components/Marquee';
import { LOW_MS, Meter } from '../components/Meter';
import { PixelIcon, PixelStone } from '../components/Pixel';
import './HostWaitingScreen.css';

const REQUEST_TTL_MS = 60_000;
/** 남은 시간이 이보다 적을 때 사라진 요청은 시간 초과로 봐요. 그 외에는 참가자가 취소한 거예요. */
const EXPIRY_GRACE_MS = 2000;
/** 끝난 요청 도장은 최근 것만 남겨요. */
const MAX_GHOSTS = 3;

type Card = { requestId: string; nickname: string; deadline: number };

const toCard = (r: PendingJoinRequest): Card => ({ requestId: r.requestId, nickname: r.nickname, deadline: deadlineFrom(r.remainingMs) });
type Ghost = { requestId: string; nickname: string; reason: 'expired' | 'cancelled' };

type Props = {
  status: ConnectionStatus;
  room: RoomSummary;
  /** 다시 연결해서 돌아왔을 때 서버가 보내 준 대기 중인 요청 */
  initialRequests?: PendingJoinRequest[];
  onClosed: () => void;
  onMatched: (guestNickname: string) => void;
};

/** 02 방장 · 대기실 (ux-spec 4장) */
export const HostWaitingScreen = ({ status, room, initialRequests = [], onClosed, onMatched }: Props) => {
  const [cards, setCards] = useState<Card[]>(() => initialRequests.map(toCard));
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<RequestErrorCode | null>(null);
  /** 내가 거절해서 사라진 요청은 도장으로 남기지 않아요. */
  const decidedByMe = useRef(new Set<string>());

  useSocketEvent('join:requests', (requests: PendingJoinRequest[]) => {
    const incoming = new Set(requests.map((r) => r.requestId));
    const now = Date.now();
    const gone = cards
      .filter((c) => !incoming.has(c.requestId) && !decidedByMe.current.has(c.requestId))
      .map<Ghost>((c) => ({
        requestId: c.requestId,
        nickname: c.nickname,
        reason: c.deadline - now <= EXPIRY_GRACE_MS ? 'expired' : 'cancelled',
      }));
    if (gone.length) setGhosts((g) => [...gone, ...g].slice(0, MAX_GHOSTS));
    setCards(requests.map(toCard));
  });

  const handleClose = async () => {
    setBusy('close');
    const result = await request('room:close');
    setBusy(null);
    // 이미 방이 없으면(not-in-room) 닫힌 것과 같아서 그대로 홈으로 가요.
    if (result.ok || result.error === 'not-in-room') onClosed();
    else setError(result.error);
  };

  const decide = async (card: Card, accept: boolean) => {
    setBusy(card.requestId);
    setError(null);
    decidedByMe.current.add(card.requestId);
    const result = await request(accept ? 'join:accept' : 'join:reject', { requestId: card.requestId });
    setBusy(null);

    if (!result.ok) {
      decidedByMe.current.delete(card.requestId);
      setError(result.error);
      return;
    }
    if (accept) onMatched(card.nickname);
    else setCards((prev) => prev.filter((c) => c.requestId !== card.requestId));
  };

  return (
    <div className="screen">
      <Marquee status={status} trailing={<span className="tag tag--lamp">내 방</span>}>
        <button
          className="iconbtn host__back"
          type="button"
          onClick={() => void handleClose()}
          disabled={busy !== null}
          aria-label="방 닫기"
        >
          <PixelIcon name="back" />
        </button>
        <h1 className="t-title marquee__grow">{room.hostNickname}</h1>
      </Marquee>

      <main className="host">
        <p className="t-body">
          방 목록에 ‘{room.hostNickname}’ 방으로 보여요. 입장 요청을 수락하면 바로 대국이 시작돼요.
        </p>

        <ul className="host__slots" aria-label="참가자 1/2">
          <li className="side side--dark">
            <PixelStone stone="black" size={28} onDark />
            <div className="side__who">
              <span className="t-title">{room.hostNickname}</span>
              <span className="t-body side__state">흑 · 방장</span>
            </div>
          </li>
          <li className="side side--empty">
            <span className="t-title host__question blink" aria-hidden="true">
              ?
            </span>
            <div className="side__who">
              <span className="t-title">도전자</span>
              <span className="t-body">백 · 빈 자리</span>
            </div>
          </li>
        </ul>

        <section className="host__requests" aria-labelledby="requests-title">
          <h2 id="requests-title" className="t-title">
            입장 요청 <span className="accent num">{cards.length}</span>
          </h2>

          {error && (
            <p className="t-body field__error" role="alert">
              {errorMessage(error)}
            </p>
          )}

          {cards.length === 0 && ghosts.length === 0 ? (
            <div className="panel host__empty">
              <div className="chase" aria-hidden="true">
                <span className="lampdot" />
                <span className="lampdot" />
                <span className="lampdot" />
              </div>
              <p className="t-body muted">아직 입장 요청이 없어요</p>
            </div>
          ) : (
            <ul className="host__cards" aria-live="polite">
              {cards.map((card) => (
                <RequestCard
                  key={card.requestId}
                  card={card}
                  disabled={busy !== null}
                  onAccept={() => void decide(card, true)}
                  onReject={() => void decide(card, false)}
                />
              ))}
              {ghosts.map((ghost) => (
                <li key={ghost.requestId} className="host__ghost">
                  <div className="host__ghost-info">
                    <span className="t-title">{ghost.nickname}</span>
                    <span className="t-body">
                      {ghost.reason === 'expired' ? '응답이 없어 자동으로 취소됐어요' : '참가자가 요청을 취소했어요'}
                    </span>
                  </div>
                  <span className="stamp">{ghost.reason === 'expired' ? '시간 초과' : '요청 취소'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="t-body muted">
          요청은 60초 안에 답하지 않으면 자동으로 취소돼요. 한 명을 수락하면 나머지 요청은 자동으로 거절돼요.
        </p>
      </main>
    </div>
  );
};

const RequestCard = ({
  card,
  disabled,
  onAccept,
  onReject,
}: {
  card: Card;
  disabled: boolean;
  onAccept: () => void;
  onReject: () => void;
}) => {
  const remaining = useCountdown(card.deadline);
  const low = remaining < LOW_MS;

  return (
    <li className="panel host__card">
      <div className="host__card-head">
        <PixelStone stone="white" size={28} />
        <span className="t-title host__card-name">{card.nickname}</span>
        <span className={low ? 't-body num low' : 't-body num muted'}>{secondsLeft(remaining)}초 후 자동 취소</span>
      </div>
      <Meter remainingMs={remaining} totalMs={REQUEST_TTL_MS} />
      <div className="host__card-actions">
        <button className="btn btn--ghost" type="button" onClick={onReject} disabled={disabled}>
          거절
        </button>
        <button className="btn btn--coin host__accept" type="button" onClick={onAccept} disabled={disabled}>
          수락하고 시작
        </button>
      </div>
    </li>
  );
};
