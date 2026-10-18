import type { ErrorCode } from '@gomoku/shared';

/** 클라이언트에서만 생기는 실패예요. */
export type ClientErrorCode = 'timeout' | 'offline';

export type RequestErrorCode = ErrorCode | ClientErrorCode;

/**
 * 서버는 에러 코드만 보내고, 화면 문구는 여기서 정해요 (ux-spec 5장: 영어 에러를 그대로 보여주지 않아요).
 * 문구는 관련된 위치 가까이에 보여줘요.
 */
const MESSAGES: Record<RequestErrorCode, string> = {
  'invalid-payload': '닉네임은 2–10자로 입력해 주세요.',
  'already-in-room': '이미 다른 방에 들어가 있어요.',
  'not-in-room': '방에 들어가 있지 않아요.',
  'room-not-found': '방이 사라졌어요. 목록을 새로고침해 주세요.',
  'room-not-waiting': '이미 대국이 시작된 방이에요.',
  'request-not-found': '입장 요청이 이미 끝났어요.',
  'not-host': '방장만 할 수 있어요.',
  'not-your-turn': '지금은 상대 차례예요.',
  'game-not-playing': '대국 중이 아니에요.',
  occupied: '이미 돌이 있는 자리예요.',
  timeout: '서버가 답하지 않아요. 잠시 후 다시 해 주세요.',
  offline: '서버에 연결되지 않았어요. 연결되면 다시 해 주세요.',
};

export const errorMessage = (code: RequestErrorCode): string => MESSAGES[code];
