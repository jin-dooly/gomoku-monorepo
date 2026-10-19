import type { ReactNode } from 'react';
import type { Stone } from '@gomoku/shared';
import { PixelStone } from './Pixel';

type Props = {
  stone: Stone;
  nickname: string;
  /** 이름 아래 상태 문구. 예: "흑 · 내 차례" */
  state: ReactNode;
  /** 지금 둘 차례면 청록 램프 테두리를 켜요. */
  lit: boolean;
  /** 1P(흑) / 2P(백) 대신 도장 같은 것을 오른쪽에 둘 때 */
  trailing?: ReactNode;
  className?: string;
};

/**
 * 진영 패널. 흑은 어두운 패널, 백은 밝은 종이 패널이라 카드 색만 봐도 돌 색을 알 수 있고,
 * 차례는 램프 테두리 하나로 알려줘요 (ux-spec 5장: 차례와 색은 카드 강조 하나로).
 */
export const PlayerSide = ({ stone, nickname, state, lit, trailing, className }: Props) => {
  const classes = ['side', stone === 'black' ? 'side--dark' : 'side--paper', lit && 'side--lit', className]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes} aria-label={`${stone === 'black' ? '흑' : '백'} ${nickname}`} aria-current={lit || undefined}>
      <PixelStone stone={stone} size={28} onDark={stone === 'black'} />
      <div className="side__who">
        <span className="t-title side__name">{nickname}</span>
        <span className="t-body side__state">{state}</span>
      </div>
      {trailing ?? <span className="tag side__tag">{stone === 'black' ? '1P' : '2P'}</span>}
    </section>
  );
};
