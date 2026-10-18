import { useEffect, useState } from 'react';
import { PixelStone } from '../components/Pixel';
import { request } from '../lib/request';
import './VersusScreen.css';

/** VS 화면을 보여주는 시간 (ux-spec 4장 VS 화면, 약 2초) */
export const VERSUS_MS = 2000;

type Props = {
  black: string;
  white: string;
  onLeft: () => void;
};

/**
 * 수락 직후 VS 화면. 위는 백(2P), 아래는 흑(1P, 먼저 둬요).
 * 대국 화면(3단계)이 생기기 전까지는 2초 뒤에 안내와 [방 나가기]를 보여줘요.
 */
export const VersusScreen = ({ black, white, onLeft }: Props) => {
  const [elapsed, setElapsed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setElapsed(true), VERSUS_MS);
    return () => clearTimeout(id);
  }, []);

  const handleLeave = async () => {
    setLeaving(true);
    await request('room:leave');
    onLeft();
  };

  return (
    <main className="versus" aria-label={`대국 시작: ${black} 대 ${white}`}>
      <section className="versus__side versus__side--white">
        <div className="versus__badge">
          <PixelStone stone="white" size={100} />
          <span className="tag versus__tag versus__tag--white">2P</span>
        </div>
        <p className="t-hero">{white}</p>
        <p className="t-label versus__role">백 · 두 번째로 둬요</p>
      </section>

      <div className="versus__vs" aria-hidden="true">
        VS
      </div>

      <section className="versus__side versus__side--black">
        <p className="t-hero">{black}</p>
        <p className="t-label accent">흑 · 먼저 둬요</p>
        <div className="versus__badge">
          <PixelStone stone="black" size={100} onDark />
          <span className="tag tag--lamp versus__tag">1P</span>
        </div>
        <div className="versus__foot" role="status">
          {elapsed ? (
            <>
              <p className="t-body muted">대국 화면은 다음 단계에서 만들어요</p>
              <button className="btn btn--ghost" type="button" onClick={() => void handleLeave()} disabled={leaving}>
                방 나가기
              </button>
            </>
          ) : (
            <p className="t-body muted">곧 시작해요</p>
          )}
        </div>
      </section>
    </main>
  );
};
