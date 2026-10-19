import type { ClientErrorPayload } from '@gomoku/shared';
import { socket } from './socket';

/**
 * 브라우저 오류를 서버 로그로 보내요 (외부 서비스 없이, ux-spec 결정 기록 2026-10-19).
 * - 연결이 없으면 몇 개만 모아 뒀다가 연결되면 보내요.
 * - 같은 오류는 한 번만, 한 페이지에서 최대 20번까지만 보내요.
 */
const MAX_REPORTS = 20;
const MAX_QUEUE = 5;

const sent = new Set<string>();
const queue: ClientErrorPayload[] = [];
let count = 0;

const flush = () => {
  while (queue.length && socket.connected) socket.emit('client:error', queue.shift()!);
};
socket.on('connect', flush);

const describe = (error: unknown): { message: string; stack?: string } => {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack };
  return { message: typeof error === 'string' ? error : JSON.stringify(error) ?? String(error) };
};

export const reportError = (kind: ClientErrorPayload['kind'], error: unknown, where?: string): void => {
  const { message, stack } = describe(error);
  const key = `${kind}:${message}`;
  if (sent.has(key) || count >= MAX_REPORTS) return;
  sent.add(key);
  count += 1;

  const payload: ClientErrorPayload = {
    kind,
    message: message.slice(0, 500),
    stack: stack?.slice(0, 4000),
    where: where?.slice(0, 200),
    userAgent: navigator.userAgent.slice(0, 300),
  };
  if (socket.connected) socket.emit('client:error', payload);
  else if (queue.length < MAX_QUEUE) queue.push(payload);
};

/** 앱 시작할 때 한 번 불러요. */
export const installErrorReporting = (): void => {
  window.addEventListener('error', (e) => reportError('error', e.error ?? e.message, location.pathname));
  window.addEventListener('unhandledrejection', (e) => reportError('unhandledrejection', e.reason, location.pathname));
};
