import { useSocket } from './hooks/useSocket';
import { useGameSocket } from './hooks/useGameSocket';
import { GameLobby } from './components/GameLobby';
import { GameBoard } from './components/GameBoard';

function App() {
  const socket = useSocket();

  const {
    gameState,
    player,
    isConnected,
    joinGame,
    makeMove,
    resetGame,
    error,
  } = useGameSocket(socket);

  return (
    <div className="app">
      <h1>오목 게임</h1>
      
      {error && <div className="error">오류: {error}</div>}

      {!player ? (
        <GameLobby onJoin={joinGame} isConnected={isConnected} />
      ) : gameState ? (
        <div className="game-container">
          <GameBoard
            gameState={gameState}
            player={player}
            onCellClick={makeMove}
          />
          <button onClick={resetGame} className="reset-button">
            게임 리셋
          </button>
        </div>
      ) : (
        <div>게임 상태를 기다리는 중...</div>
      )}
    </div>
  );
}

export default App;
