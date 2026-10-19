import type { ReactNode } from 'react';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { PixelStone } from './Pixel';

/** 상단 바. 왼쪽에 화면마다 다른 내용, 오른쪽에 연결 램프가 항상 보여요 (ux-spec 5장: 실시간 상태를 숨기지 않아요). */
export const Marquee = ({
  status,
  children,
  trailing,
}: {
  status: ConnectionStatus;
  children: ReactNode;
  trailing?: ReactNode;
}) => (
  <header className="marquee">
    {children}
    {trailing}
    <ConnectionLamp status={status} />
  </header>
);

export const Logo = () => (
  <div className="logo t-title marquee__grow">
    <PixelStone stone="black" />
    <PixelStone stone="white" />
    <span>오목</span>
  </div>
);

const LABELS: Record<ConnectionStatus, string> = {
  connected: '연결됨',
  waking: '연결 중',
  reconnecting: '다시 연결 중',
};

export const ConnectionLamp = ({ status }: { status: ConnectionStatus }) => {
  const on = status === 'connected';
  return (
    <div className="conn" role="status" aria-live="polite">
      <span className={on ? 'lampdot' : 'lampdot lampdot--off blink'} aria-hidden="true" />
      {LABELS[status]}
    </div>
  );
};
