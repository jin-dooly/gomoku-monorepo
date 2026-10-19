import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSessionId, saveSessionId } from './session';

afterEach(() => {
  window.sessionStorage.clear();
  delete window.__GOMOKU_SESSION_ID__;
  delete window.ReactNativeWebView;
});

describe('세션 ID', () => {
  it('처음에는 없고, 저장하면 이 탭의 sessionStorage에서 읽어요', () => {
    expect(getSessionId()).toBeUndefined();

    saveSessionId('11111111-1111-4111-8111-111111111111');

    expect(window.sessionStorage.getItem('gomoku.sessionId')).toBe('11111111-1111-4111-8111-111111111111');
    expect(getSessionId()).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('React Native 웹뷰가 미리 넣어 준 값을 먼저 써요', () => {
    window.sessionStorage.setItem('gomoku.sessionId', 'from-storage');
    window.__GOMOKU_SESSION_ID__ = 'from-app';

    expect(getSessionId()).toBe('from-app');
  });

  it('새 ID를 받으면 웹뷰 앱에 알려서 앱이 저장할 수 있게 해요', () => {
    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };

    saveSessionId('22222222-2222-4222-8222-222222222222');
    saveSessionId('22222222-2222-4222-8222-222222222222');

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
      type: 'gomoku:session',
      sessionId: '22222222-2222-4222-8222-222222222222',
    });
  });
});
