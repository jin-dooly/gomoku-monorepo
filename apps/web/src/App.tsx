import { useEffect, useState } from 'react';
import type { RoomSummary } from '@gomoku/shared';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { HomeScreen } from './screens/HomeScreen';
import { HostWaitingScreen } from './screens/HostWaitingScreen';

type Screen = { name: 'home' } | { name: 'host-waiting'; room: RoomSummary };

function App() {
  const status = useConnectionStatus();
  const [nickname, setNickname] = useState('');
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [notice, setNotice] = useState<string | null>(null);

  // 연결이 끊기면 서버가 방을 정리해요. 재접속 유예(ux-spec 5단계)가 생기기 전까지는 홈으로 돌아가요.
  useEffect(() => {
    if (status !== 'connected' && screen.name !== 'home') {
      setScreen({ name: 'home' });
      setNotice('서버와 연결이 끊겨서 방이 닫혔어요. 다시 연결되면 새로 만들어 주세요.');
    }
  }, [status, screen.name]);

  const goHome = () => setScreen({ name: 'home' });

  if (screen.name === 'host-waiting') {
    return <HostWaitingScreen status={status} room={screen.room} onClosed={goHome} />;
  }

  return (
    <HomeScreen
      status={status}
      nickname={nickname}
      onNicknameChange={setNickname}
      onRoomCreated={(room) => {
        setNotice(null);
        setScreen({ name: 'host-waiting', room });
      }}
      notice={notice}
    />
  );
}

export default App;
