import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { PixelStone } from './Pixel';
import './RulesDialog.css';

type Props = {
  onClose: () => void;
  /** 대국 중에 열었을 때 맨 위에 보여줄 실시간 상태 (예: 내 차례예요) */
  liveStatus?: ReactNode;
};

/**
 * 11 규칙 보기 (ux-spec 4장). 처음 해 보는 사람이 30초 안에 훑어보는 요약이에요.
 * 모바일은 아래에서 올라오는 시트, 1024px 이상은 가운데 대화상자예요.
 */
export const RulesDialog = ({ onClose, liveStatus }: Props) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    closeRef.current?.focus();
    return () => (opener.current as HTMLElement | null)?.focus?.();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
    // 대화상자 안에서만 Tab이 돌게 해요 (스크롤되는 본문 ↔ 닫기).
    if (e.key === 'Tab') {
      e.preventDefault();
      const stops: HTMLElement[] = [bodyRef.current, closeRef.current].filter((el) => el !== null);
      const index = stops.indexOf(document.activeElement as HTMLElement);
      const next = (index + (e.shiftKey ? -1 : 1) + stops.length) % stops.length;
      stops[next]?.focus();
    }
  };

  return (
    <div className="rules__scrim" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className="rules"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rules__grip" aria-hidden="true" />
        <div className="rules__head">
          <h2 id={titleId} className="t-title">
            규칙
          </h2>
          {liveStatus && (
            <p className="rules__live t-body" role="status">
              {liveStatus}
            </p>
          )}
        </div>

        {/* 모바일에서는 스크롤되므로 키보드로도 내릴 수 있게 포커스를 받아요 */}
        <div className="rules__body" ref={bodyRef} tabIndex={0} aria-label="규칙 내용">
          <section className="rules__item rules__item--wide">
            <div className="rules__text">
              <h3 className="t-title">이기는 법</h3>
              <p className="t-body">가로·세로·대각선으로 5개 이상 이으면 이겨요. 6목 이상도 승리이고, 쌍삼 같은 금지 수는 없어요.</p>
            </div>
            <div className="rules__examples">
              <MiniBoard
                label="가로 5목 예시"
                caption="가로 5목 · 승리"
                line={['3,1', '3,2', '3,3', '3,4', '3,5']}
                white={['2,2', '2,4', '4,3', '3,0']}
              />
              <MiniBoard
                label="대각선 6목 예시"
                caption="대각선 6목 · 이것도 승리"
                line={['0,0', '1,1', '2,2', '3,3', '4,4', '5,5']}
                white={['0,1', '2,3', '4,2', '6,6', '1,4']}
              />
            </div>
          </section>
          <Rule title="순서">흑(방장)이 먼저 두고 번갈아 한 수씩 둬요. 재대결하면 흑과 백이 바뀌어요.</Rule>
          <Rule title="두는 법">교차점을 누르면 미리보기가 놓이고, [G7에 두기]를 눌러야 확정돼요. 무르기는 없어요.</Rule>
          <Rule title="무승부">판이 가득 찰 때까지 5목이 없으면 비겨요.</Rule>
          <Rule title="기권과 나가기">
            기권은 이번 판만 지는 거라 재대결할 수 있어요. 대국 중에 나가면 기권으로 처리돼요.
          </Rule>
          <Rule title="연결이 끊기면" wide>
            30초 동안 기다려요. 그 안에 돌아오면 이어서 두고, 아니면 남은 사람이 이겨요.
          </Rule>
        </div>

        <div className="rules__foot">
          <p className="t-body muted rules__notice">
            폰트: Galmuri (
            <a href="/licenses/galmuri-OFL.txt" target="_blank" rel="noreferrer">
              SIL OFL
            </a>
            ) · 닉네임은 저장하지 않아요
          </p>
          <button ref={closeRef} className="btn btn--ghost rules__close" type="button" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

const Rule = ({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) => (
  <section className={wide ? 'rules__item rules__item--wide' : 'rules__item'}>
    <h3 className="t-title">{title}</h3>
    <p className="t-body">{children}</p>
  </section>
);

/** 7×7 예시판. 이긴 줄(흑)에는 실제 판과 같은 청록 링을 둘러요. */
const MiniBoard = ({ label, caption, line, white }: { label: string; caption: string; line: string[]; white: string[] }) => (
  <figure className="mini">
    <div className="mini__board" role="img" aria-label={label}>
      {Array.from({ length: 49 }, (_, i) => {
        const key = `${Math.floor(i / 7)},${i % 7}`;
        const isBlack = line.includes(key);
        const isWhite = white.includes(key);
        return (
          <span key={key} className="mini__cell">
            {(isBlack || isWhite) && (
              <span className={isBlack ? 'mini__stone mini__stone--win' : 'mini__stone'}>
                <PixelStone stone={isBlack ? 'black' : 'white'} size={100} className="mini__sprite" />
              </span>
            )}
          </span>
        );
      })}
    </div>
    <figcaption className="t-body muted">{caption}</figcaption>
  </figure>
);
