import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/report';
import { Logo, Marquee } from './Marquee';

type State = { failed: boolean };

/**
 * 화면을 그리다 오류가 나면 흰 화면 대신 안내를 보여주고, 오류는 서버 로그로 보내요.
 * 새로고침하면 세션이 이어져서 하던 대국으로 돌아갈 수 있어요(5단계 재접속).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError('render', error, info.componentStack?.split('\n').find((l) => l.trim())?.trim());
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen">
        <Marquee status="reconnecting">
          <Logo />
        </Marquee>
        <main
          role="alert"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, padding: '0 var(--gutter)', maxWidth: 560, margin: '0 auto', width: '100%' }}
        >
          <h1 className="t-big">문제가 생겼어요</h1>
          <p className="t-body muted">화면을 다시 불러오면 하던 대국으로 돌아갈 수 있어요. 30초 안에 다시 불러와 주세요.</p>
          <button className="btn btn--coin btn--wide" type="button" onClick={() => location.reload()}>
            다시 불러오기
          </button>
        </main>
      </div>
    );
  }
}
