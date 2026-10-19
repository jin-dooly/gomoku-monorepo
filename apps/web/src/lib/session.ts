/**
 * 세션 ID 보관 (docs/ux-spec.md 3장 "같은 사람 알아보기").
 *
 * - 웹: 탭마다 따로인 sessionStorage에 둬요. 새로고침하면 같은 사람, 다른 탭은 다른 사람이에요.
 * - React Native 웹뷰: 앱이 웹뷰를 열기 전에 `window.__GOMOKU_SESSION_ID__`를 넣어 주면 그 값을 먼저 써요
 *   (injectedJavaScriptBeforeContentLoaded). 서버가 새 ID를 주면 `ReactNativeWebView.postMessage`로 알려서
 *   앱이 AsyncStorage 등에 저장할 수 있어요. 그러면 앱을 다시 열어도 같은 사람으로 이어져요.
 *
 * 세션 ID를 읽고 쓰는 곳은 이 파일 하나예요.
 */

const STORAGE_KEY = 'gomoku.sessionId';

declare global {
  interface Window {
    __GOMOKU_SESSION_ID__?: string;
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

export const getSessionId = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  if (window.__GOMOKU_SESSION_ID__) return window.__GOMOKU_SESSION_ID__;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    // 시크릿 모드나 저장소가 막힌 환경: 이 탭이 살아 있는 동안은 window 값으로 버텨요.
    return undefined;
  }
};

export const saveSessionId = (sessionId: string): void => {
  if (typeof window === 'undefined') return;
  const changed = getSessionId() !== sessionId;
  window.__GOMOKU_SESSION_ID__ = sessionId;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, sessionId);
  } catch {
    // 저장소를 못 써도 window 값이 있어서 같은 탭의 재연결은 이어져요.
  }
  if (changed) window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'gomoku:session', sessionId }));
};
