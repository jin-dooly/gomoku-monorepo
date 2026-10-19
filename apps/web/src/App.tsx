import { useEffect, useState } from 'react';
import type { GameOverPayload, GameStatePayload, JoinRequestTicket, RoomSummary, Stone } from '@gomoku/shared';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useSocketEvent } from './hooks/useSocketEvent';
import { HomeScreen } from './screens/HomeScreen';
import { HostWaitingScreen } from './screens/HostWaitingScreen';
import { GuestWaitingScreen } from './screens/GuestWaitingScreen';
import { JoinFailedScreen, type FailedResolution } from './screens/JoinFailedScreen';
import { VersusScreen } from './screens/VersusScreen';
import { GameScreen } from './screens/GameScreen';
import type { OpponentGone } from './components/ResultSheet';

type Screen =
  | { name: 'home' }
  | { name: 'host-waiting'; room: RoomSummary }
  | { name: 'guest-waiting'; ticket: JoinRequestTicket }
  | { name: 'join-failed'; room: RoomSummary; resolution: FailedResolution }
  | { name: 'versus'; black: string; white: string }
  | { name: 'game' };

const NOTICES = {
  disconnected: '서버와 연결이 끊겨서 방에서 나왔어요. 다시 연결되면 새로 시작해 주세요.',
} as const;

const IN_ROOM: Screen['name'][] = ['host-waiting', 'guest-waiting', 'versus', 'game'];

function App() {
  const status = useConnectionStatus();
  const [nickname, setNickname] = useState('');
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [notice, setNotice] = useState<string | null>(null);
  /** 수락하는 순간부터 서버가 보내는 판 상태. VS 화면 동안에도 받아 둬요. */
  const [game, setGame] = useState<GameStatePayload | null>(null);
  const [over, setOver] = useState<GameOverPayload | null>(null);
  /** 방장이면 상대가 나간 뒤 대기실로 돌아갈 수 있어요. 수락한 쪽(방장)인지 요청한 쪽인지로 정해져요. */
  const [isHost, setIsHost] = useState(false);
  const [rematch, setRematch] = useState<Stone[]>([]);
  const [opponentLeft, setOpponentLeft] = useState<OpponentGone | null>(null);

  const resetGame = () => {
    setGame(null);
    setOver(null);
    setRematch([]);
    setOpponentLeft(null);
  };

  const go = (next: Screen) => {
    setNotice(null);
    setScreen(next);
  };
  const goHome = () => {
    resetGame();
    go({ name: 'home' });
  };

  // 연결이 끊기면 서버가 방과 요청을 정리해요. 재접속 유예(ux-spec 5단계)가 생기기 전까지는 홈으로 돌아가요.
  useEffect(() => {
    if (status !== 'connected' && IN_ROOM.includes(screen.name)) {
      resetGame();
      setScreen({ name: 'home' });
      setNotice(NOTICES.disconnected);
    }
  }, [status, screen.name]);

  // 요청 결과는 대기 화면이 뜨기 직전에 올 수도 있어서 여기서 받아요.
  useSocketEvent('join:resolved', ({ resolution }) => {
    if (screen.name !== 'guest-waiting') return;
    const { room } = screen.ticket;
    if (resolution === 'accepted') {
      setIsHost(false);
      go({ name: 'versus', black: room.hostNickname, white: nickname.trim() });
    }
    else go({ name: 'join-failed', room, resolution });
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
    setRematch([]);
  });

  useSocketEvent('game:over', (payload) => {
    setOver(payload);
    // VS 화면 중에 끝나도(상대가 바로 나감) 결과를 볼 수 있게 대국 화면으로 넘어가요.
    if (screen.name === 'versus') setScreen({ name: 'game' });
  });

  const onRoomCreated = (room: RoomSummary) => go({ name: 'host-waiting', room });

  switch (screen.name) {
    case 'host-waiting':
      return (
        <HostWaitingScreen
          status={status}
          room={screen.room}
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
      // 판 상태는 수락 직후에 오므로 VS 화면이 끝날 때쯤엔 있어요. 혹시 없으면 VS 화면처럼 기다려요.
      return game ? (
        <GameScreen
          status={status}
          game={game}
          over={over}
          isHost={isHost}
          rematch={rematch}
          opponentLeft={opponentLeft}
          onLeft={goHome}
          onReopened={(room) => {
            resetGame();
            go({ name: 'host-waiting', room });
          }}
        />
      ) : (
        <p className="t-body muted" role="status" style={{ padding: 24 }}>
          판을 준비하고 있어요
        </p>
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
