import { useState } from 'react';
import type { JoinResolution, RoomSummary } from '@gomoku/shared';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { request } from '../lib/request';
import { errorMessage, type RequestErrorCode } from '../lib/errors';
import { formatCreatedAt } from '../lib/format';
import { Logo, Marquee } from '../components/Marquee';
import './JoinFailedScreen.css';

export type FailedResolution = Exclude<JoinResolution, 'accepted'>;

/** 끝난 이유는 도장과 문장으로 남겨요 (ux-spec 4장 03 거절 상태). */
const REASONS: Record<FailedResolution, { stamp: string; text: string }> = {
  rejected: { stamp: '거절', text: '방장이 요청을 거절했어요.' },
  expired: { stamp: '시간 초과', text: '60초 동안 방장의 응답이 없었어요.' },
  taken: { stamp: '다른 상대와 시작', text: '방장이 다른 상대와 대국을 시작했어요.' },
  'room-closed': { stamp: '방 닫힘', text: '방장이 방을 닫았어요.' },
};

type Props = {
  status: ConnectionStatus;
  room: RoomSummary;
  resolution: FailedResolution;
  nickname: string;
  onBackToList: () => void;
  onRoomCreated: (room: RoomSummary) => void;
};

/** 03 참가자 · 입장하지 못함 */
export const JoinFailedScreen = ({ status, room, resolution, nickname, onBackToList, onRoomCreated }: Props) => {
  const reason = REASONS[resolution];
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<RequestErrorCode | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    const result = await request('room:create', { nickname });
    setCreating(false);
    if (result.ok) onRoomCreated(result.data);
    else setError(result.error);
  };

  return (
    <div className="screen">
      <Marquee status={status}>
        <Logo />
      </Marquee>

      <main className="failed">
        <h1 className="t-big">입장하지 못했어요</h1>

        <section className="panel failed__ticket" aria-label="요청한 방">
          <p className="t-body muted">요청한 방</p>
          <p className="t-title failed__host">{room.hostNickname}</p>
          <p className="t-body muted num">{formatCreatedAt(room.createdAt)}</p>
          <span className="stamp failed__stamp">{reason.stamp}</span>
        </section>

        <p className="t-label" role="status">
          {reason.text}
        </p>

        <div className="failed__actions">
          {error && (
            <p className="t-body field__error" role="alert">
              {errorMessage(error)}
            </p>
          )}
          <button className="btn btn--coin btn--wide" type="button" onClick={onBackToList}>
            방 목록으로
          </button>
          <button
            className="btn btn--ghost btn--wide"
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || status !== 'connected'}
          >
            내 방 만들기
          </button>
        </div>
      </main>
    </div>
  );
};
