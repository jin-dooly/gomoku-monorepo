import { useId, useRef, useState, type FormEvent } from 'react';
import { NicknameSchema, type JoinRequestTicket, type RoomSummary } from '@gomoku/shared';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { useRoomList } from '../hooks/useRoomList';
import { request } from '../lib/request';
import { errorMessage, type RequestErrorCode } from '../lib/errors';
import { formatCreatedAt } from '../lib/format';
import { Logo, Marquee } from '../components/Marquee';
import { PixelIcon } from '../components/Pixel';
import { RulesDialog } from '../components/RulesDialog';
import './HomeScreen.css';

type Props = {
  status: ConnectionStatus;
  nickname: string;
  onNicknameChange: (nickname: string) => void;
  onRoomCreated: (room: RoomSummary) => void;
  onJoinRequested: (ticket: JoinRequestTicket) => void;
  /** 직전 화면에서 생긴 일을 알려줘요. 예: 연결이 끊겨 방이 닫힘 */
  notice: string | null;
};

/** 01 홈 · 방 목록 (ux-spec 4장) */
export const HomeScreen = ({ status, nickname, onNicknameChange, onRoomCreated, onJoinRequested, notice }: Props) => {
  const connected = status === 'connected';
  const nicknameId = useId();
  const hintId = useId();
  const [error, setError] = useState<RequestErrorCode | null>(null);
  const [creating, setCreating] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 닉네임이 맞으면 앞뒤 공백을 지운 값을, 틀리면 입력칸에 알리고 null을 돌려줘요. */
  const validNickname = (): string | null => {
    const parsed = NicknameSchema.safeParse(nickname);
    if (parsed.success) return parsed.data;
    setError('invalid-payload');
    inputRef.current?.focus();
    return null;
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const valid = validNickname();
    if (!valid) return;

    setCreating(true);
    const result = await request('room:create', { nickname: valid });
    setCreating(false);

    if (result.ok) onRoomCreated(result.data);
    else setError(result.error);
  };

  return (
    <div className="screen">
      <Marquee
        status={status}
        trailing={
          <button className="iconbtn home__rules" type="button" onClick={() => setRulesOpen(true)}>
            <PixelIcon name="book" size={20} />
            <span className="t-body">규칙</span>
          </button>
        }
      >
        <Logo />
      </Marquee>
      {rulesOpen && <RulesDialog onClose={() => setRulesOpen(false)} />}

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
              ref={inputRef}
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

        <RoomList status={status} validNickname={validNickname} onJoinRequested={onJoinRequested} />
      </main>
    </div>
  );
};

type RoomListProps = {
  status: ConnectionStatus;
  validNickname: () => string | null;
  onJoinRequested: (ticket: JoinRequestTicket) => void;
};

const RoomList = ({ status, validNickname, onJoinRequested }: RoomListProps) => {
  const connected = status === 'connected';
  const { state, refresh } = useRoomList(connected);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<{ roomId: string; code: RequestErrorCode } | null>(null);

  const handleJoin = async (room: RoomSummary) => {
    const nickname = validNickname();
    if (!nickname) return;

    setJoining(room.id);
    setJoinError(null);
    const result = await request('join:request', { roomId: room.id, nickname });
    setJoining(null);

    if (result.ok) {
      onJoinRequested(result.data);
      return;
    }
    setJoinError({ roomId: room.id, code: result.error });
    // 방이 사라졌거나 대국이 시작됐으면 목록이 낡은 거라 다시 불러와요. 에러 문구는 목록 위에 남겨요.
    if (result.error === 'room-not-found' || result.error === 'room-not-waiting') void refresh();
  };
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

      {joinError && !rooms?.some((r) => r.id === joinError.roomId) && (
        <p className="t-body field__error" role="alert">
          {errorMessage(joinError.code)}
        </p>
      )}

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
            <RoomRow
              key={room.id}
              room={room}
              joining={joining === room.id}
              disabled={!connected || joining !== null}
              error={joinError?.roomId === room.id ? joinError.code : null}
              onJoin={() => void handleJoin(room)}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

type RoomRowProps = {
  room: RoomSummary;
  joining: boolean;
  disabled: boolean;
  error: RequestErrorCode | null;
  onJoin: () => void;
};

const RoomRow = ({ room, joining, disabled, error, onJoin }: RoomRowProps) => {
  const playing = room.status === 'playing';
  return (
    <li className={playing ? 'room room--busy' : 'room'}>
      <div className="room__info">
        <span className="t-title room__host">{room.hostNickname}</span>
        <span className="t-body muted num">{formatCreatedAt(room.createdAt)}</span>
        {error && <span className="t-body field__error">{errorMessage(error)}</span>}
      </div>
      {playing ? (
        <span className="chip">대국 중</span>
      ) : (
        <button
          className="btn btn--coin btn--row"
          type="button"
          onClick={onJoin}
          disabled={disabled}
          aria-busy={joining}
          aria-label={`${room.hostNickname} 방에 입장 요청`}
        >
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
