import { useState } from 'react';
import type { RoomSummary } from '@gomoku/shared';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { request } from '../lib/request';
import { errorMessage, type RequestErrorCode } from '../lib/errors';
import { Marquee } from '../components/Marquee';
import { PixelIcon, PixelStone } from '../components/Pixel';
import './HostWaitingScreen.css';

type Props = {
  status: ConnectionStatus;
  room: RoomSummary;
  onClosed: () => void;
};

/**
 * 02 방장 · 대기실 (ux-spec 4장).
 * 1단계에서는 요청이 없는 상태까지만 있어요. 입장 요청 카드는 2단계에서 붙여요.
 */
export const HostWaitingScreen = ({ status, room, onClosed }: Props) => {
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<RequestErrorCode | null>(null);

  const handleClose = async () => {
    setClosing(true);
    const result = await request('room:close');
    setClosing(false);

    // 이미 방이 없으면(not-in-room) 닫힌 것과 같아서 그대로 홈으로 가요.
    if (result.ok || result.error === 'not-in-room') onClosed();
    else setError(result.error);
  };

  return (
    <div className="screen">
      <Marquee
        status={status}
        trailing={<span className="tag tag--lamp">내 방</span>}
      >
        <button
          className="iconbtn host__back"
          type="button"
          onClick={() => void handleClose()}
          disabled={closing}
          aria-label="방 닫기"
        >
          <PixelIcon name="back" />
        </button>
        <h1 className="t-title marquee__grow">{room.hostNickname}</h1>
      </Marquee>

      <main className="host">
        {error && (
          <p className="t-body field__error" role="alert">
            {errorMessage(error)}
          </p>
        )}

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
            입장 요청 <span className="accent num">0</span>
          </h2>
          <div className="panel host__empty">
            <div className="chase" aria-hidden="true">
              <span className="lampdot" />
              <span className="lampdot" />
              <span className="lampdot" />
            </div>
            <p className="t-body muted">아직 입장 요청이 없어요</p>
          </div>
        </section>

        <p className="t-body muted">
          요청은 60초 안에 답하지 않으면 자동으로 취소돼요. 한 명을 수락하면 나머지 요청은 자동으로 거절돼요.
        </p>
      </main>
    </div>
  );
};
