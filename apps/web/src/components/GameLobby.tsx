import { useState } from 'react';

interface GameLobbyProps {
  onJoin: (playerName: string) => void;
  isConnected: boolean;
}

export const GameLobby = ({ onJoin, isConnected }: GameLobbyProps) => {
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      onJoin(playerName.trim());
    }
  };

  return (
    <div className="game-lobby">
      <h2>오목 게임에 참가하기</h2>
      <p>연결 상태: {isConnected ? '✅ 연결됨' : '❌ 연결 안 됨'}</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="플레이어 이름을 입력하세요"
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected || !playerName.trim()}>
          게임 참가
        </button>
      </form>
    </div>
  );
};
