import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@gomoku/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

/**
 * 앱 전체에서 연결 하나만 써요. 모듈을 불러올 때 한 번 만들어서
 * StrictMode에서 컴포넌트가 두 번 마운트돼도 연결이 늘어나지 않아요.
 */
export const socket: GameSocket = io(SOCKET_URL, {
  transports: ['websocket'],
});
