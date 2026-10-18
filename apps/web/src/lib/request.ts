import type { Ack, ClientToServerEvents } from '@gomoku/shared';
import { socket } from './socket';
import type { RequestErrorCode } from './errors';

const TIMEOUT_MS = 8000;

export type RequestResult<T> = { ok: true; data: T } | { ok: false; error: RequestErrorCode };

type AckData<E extends keyof ClientToServerEvents> =
  Parameters<ClientToServerEvents[E]> extends [...unknown[], (result: Ack<infer T>) => void] ? T : never;

type PayloadArgs<E extends keyof ClientToServerEvents> =
  Parameters<ClientToServerEvents[E]> extends [...infer P, unknown] ? P : never;

/**
 * 요청/응답 이벤트를 보내고 서버의 acknowledgement를 기다려요.
 * 연결이 없거나 8초 안에 답이 없으면 실패로 돌려줘요. 예외를 던지지 않아요.
 */
export async function request<E extends keyof ClientToServerEvents>(
  event: E,
  ...payload: PayloadArgs<E>
): Promise<RequestResult<AckData<E>>> {
  if (!socket.connected) return { ok: false, error: 'offline' };

  // 이벤트별 타입은 위의 시그니처가 지키고, 여기서는 Socket.IO의 제네릭 추론만 우회해요.
  const timed = socket.timeout(TIMEOUT_MS) as unknown as {
    emitWithAck(ev: string, ...args: unknown[]): Promise<Ack<AckData<E>>>;
  };
  try {
    return await timed.emitWithAck(event, ...payload);
  } catch {
    return { ok: false, error: 'timeout' };
  }
}
