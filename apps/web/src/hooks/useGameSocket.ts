import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, Player, GameMove } from '@gomoku/shared';
import { socket as appSocket } from '../lib/socket';
import { useConnectionStatus } from './useConnectionStatus';

// 초기 버전 이벤트(join-game, make-move 등)용 훅이에요. 새 이벤트는 shared의
// ClientToServerEvents에만 정의돼 있어서 여기서는 타입 없는 소켓으로 다뤄요.
// 1단계에서 방 구조로 바꾸면 이 파일을 지워요.
const socket = appSocket as unknown as Socket;

interface UseGameSocketReturn {
  gameState: GameState | null;
  player: Player | null;
  isConnected: boolean;
  joinGame: (playerName: string) => void;
  makeMove: (row: number, col: number) => void;
  resetGame: () => void;
  error: string | null;
}

export const useGameSocket = (): UseGameSocketReturn => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const isConnected = useConnectionStatus() === 'connected';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      socket.off('player-joined');
      socket.off('game-state');
      socket.off('game-over');
      socket.off('move-error');
    };
  }, []);

  const joinGame = useCallback(
    (playerName: string) => {
      if (!isConnected) {
        setError('Socket not connected');
        return;
      }
      socket.emit('join-game', { playerName });
    },
    [isConnected]
  );

  const makeMove = useCallback(
    (row: number, col: number) => {
      if (!isConnected || !player || !gameState) {
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
    [isConnected, player, gameState]
  );

  const resetGame = useCallback(() => {
    if (!isConnected) {
      setError('Socket not connected');
      return;
    }
    socket.emit('reset-game');
    setError(null);
  }, [isConnected]);

  return {
    gameState,
    player,
    isConnected,
    joinGame,
    makeMove,
    resetGame,
    error,
  };
};
