import { describe, expect, it } from 'vitest';
import { formatCreatedAt } from './format';

describe('formatCreatedAt', () => {
  it('생성일시를 초 단위까지, 한 자리 숫자는 0을 붙여 보여줘요', () => {
    const epoch = new Date(2026, 0, 5, 9, 3, 7).getTime(); // 기기 시간대 기준
    expect(formatCreatedAt(epoch)).toBe('2026.01.05 09:03:07 생성');
  });
});
