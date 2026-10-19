import { z } from 'zod';
import { BOARD_SIZE } from '../game/rules';

/** 닉네임 2–10자, 앞뒤 공백 제거, 중복 허용 (docs/ux-spec.md 3장) */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 10;

export const NicknameSchema = z.string().trim().min(NICKNAME_MIN).max(NICKNAME_MAX);

export const PositionSchema = z.object({
  row: z.number().int().min(0).max(BOARD_SIZE - 1),
  col: z.number().int().min(0).max(BOARD_SIZE - 1),
});

const IdSchema = z.string().min(1).max(64);

// 클라이언트 → 서버 payload. 서버는 받은 값을 항상 이 스키마로 검사해요.

export const RoomCreatePayloadSchema = z.object({ nickname: NicknameSchema });

export const JoinRequestPayloadSchema = z.object({
  roomId: IdSchema,
  nickname: NicknameSchema,
});

export const JoinDecisionPayloadSchema = z.object({ requestId: IdSchema });

export const GameMovePayloadSchema = PositionSchema;

export type RoomCreatePayload = z.infer<typeof RoomCreatePayloadSchema>;
export type JoinRequestPayload = z.infer<typeof JoinRequestPayloadSchema>;
export type JoinDecisionPayload = z.infer<typeof JoinDecisionPayloadSchema>;
export type GameMovePayload = z.infer<typeof GameMovePayloadSchema>;
