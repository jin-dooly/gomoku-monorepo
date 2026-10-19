import { useEffect, useRef } from 'react';
import { PixelStone } from '../components/Pixel';
import './VersusScreen.css';

/** VS 화면을 보여주는 시간 (ux-spec 4장 VS 화면, 약 2초) */
export const VERSUS_MS = 2000;

type Props = {
  black: string;
  white: string;
  onDone: () => void;
};

/** 수락 직후 VS 화면. 위는 백(2P), 아래는 흑(1P, 먼저 둬요). 2초 뒤 대국 화면으로 넘어가요. */
export const VersusScreen = ({ black, white, onDone }: Props) => {
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const id = setTimeout(() => done.current(), VERSUS_MS);
    return () => clearTimeout(id);
  }, []);

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
        <p className="t-body muted versus__foot" role="status">
          곧 시작해요
        </p>
      </section>
    </main>
  );
};
