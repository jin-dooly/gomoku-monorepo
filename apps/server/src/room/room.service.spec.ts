import { RoomService } from './room.service';

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(() => {
    service = new RoomService();
    jest.useFakeTimers({ now: new Date('2026-10-18T05:32:07Z') });
  });

  afterEach(() => jest.useRealTimers());

  it('방을 만들면 대기 중인 방이 목록에 보여요', () => {
    const result = service.create('host-1', '지니');

    expect(result).toEqual({
      ok: true,
      data: {
        id: expect.any(String),
        hostNickname: '지니',
        createdAt: new Date('2026-10-18T05:32:07Z').getTime(),
        status: 'waiting',
      },
    });
    expect(service.list()).toHaveLength(1);
  });

  it('한 사람은 방을 하나만 만들 수 있어요', () => {
    service.create('host-1', '지니');
    expect(service.create('host-1', '지니')).toEqual({ ok: false, error: 'already-in-room' });
  });

  it('닉네임이 같아도 다른 방으로 만들어져요', () => {
    service.create('host-1', '도윤');
    service.create('host-2', '도윤');

    const [a, b] = service.list();
    expect(a.hostNickname).toBe('도윤');
    expect(b.hostNickname).toBe('도윤');
    expect(a.id).not.toBe(b.id);
  });

  it('새로 만든 방이 목록 위에 와요', () => {
    service.create('host-1', '먼저');
    jest.advanceTimersByTime(1000);
    service.create('host-2', '나중');

    expect(service.list().map((r) => r.hostNickname)).toEqual(['나중', '먼저']);
  });

  it('방장이 방을 닫으면 목록에서 사라지고 다시 방을 만들 수 있어요', () => {
    service.create('host-1', '지니');

    expect(service.close('host-1')).toEqual({ ok: true, data: undefined });
    expect(service.list()).toEqual([]);
    expect(service.create('host-1', '지니').ok).toBe(true);
  });

  it('방에 없는 사람은 방을 닫을 수 없어요', () => {
    expect(service.close('nobody')).toEqual({ ok: false, error: 'not-in-room' });
  });

  it('방장이 나가면 방이 사라져요', () => {
    service.create('host-1', '지니');

    expect(service.leave('host-1').ok).toBe(true);
    expect(service.list()).toEqual([]);
  });

  it('방장의 연결이 끊기면 방이 사라져요', () => {
    service.create('host-1', '지니');
    service.create('host-2', '도윤');

    service.disconnect('host-1');

    expect(service.list().map((r) => r.hostNickname)).toEqual(['도윤']);
    expect(service.findBySocket('host-1')).toBeUndefined();
  });

  it('방에 없는 소켓의 연결이 끊겨도 아무 일도 없어요', () => {
    service.create('host-1', '지니');
    service.disconnect('stranger');
    expect(service.list()).toHaveLength(1);
  });
});
