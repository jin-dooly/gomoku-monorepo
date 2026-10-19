import { useSyncExternalStore } from 'react';
import { socket } from '../lib/socket';

/**
 * - `waking`: 아직 한 번도 연결되지 않았어요. Render 무료 플랜이 잠에서 깨는 중일 수 있어요.
 * - `connected`: 연결됨
 * - `reconnecting`: 연결됐다가 끊겼고, Socket.IO가 다시 연결하는 중이에요.
 */
export type ConnectionStatus = 'waking' | 'connected' | 'reconnecting';

let everConnected = socket.connected;
socket.on('connect', () => {
  everConnected = true;
});

const subscribe = (onChange: () => void) => {
  socket.on('connect', onChange);
  socket.on('disconnect', onChange);
  return () => {
    socket.off('connect', onChange);
    socket.off('disconnect', onChange);
  };
};

const getSnapshot = (): ConnectionStatus => {
  if (socket.connected) return 'connected';
  return everConnected ? 'reconnecting' : 'waking';
};

export const useConnectionStatus = (): ConnectionStatus =>
  useSyncExternalStore(subscribe, getSnapshot);
