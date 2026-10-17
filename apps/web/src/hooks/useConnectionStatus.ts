import { useSyncExternalStore } from 'react';
import { socket } from '../lib/socket';

export type ConnectionStatus = 'connecting' | 'connected';

const subscribe = (onChange: () => void) => {
  socket.on('connect', onChange);
  socket.on('disconnect', onChange);
  return () => {
    socket.off('connect', onChange);
    socket.off('disconnect', onChange);
  };
};

const getSnapshot = (): ConnectionStatus => (socket.connected ? 'connected' : 'connecting');

/**
 * 서버 연결 상태예요. 끊기면 Socket.IO가 알아서 다시 연결하므로
 * 화면에는 "연결됨" / "연결 중" 두 가지만 보여줘요 (ux-spec 01 헤더).
 */
export const useConnectionStatus = (): ConnectionStatus =>
  useSyncExternalStore(subscribe, getSnapshot);
