import { useId, useState, type FormEvent } from 'react';
import { NicknameSchema, type RoomSummary } from '@gomoku/shared';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { useRoomList } from '../hooks/useRoomList';
import { request } from '../lib/request';
import { errorMessage, type RequestErrorCode } from '../lib/errors';
import { formatCreatedAt } from '../lib/format';
import { Logo, Marquee } from '../components/Marquee';
import { PixelIcon } from '../components/Pixel';
import './HomeScreen.css';

type Props = {
  status: ConnectionStatus;
  nickname: string;
  onNicknameChange: (nickname: string) => void;
  onRoomCreated: (room: RoomSummary) => void;
  /** 직전 화면에서 생긴 일을 알려줘요. 예: 연결이 끊겨 방이 닫힘 */
  notice: string | null;
};

/** 01 홈 · 방 목록 (ux-spec 4장) */
export const HomeScreen = ({ status, nickname, onNicknameChange, onRoomCreated, notice }: Props) => {
  const connected = status === 'connected';
  const nicknameId = useId();
  const hintId = useId();
  const [error, setError] = useState<RequestErrorCode | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = NicknameSchema.safeParse(nickname);
    if (!parsed.success) {
      setError('invalid-payload');
      return;
    }

    setCreating(true);
    const result = await request('room:create', { nickname: parsed.data });
    setCreating(false);

    if (result.ok) onRoomCreated(result.data);
    else setError(result.error);
  };

  return (
    <div className="screen">
      <Marquee status={status}>
        <Logo />
      </Marquee>

      {status === 'waking' && (
        <div className="banner" role="status">
          <PixelIcon name="hourglass" size={28} className="home__banner-icon" />
          <div>
            <p className="t-title">서버를 깨우는 중이에요</p>
            <p className="t-body">처음 접속하면 최대 1분 걸릴 수 있어요</p>
          </div>
        </div>
      )}

      <main className="home">
        {notice && (
          <p className="panel t-body home__notice" role="status">
            {notice}
          </p>
        )}
        <form className="home__create" onSubmit={handleCreate} noValidate>
          <div className="field">
            <label className="t-title" htmlFor={nicknameId}>
              닉네임
            </label>
            <input
              id={nicknameId}
              className="input"
              value={nickname}
              onChange={(e) => {
                onNicknameChange(e.target.value);
                setError(null);
              }}
              autoComplete="nickname"
              enterKeyHint="go"
              aria-invalid={error === 'invalid-payload'}
              aria-describedby={hintId}
            />
            <p id={hintId} className={error ? 't-body field__error' : 't-body muted'} aria-live="polite">
              {error ? errorMessage(error) : '2–10자 · 방을 만들면 닉네임이 방 이름이 돼요'}
            </p>
          </div>
          <button className="btn btn--coin btn--wide" type="submit" disabled={!connected || creating} aria-busy={creating}>
            방 만들기
          </button>
        </form>

        <RoomList status={status} />
      </main>
    </div>
  );
};

const RoomList = ({ status }: { status: ConnectionStatus }) => {
  const connected = status === 'connected';
  const { state, refresh } = useRoomList(connected);
  const rooms = 'rooms' in state ? state.rooms : null;
  const loading = state.status === 'loading';

  return (
    <section className="home__rooms" aria-labelledby="room-list-title" aria-busy={loading}>
      <div className="home__rooms-head">
        <h2 id="room-list-title" className="t-title">
          방 목록{rooms && <span className="accent num"> {rooms.length}</span>}
        </h2>
        <button
          className="iconbtn"
          type="button"
          onClick={() => void refresh()}
          disabled={!connected || loading}
          aria-label="방 목록 새로고침"
        >
          <PixelIcon name="refresh" className={loading ? 'blink' : undefined} />
        </button>
      </div>

      {state.status === 'error' && (
        <p className="t-body field__error" role="alert">
          {errorMessage(state.error)}
        </p>
      )}

      {rooms === null ? (
        <Placeholder
          text={
            status === 'waking'
              ? '서버가 깨어나면 방 목록을 불러와요'
              : status === 'reconnecting'
                ? '다시 연결되면 방 목록을 불러와요'
                : '방 목록을 불러오는 중이에요'
          }
          busy={state.status !== 'error'}
        />
      ) : rooms.length === 0 ? (
        <div className="panel home__empty">
          <p className="t-title">아직 열린 방이 없어요</p>
          <p className="t-body muted">방을 만들면 다른 사람의 목록에 보여요</p>
        </div>
      ) : (
        <ul className="home__list">
          {rooms.map((room) => (
            <RoomRow key={room.id} room={room} />
          ))}
        </ul>
      )}
    </section>
  );
};

const RoomRow = ({ room }: { room: RoomSummary }) => {
  const playing = room.status === 'playing';
  return (
    <li className={playing ? 'room room--busy' : 'room'}>
      <div className="room__info">
        <span className="t-title room__host">{room.hostNickname}</span>
        <span className="t-body muted num">{formatCreatedAt(room.createdAt)}</span>
      </div>
      {playing ? (
        <span className="chip">대국 중</span>
      ) : (
        // 입장 요청은 2단계에서 서버와 함께 연결해요.
        <button className="btn btn--coin btn--row" type="button" disabled>
          입장 요청
        </button>
      )}
    </li>
  );
};

const Placeholder = ({ text, busy }: { text: string; busy: boolean }) => (
  <div className="panel home__empty">
    {busy && (
      <div className="chase" aria-hidden="true">
        <span className="lampdot" />
        <span className="lampdot" />
        <span className="lampdot" />
      </div>
    )}
    <p className="t-body muted">{text}</p>
  </div>
);
