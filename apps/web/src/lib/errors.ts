import type { ErrorCode } from '@gomoku/shared';

/** 클라이언트에서만 생기는 실패예요. */
export type ClientErrorCode = 'timeout' | 'offline';

export type RequestErrorCode = ErrorCode | ClientErrorCode;

/**
 * 서버는 에러 코드만 보내고, 화면 문구는 여기서 정해요 (ux-spec 5장: 영어 에러를 그대로 보여주지 않아요).
 * 문구는 관련된 위치 가까이에 보여줘요.
 */
const MESSAGES: Record<RequestErrorCode, string> = {
  'invalid-payload': '닉네임은 보이는 글자 2–10자로 입력해 주세요.',
  'already-in-room': '이미 다른 방에 들어가 있어요.',
  'not-in-room': '방에 들어가 있지 않아요.',
  'room-not-found': '방이 사라졌어요. 목록을 새로고침해 주세요.',
  'room-not-waiting': '이미 대국이 시작된 방이에요.',
  'request-not-found': '입장 요청이 이미 끝났어요.',
  'not-host': '방장만 할 수 있어요.',
  'not-your-turn': '지금은 상대 차례예요.',
  'game-not-playing': '대국 중이 아니에요.',
  occupied: '이미 돌이 있는 자리예요.',
  'game-in-progress': '대국이 끝난 뒤에 할 수 있어요.',
  'no-opponent': '상대가 방을 나가서 재대결할 수 없어요.',
  'opponent-present': '상대가 아직 방에 있어요.',
  'rate-limited': '요청이 너무 잦아요. 잠깐 뒤에 다시 해 주세요.',
  'too-many-rooms': '지금은 열린 방이 너무 많아요. 잠시 후 다시 만들어 주세요.',
  'too-many-requests': '이 방에 입장 요청이 많이 밀려 있어요. 잠시 후 다시 요청해 주세요.',
  timeout: '서버가 답하지 않아요. 잠시 후 다시 해 주세요.',
  offline: '서버에 연결되지 않았어요. 연결되면 다시 해 주세요.',
};

export const errorMessage = (code: RequestErrorCode): string => MESSAGES[code];
