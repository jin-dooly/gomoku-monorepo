import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  socket: null as unknown as ReturnType<typeof import('../test/fakeSocket').createFakeSocket> & { emit: ReturnType<typeof vi.fn> },
}));
vi.mock('./socket', async () => {
  const { createFakeSocket } = await import('../test/fakeSocket');
  fake.socket = Object.assign(createFakeSocket(), { emit: vi.fn() });
  return { socket: fake.socket };
});

describe('reportError', () => {
  beforeEach(() => vi.resetModules());

  /** 모듈을 새로 불러오면 가짜 소켓도 새로 만들어져서, 연결 상태는 불러온 뒤에 정해요. */
  const load = async (connected: boolean) => {
    const mod = await import('./report');
    fake.socket.connected = connected;
    fake.socket.emit.mockClear();
    return mod;
  };

  it('연결돼 있으면 바로 서버로 보내고, 같은 오류는 한 번만 보내요', async () => {
    const { reportError } = await load(true);

    reportError('error', new Error('boom'), '/');
    reportError('error', new Error('boom'), '/');

    expect(fake.socket.emit).toHaveBeenCalledTimes(1);
    expect(fake.socket.emit).toHaveBeenCalledWith(
      'client:error',
      expect.objectContaining({ kind: 'error', message: 'boom', where: '/' }),
    );
  });

  it('연결이 없으면 모아 뒀다가 연결되면 보내요', async () => {
    const { reportError } = await load(false);

    reportError('unhandledrejection', 'network down');
    expect(fake.socket.emit).not.toHaveBeenCalled();

    fake.socket.connected = true;
    (fake.socket.serverSends as unknown as (event: string) => void)('connect');
    expect(fake.socket.emit).toHaveBeenCalledWith('client:error', expect.objectContaining({ message: 'network down' }));
  });

  it('한 페이지에서 20번까지만 보내요', async () => {
    const { reportError } = await load(true);

    for (let i = 0; i < 30; i++) reportError('error', new Error(`e${i}`));

    expect(fake.socket.emit).toHaveBeenCalledTimes(20);
  });
});
