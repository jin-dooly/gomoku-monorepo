import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, SessionAuth } from '@gomoku/shared';
import { getSessionId, saveSessionId } from './session';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

/**
 * 앱 전체에서 연결 하나만 써요. 모듈을 불러올 때 한 번 만들어서
 * StrictMode에서 컴포넌트가 두 번 마운트돼도 연결이 늘어나지 않아요.
 *
 * 연결할 때마다(재연결 포함) 저장해 둔 세션 ID를 보내고, 서버가 알려준 ID를 저장해요.
 */
export const socket: GameSocket = io(SOCKET_URL, {
  transports: ['websocket'],
  auth: (cb) => cb({ sessionId: getSessionId() } satisfies SessionAuth),
});

socket.on('session:assigned', ({ sessionId }) => saveSessionId(sessionId));
