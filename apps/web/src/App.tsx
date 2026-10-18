import { useEffect, useState } from 'react';
import type { JoinRequestTicket, RoomSummary } from '@gomoku/shared';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useSocketEvent } from './hooks/useSocketEvent';
import { HomeScreen } from './screens/HomeScreen';
import { HostWaitingScreen } from './screens/HostWaitingScreen';
import { GuestWaitingScreen } from './screens/GuestWaitingScreen';
import { JoinFailedScreen, type FailedResolution } from './screens/JoinFailedScreen';
import { VersusScreen } from './screens/VersusScreen';

type Screen =
  | { name: 'home' }
  | { name: 'host-waiting'; room: RoomSummary }
  | { name: 'guest-waiting'; ticket: JoinRequestTicket }
  | { name: 'join-failed'; room: RoomSummary; resolution: FailedResolution }
  | { name: 'versus'; black: string; white: string };

const NOTICES = {
  disconnected: '서버와 연결이 끊겨서 방에서 나왔어요. 다시 연결되면 새로 시작해 주세요.',
  opponentLeft: '상대가 방을 나가서 대국이 끝났어요.',
  opponentDisconnected: '상대의 연결이 끊겨서 대국이 끝났어요.',
} as const;

function App() {
  const status = useConnectionStatus();
  const [nickname, setNickname] = useState('');
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [notice, setNotice] = useState<string | null>(null);

  const go = (next: Screen) => {
    setNotice(null);
    setScreen(next);
  };
  const goHome = () => go({ name: 'home' });

  // 연결이 끊기면 서버가 방과 요청을 정리해요. 재접속 유예(ux-spec 5단계)가 생기기 전까지는 홈으로 돌아가요.
  useEffect(() => {
    if (status !== 'connected' && screen.name !== 'home' && screen.name !== 'join-failed') {
      setScreen({ name: 'home' });
      setNotice(NOTICES.disconnected);
    }
  }, [status, screen.name]);

  // 요청 결과는 대기 화면이 뜨기 직전에 올 수도 있어서 여기서 받아요.
  useSocketEvent('join:resolved', ({ resolution }) => {
    if (screen.name !== 'guest-waiting') return;
    const { room } = screen.ticket;
    if (resolution === 'accepted') go({ name: 'versus', black: room.hostNickname, white: nickname.trim() });
    else go({ name: 'join-failed', room, resolution });
  });

  // 3단계 전까지 game:over는 상대가 나가거나 연결이 끊긴 경우에만 와요.
  useSocketEvent('game:over', ({ reason }) => {
    if (screen.name !== 'versus') return;
    setScreen({ name: 'home' });
    setNotice(reason === 'disconnect' ? NOTICES.opponentDisconnected : NOTICES.opponentLeft);
  });

  const onRoomCreated = (room: RoomSummary) => go({ name: 'host-waiting', room });

  switch (screen.name) {
    case 'host-waiting':
      return (
        <HostWaitingScreen
          status={status}
          room={screen.room}
          onClosed={goHome}
          onMatched={(guest) => go({ name: 'versus', black: screen.room.hostNickname, white: guest })}
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
      return <VersusScreen black={screen.black} white={screen.white} onLeft={goHome} />;
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
