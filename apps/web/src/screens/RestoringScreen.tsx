import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { Logo, Marquee } from '../components/Marquee';
import { PixelIcon } from '../components/Pixel';

/** 새로고침 직후 이전 화면을 불러오는 동안 보여줘요. 서버가 잠들어 있으면 깨우는 중 배너도 함께요. */
export const RestoringScreen = ({ status }: { status: ConnectionStatus }) => (
  <div className="screen">
    <Marquee status={status}>
      <Logo />
    </Marquee>

    {status === 'waking' && (
      <div className="banner" role="status">
        <PixelIcon name="hourglass" size={28} />
        <div>
          <p className="t-title">서버를 깨우는 중이에요</p>
          <p className="t-body">처음 접속하면 최대 1분 걸릴 수 있어요</p>
        </div>
      </div>
    )}

    <main
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}
    >
      <div className="chase" aria-hidden="true">
        <span className="lampdot" />
        <span className="lampdot" />
        <span className="lampdot" />
      </div>
      <p className="t-body muted" role="status">
        이전 화면을 불러오고 있어요
      </p>
    </main>
  </div>
);
