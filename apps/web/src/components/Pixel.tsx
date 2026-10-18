/**
 * 도트 그림 모음. 이모지나 유니코드 기호 대신 이걸 써요 (ux-spec 4장: 돌을 이모지로 그리지 않아요).
 * 모두 장식용이라 스크린 리더에는 숨겨요. 뜻은 옆의 글자나 버튼의 aria-label이 전해요.
 */
import type { Stone } from '@gomoku/shared';

type SpriteProps = { size?: number; className?: string };

/** 10×10 도트 돌. 흑은 어두운 바탕 위에서도 보이게 한 단계 밝혀요. */
export const PixelStone = ({ stone, size = 20, onDark = false, className }: SpriteProps & { stone: Stone; onDark?: boolean }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 10 10"
    shapeRendering="crispEdges"
    aria-hidden="true"
    focusable="false"
  >
    {stone === 'black' ? (
      <>
        <g fill={onDark ? '#2c2852' : '#0c0b1c'}>
          <StoneShape />
        </g>
        <rect x="2" y="2" width="2" height="1" fill="#6a64a0" />
        <rect x="2" y="3" width="1" height="1" fill="#6a64a0" />
      </>
    ) : (
      <>
        <g fill="#ffffff">
          <rect x="3" y="0" width="4" height="1" />
          <rect x="1" y="1" width="8" height="2" />
          <rect x="0" y="3" width="10" height="4" />
        </g>
        <g fill="#cfc6b2">
          <rect x="1" y="7" width="8" height="2" />
          <rect x="3" y="9" width="4" height="1" />
        </g>
      </>
    )}
  </svg>
);

const StoneShape = () => (
  <>
    <rect x="3" y="0" width="4" height="1" />
    <rect x="1" y="1" width="8" height="2" />
    <rect x="0" y="3" width="10" height="4" />
    <rect x="1" y="7" width="8" height="2" />
    <rect x="3" y="9" width="4" height="1" />
  </>
);

const ICONS = {
  refresh: (
    <>
      <rect x="2" y="1" width="3" height="1" />
      <rect x="1" y="2" width="1" height="4" />
      <rect x="2" y="6" width="4" height="1" />
      <rect x="6" y="4" width="1" height="2" />
      <rect x="5" y="0" width="1" height="3" />
      <rect x="6" y="1" width="1" height="1" />
    </>
  ),
  back: (
    <>
      <rect x="1" y="3" width="6" height="2" />
      <rect x="2" y="2" width="1" height="4" />
      <rect x="3" y="1" width="1" height="1" />
      <rect x="3" y="6" width="1" height="1" />
    </>
  ),
  hourglass: (
    <>
      <rect x="0" y="0" width="7" height="1" />
      <rect x="0" y="6" width="7" height="1" />
      <rect x="1" y="1" width="1" height="1" />
      <rect x="5" y="1" width="1" height="1" />
      <rect x="2" y="2" width="3" height="1" />
      <rect x="3" y="3" width="1" height="1" />
      <rect x="2" y="4" width="1" height="1" />
      <rect x="4" y="4" width="1" height="1" />
      <rect x="1" y="5" width="5" height="1" />
    </>
  ),
} as const;

const VIEWBOX: Record<keyof typeof ICONS, string> = {
  refresh: '0 0 8 8',
  back: '0 0 8 8',
  hourglass: '0 0 7 7',
};

/** 단색 도트 아이콘. 색은 글자색(currentColor)을 따라가요. */
export const PixelIcon = ({ name, size = 24, className }: SpriteProps & { name: keyof typeof ICONS }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox={VIEWBOX[name]}
    shapeRendering="crispEdges"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    {ICONS[name]}
  </svg>
);
