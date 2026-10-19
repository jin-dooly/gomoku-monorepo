/**
 * 한 줄짜리 JSON 로그. Render 로그 화면에서 이벤트 이름으로 검색하기 쉽게 모양을 맞춰요.
 * 외부 오류 추적 서비스는 쓰지 않아요 (ux-spec 결정 기록 2026-10-19).
 */
type Fields = Record<string, unknown>;

const line = (level: 'info' | 'error', event: string, fields: Fields) =>
  JSON.stringify({ t: new Date().toISOString(), level, event, ...fields });

export const logInfo = (event: string, fields: Fields = {}) => console.log(line('info', event, fields));

export const logError = (event: string, fields: Fields = {}) => console.error(line('error', event, fields));

/** 세션 ID 전체를 남기지 않고 앞부분만 남겨요. 같은 사람의 로그를 묶어 보는 데는 충분해요. */
export const shortId = (id: string | undefined) => (id ? id.slice(0, 8) : undefined);
