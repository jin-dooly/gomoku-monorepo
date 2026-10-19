import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('창 안에서 한도까지만 받고, 시간이 지나면 다시 받아요', () => {
    let now = 0;
    const limiter = new RateLimiter(3, 1000, () => now);

    expect([limiter.take('a'), limiter.take('a'), limiter.take('a'), limiter.take('a')]).toEqual([true, true, true, false]);
    expect(limiter.take('b')).toBe(true);

    now = 999;
    expect(limiter.take('a')).toBe(false);
    now = 1000;
    expect(limiter.take('a')).toBe(true);
  });

  it('잊으면 처음부터 세요', () => {
    const limiter = new RateLimiter(1, 1000, () => 0);
    limiter.take('a');
    limiter.forget('a');
    expect(limiter.take('a')).toBe(true);
  });
});
