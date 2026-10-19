import { describe, expect, it } from 'vitest';
import { ClientErrorPayloadSchema, GameMovePayloadSchema, JoinRequestPayloadSchema, NicknameSchema } from './schemas';

describe('NicknameSchema', () => {
  it('2–10자를 받아요', () => {
    expect(NicknameSchema.safeParse('지니').success).toBe(true);
    expect(NicknameSchema.safeParse('가나다라마바사아자차').success).toBe(true);
  });

  it('1자나 11자는 거절해요', () => {
    expect(NicknameSchema.safeParse('지').success).toBe(false);
    expect(NicknameSchema.safeParse('가나다라마바사아자차카').success).toBe(false);
  });

  it('보이지 않는 문자(제어·서식·줄 구분)가 섞이면 거절해요', () => {
    expect(NicknameSchema.safeParse('지\u200b니').success).toBe(false); // 폭 없는 공백
    expect(NicknameSchema.safeParse('지\u202e니').success).toBe(false); // 방향 바꾸기
    expect(NicknameSchema.safeParse('지\u0007니').success).toBe(false); // 제어 문자
    expect(NicknameSchema.safeParse('지\u2028니').success).toBe(false); // 줄 구분자
  });

  it('보이는 글자는 한글이 아니어도 받아요', () => {
    expect(NicknameSchema.safeParse('Jinny 7').success).toBe(true);
    expect(NicknameSchema.safeParse('별★빛').success).toBe(true);
  });

  it('앞뒤 공백을 지운 다음 길이를 봐요', () => {
    expect(NicknameSchema.parse('  도윤  ')).toBe('도윤');
    expect(NicknameSchema.safeParse(' 도 ').success).toBe(false);
  });
});

describe('JoinRequestPayloadSchema', () => {
  it('방 ID가 비어 있으면 거절해요', () => {
    expect(JoinRequestPayloadSchema.safeParse({ roomId: '', nickname: '도윤' }).success).toBe(false);
  });
});

describe('GameMovePayloadSchema', () => {
  it('판 안의 정수 좌표만 받아요', () => {
    expect(GameMovePayloadSchema.safeParse({ row: 0, col: 14 }).success).toBe(true);
    expect(GameMovePayloadSchema.safeParse({ row: 15, col: 0 }).success).toBe(false);
    expect(GameMovePayloadSchema.safeParse({ row: 1.5, col: 0 }).success).toBe(false);
    expect(GameMovePayloadSchema.safeParse({ row: '1', col: 0 }).success).toBe(false);
  });
});

describe('ClientErrorPayloadSchema', () => {
  it('정해진 종류와 길이 안에서만 받아요', () => {
    expect(ClientErrorPayloadSchema.safeParse({ kind: 'error', message: 'boom' }).success).toBe(true);
    expect(ClientErrorPayloadSchema.safeParse({ kind: 'other', message: 'boom' }).success).toBe(false);
    expect(ClientErrorPayloadSchema.safeParse({ kind: 'error', message: 'x'.repeat(501) }).success).toBe(false);
  });
});
