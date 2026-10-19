import { describe, expect, it } from 'vitest';
import { formatClock, secondsLeft } from './useCountdown';

describe('formatClock', () => {
  it('남은 시간을 분:초로 보여주고, 초는 올림해요', () => {
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(48_000)).toBe('0:48');
    expect(formatClock(47_001)).toBe('0:48');
    expect(formatClock(900)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
  });
});

describe('secondsLeft', () => {
  it('0초는 정말 끝났을 때만 나와요', () => {
    expect(secondsLeft(1)).toBe(1);
    expect(secondsLeft(0)).toBe(0);
  });
});
