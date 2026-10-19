import { useEffect, useRef } from 'react';
import type { ServerToClientEvents } from '@gomoku/shared';
import { socket } from '../lib/socket';

/**
 * 서버가 보내는 이벤트를 구독해요. 핸들러가 바뀌어도 다시 구독하지 않고 최신 핸들러를 불러요.
 */
export const useSocketEvent = <E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) => {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    const listener = ((...args: Parameters<ServerToClientEvents[E]>) =>
      (latest.current as (...a: Parameters<ServerToClientEvents[E]>) => void)(...args)) as ServerToClientEvents[E];
    // Socket.IO의 이벤트 이름 제네릭은 유니온 키를 좁히지 못해서 여기서만 단언해요.
    const s = socket as unknown as {
      on(ev: string, fn: unknown): void;
      off(ev: string, fn: unknown): void;
    };
    s.on(event, listener);
    return () => s.off(event, listener);
  }, [event]);
};
