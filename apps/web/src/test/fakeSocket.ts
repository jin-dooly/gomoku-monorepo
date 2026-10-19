import type { ServerToClientEvents } from '@gomoku/shared';

type Listener = (...args: unknown[]) => void;

/**
 * 테스트용 가짜 소켓. `vi.mock('../lib/socket', ...)`으로 끼워 넣고,
 * `serverSends`로 서버가 이벤트를 보낸 것처럼 흉내 내요.
 */
export const createFakeSocket = () => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    connected: true,
    on(event: string, fn: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    off(event: string, fn: Listener) {
      listeners.get(event)?.delete(fn);
    },
    serverSends<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
  };
};
