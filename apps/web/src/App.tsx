import { useEffect, useRef, useState } from 'react';
import type {
  GameOverPayload,
  GameStatePayload,
  JoinRequestTicket,
  PendingJoinRequest,
  RoomSummary,
  Stone,
} from '@gomoku/shared';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useSocketEvent } from './hooks/useSocketEvent';
import { deadlineFrom } from './hooks/useCountdown';
import { getSessionId } from './lib/session';
import { HomeScreen } from './screens/HomeScreen';
import { HostWaitingScreen } from './screens/HostWaitingScreen';
import { GuestWaitingScreen } from './screens/GuestWaitingScreen';
import { JoinFailedScreen, type FailedResolution } from './screens/JoinFailedScreen';
import { VersusScreen } from './screens/VersusScreen';
import { GameScreen } from './screens/GameScreen';
import { RestoringScreen } from './screens/RestoringScreen';
import type { OpponentGone } from './components/ResultSheet';

type Screen =
  /** 새로고침 직후: 서버가 이전 화면(session:resume)을 보내 주는지 기다려요. */
  | { name: 'restoring' }
  | { name: 'home' }
  | { name: 'host-waiting'; room: RoomSummary; requests?: PendingJoinRequest[] }
  | { name: 'guest-waiting'; ticket: JoinRequestTicket }
  | { name: 'join-failed'; room: RoomSummary; resolution: FailedResolution }
  | { name: 'versus'; black: string; white: string }
  | { name: 'game' };

const NOTICES = {
  roomLost: '연결이 오래 끊겨서 방에서 나왔어요.',
  requestLost: '연결이 끊긴 사이 입장 요청이 취소됐어요. 다시 요청해 주세요.',
} as const;

/** 연결된 뒤 이 시간 안에 이전 화면이 오지 않으면 방에서 이미 빠진 거예요. 서버는 연결 직후 바로 보내요. */
const RESUME_WAIT_MS = 1500;

const IN_ROOM: Screen['name'][] = ['host-waiting', 'guest-waiting', 'versus', 'game'];

function App() {
  const status = useConnectionStatus();
  const [nickname, setNickname] = useState('');
  // 이 탭에 세션이 있으면(새로고침) 이전 화면을 기다리고, 없으면 바로 홈이에요.
  const [screen, setScreen] = useState<Screen>(() => (getSessionId() ? { name: 'restoring' } : { name: 'home' }));
  const [notice, setNotice] = useState<string | null>(null);
  /** 수락하는 순간부터 서버가 보내는 판 상태. VS 화면 동안에도 받아 둬요. */
  const [game, setGame] = useState<GameStatePayload | null>(null);
  const [over, setOver] = useState<GameOverPayload | null>(null);
  /** 방장이면 상대가 나간 뒤 대기실로 돌아갈 수 있어요. */
  const [isHost, setIsHost] = useState(false);
  const [rematch, setRematch] = useState<Stone[]>([]);
  const [opponentLeft, setOpponentLeft] = useState<OpponentGone | null>(null);
  /** 상대 연결이 끊겼으면 30초 유예가 끝나는 시각 (07) */
  const [opponentAway, setOpponentAway] = useState<number | null>(null);
  /** 다시 연결되어 이전 화면을 받을 때마다 늘려서 대기실 같은 화면을 새 상태로 다시 그려요. */
  const [resumeCount, setResumeCount] = useState(0);

  const screenRef = useRef(screen);
  screenRef.current = screen;
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetGame = () => {
    setGame(null);
    setOver(null);
    setRematch([]);
    setOpponentLeft(null);
    setOpponentAway(null);
  };

  const go = (next: Screen) => {
    setNotice(null);
    setScreen(next);
  };
  const goHome = () => {
    resetGame();
    go({ name: 'home' });
  };

  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  // 연결될 때마다(새로고침, 재연결) 서버가 세션을 알려줘요. 방 안에 있었다면 곧바로 이전 화면이 와요.
  // 오지 않으면 30초가 지나 방에서 빠졌거나 요청이 취소된 거라 홈으로 가요.
  useSocketEvent('session:assigned', () => {
    const current = screenRef.current.name;
    if (current !== 'restoring' && !IN_ROOM.includes(current)) return;
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      const now = screenRef.current.name;
      if (now === 'restoring') {
        setScreen({ name: 'home' });
        return;
      }
      if (!IN_ROOM.includes(now)) return;
      resetGame();
      setScreen({ name: 'home' });
      setNotice(now === 'guest-waiting' ? NOTICES.requestLost : NOTICES.roomLost);
    }, RESUME_WAIT_MS);
  });

  useSocketEvent('session:resume', (resume) => {
    clearTimeout(resumeTimer.current);
    setNotice(null);
    setIsHost(resume.role === 'host');
    setResumeCount((n) => n + 1);

    if (!resume.game) {
      resetGame();
      setScreen({ name: 'host-waiting', room: resume.room, requests: resume.requests });
      return;
    }
    setGame(resume.game);
    setOver(resume.over);
    setRematch(resume.rematch);
    setOpponentLeft(resume.opponentLeft);
    setOpponentAway(resume.opponentDisconnected ? deadlineFrom(resume.opponentDisconnected.remainingMs) : null);
    // VS 화면 중이었다면 그대로 두고, 아니면 대국 화면으로
    setScreen((s) => (s.name === 'versus' ? s : { name: 'game' }));
  });

  // 요청 결과는 대기 화면이 뜨기 직전에 올 수도 있어서 여기서 받아요.
  useSocketEvent('join:resolved', ({ resolution }) => {
    if (screen.name !== 'guest-waiting') return;
    const { room } = screen.ticket;
    if (resolution === 'accepted') {
      setIsHost(false);
      go({ name: 'versus', black: room.hostNickname, white: nickname.trim() });
    } else go({ name: 'join-failed', room, resolution });
  });

  useSocketEvent('game:state', (state) => {
    // 새 판이 시작되면(수 수 0, 재대결 포함) 지난 결과와 재대결 요청을 지워요.
    if (state.moveCount === 0) {
      setOver(null);
      setRematch([]);
      setOpponentLeft(null);
    }
    setGame(state);
  });

  useSocketEvent('rematch:status', ({ requestedBy }) => setRematch(requestedBy));

  useSocketEvent('opponent:left', ({ reason }) => {
    setOpponentLeft(reason);
    setOpponentAway(null);
    setRematch([]);
  });

  useSocketEvent('opponent:disconnected', ({ remainingMs }) => setOpponentAway(deadlineFrom(remainingMs)));
  useSocketEvent('opponent:reconnected', () => setOpponentAway(null));

  useSocketEvent('game:over', (payload) => {
    setOver(payload);
    if (payload.reason === 'disconnect' || payload.reason === 'left') setOpponentAway(null);
    // VS 화면 중에 끝나도(상대가 바로 나감) 결과를 볼 수 있게 대국 화면으로 넘어가요.
    if (screen.name === 'versus') setScreen({ name: 'game' });
  });

  const onRoomCreated = (room: RoomSummary) => go({ name: 'host-waiting', room });

  switch (screen.name) {
    case 'restoring':
      return <RestoringScreen status={status} />;
    case 'host-waiting':
      return (
        <HostWaitingScreen
          key={resumeCount}
          status={status}
          room={screen.room}
          initialRequests={screen.requests}
          onClosed={goHome}
          onMatched={(guest) => {
            setIsHost(true);
            go({ name: 'versus', black: screen.room.hostNickname, white: guest });
          }}
        />
      );
    case 'guest-waiting':
      return <GuestWaitingScreen status={status} ticket={screen.ticket} onCancelled={goHome} />;
    case 'join-failed':
      return (
        <JoinFailedScreen
          status={status}
          room={screen.room}
          resolution={screen.resolution}
          nickname={nickname.trim()}
          onBackToList={goHome}
          onRoomCreated={onRoomCreated}
        />
      );
    case 'versus':
      return <VersusScreen black={screen.black} white={screen.white} onDone={() => setScreen({ name: 'game' })} />;
    case 'game':
      // 판 상태는 수락 직후에 오므로 VS 화면이 끝날 때쯤엔 있어요. 혹시 없으면 기다려요.
      return game ? (
        <GameScreen
          status={status}
          game={game}
          over={over}
          isHost={isHost}
          rematch={rematch}
          opponentLeft={opponentLeft}
          opponentAway={opponentAway}
          onLeft={goHome}
          onReopened={(room) => {
            resetGame();
            go({ name: 'host-waiting', room });
          }}
        />
      ) : (
        <RestoringScreen status={status} />
      );
    case 'home':
      return (
        <HomeScreen
          status={status}
          nickname={nickname}
          onNicknameChange={setNickname}
          onRoomCreated={onRoomCreated}
          onJoinRequested={(ticket) => go({ name: 'guest-waiting', ticket })}
          notice={notice}
        />
      );
  }
}

export default App;
