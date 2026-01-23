import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, Player, GameMove } from '@gomoku/shared';

interface UseGameSocketReturn {
  socket: Socket | null;
  gameState: GameState | null;
  player: Player | null;
  isConnected: boolean;
  joinGame: (playerName: string) => void;
  makeMove: (row: number, col: number) => void;
  resetGame: () => void;
  error: string | null;
}

export const useGameSocket = (socket: Socket | null): UseGameSocketReturn => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    // 연결 상태 관리
    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // 게임 이벤트 리스너
    socket.on('player-joined', (playerData: Player) => {
      setPlayer(playerData);
      setError(null);
    });

    socket.on('game-state', (state: GameState) => {
      setGameState(state);
    });

    socket.on('game-over', (data: { winner: 1 | 2 }) => {
      console.log('Game over! Winner:', data.winner);
    });

    socket.on('move-error', (data: { message: string }) => {
      setError(data.message);
    });

    // 정리
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('player-joined');
      socket.off('game-state');
      socket.off('game-over');
      socket.off('move-error');
    };
  }, [socket]);

  const joinGame = useCallback(
    (playerName: string) => {
      if (!socket || !isConnected) {
        setError('Socket not connected');
        return;
      }
      socket.emit('join-game', { playerName });
    },
    [socket, isConnected]
  );

  const makeMove = useCallback(
    (row: number, col: number) => {
      if (!socket || !isConnected || !player || !gameState) {
        setError('Cannot make move: missing game state or player');
        return;
      }

      if (gameState.currentPlayer !== player.playerNumber) {
        setError('Not your turn');
        return;
      }

      if (gameState.isGameOver) {
        setError('Game is over');
        return;
      }

      const move: GameMove = {
        row,
        col,
        player: player.playerNumber,
        timestamp: Date.now(),
      };

      socket.emit('make-move', move);
      setError(null);
    },
    [socket, isConnected, player, gameState]
  );

  const resetGame = useCallback(() => {
    if (!socket || !isConnected) {
      setError('Socket not connected');
      return;
    }
    socket.emit('reset-game');
    setError(null);
  }, [socket, isConnected]);

  return {
    socket,
    gameState,
    player,
    isConnected,
    joinGame,
    makeMove,
    resetGame,
    error,
  };
};
