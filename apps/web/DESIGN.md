# DESIGN.md

오목 웹 앱의 비주얼 시스템이에요. 방향은 픽셀아트 **"2P 오락실 대전"**이고, 기준은 [디자인 목업](https://claude.ai/artifact/BTsJtEEcTz7gAi2ADuFwDD)과 [`docs/ux-spec.md`](../../docs/ux-spec.md) 5장이에요. 이 문서는 실제 코드(`src/styles`)에서 정리했어요.

## 한 줄 요약

오목 한 판은 1P 대 2P 대전이에요. 흑 진영(어두운 패널)과 백 진영(밝은 패널)이 판을 사이에 두고 마주 보고, 지금 둘 사람 쪽에 청록 램프가 켜져요.

## 색 (`src/styles/tokens.css`)

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--color-ink` | `#16142E` | 바탕 |
| `--color-deep` | `#0C0B1C` | 흑 진영, 입력칸, 마키 아래 그림자 |
| `--color-panel` / `--color-panel-dim` | `#24204A` / `#1C1940` | 마키, 목록 행, 시트 / 누를 수 없는 행 |
| `--color-raise` | `#3A3566` | 보조 버튼, 꺼진 램프, 빈 슬롯 점선 |
| `--color-paper` | `#F2EEE3` | 백 진영, 어두운 바탕 위 글자 |
| `--color-muted` / `--color-paper-muted` | `#ABA5CB` / `#57516F` | 보조 글자 (어두운 바탕 / 종이 위) |
| `--color-coin` | `#FFC93C` | **누를 수 있는 것에만.** 주 버튼 |
| `--color-lamp` | `#3FD6C6` | 차례, 연결됨, 승리 링, 미리보기, 강조 숫자 |
| `--color-ember` | `#FF6B3D` | 마지막 수, 남은 시간 15초 미만 |
| `--color-stamp` | `#F0555A` | 도장, 에러 문구, 되돌릴 수 없는 버튼 |
| `--color-wood` / `-line` / `-frame` | `#C9873F` / `#5A3815` / `#7A4E22` | 오목판 |

규칙
- 노랑과 청록의 역할을 섞지 않아요. 노랑 = 누를 수 있음, 청록 = 지금 켜져 있음.
- 면은 선이 아니라 색 단계로 나눠요. 1px 테두리, 왼쪽 색 띠, 그라데이션을 쓰지 않아요.
- 그림자는 떠 있는 것(대화상자, 드롭다운)에만 써요.

## 글꼴 (`src/styles/fonts.css`)

[Galmuri](https://github.com/quiple/galmuri) 하나만 써요(SIL OFL, `src/assets/fonts/galmuri/OFL.txt`). 픽셀이 깨지지 않게 원래 크기의 정수배로만 써요.

| 클래스 | 글꼴 · 크기 | 쓰는 곳 |
|---|---|---|
| `.t-hero` | Galmuri11 Bold 44px | 카운트다운, 결과 제목 |
| `.t-title` | Galmuri11 Bold 22px | 제목, 이름, 버튼 |
| `.t-label` | Galmuri11 22px | 이유 문장 |
| `.t-big` | Galmuri14 28px | 화면 안내 문장 |
| `.t-body` | Galmuri14 14px | 본문, 보조 문구 |
| `.btn--row`, `.chip` | Galmuri9 18px | 목록 행의 작은 버튼, "대국 중" |

- 숫자(시간, 수 수, 개수)는 `.num`(`tabular-nums`)을 붙여요.
- 폰트 파일은 합쳐서 약 1.6MB예요. 배포 전에 쓰는 글자만 남기는 서브셋을 고려해요.

## 부품 (`src/styles/components.css`)

- **마키** `.marquee`: 상단 56px, 위에 붙어 있어요. 오른쪽 끝에 항상 연결 램프(`ConnectionLamp`)가 있어요.
- **버튼** `.btn` + `--coin` / `--ghost` / `--danger`: 높이 52px, 각진 모서리, 아래 6px 베벨. 누르면 4px 내려앉아요. `.btn--row`는 겉보기 40px, 누르는 영역 44px이에요.
- **아이콘 버튼** `.iconbtn`: 44×44px, 도트 아이콘(`PixelIcon`)과 `aria-label`을 같이 써요.
- **입력** `.input`: 깊은 바탕에 4px 안쪽 테두리. 포커스는 청록, 잘못된 값은 빨강.
- **진영 패널** `.side--dark` / `.side--paper` / `.side--empty`: 흑 / 백 / 빈 자리.
- **램프** `.lampdot`, 깜빡임 `.blink`, 로딩 `.chase`(점 세 개가 차례로 켜짐).
- **배너** `.banner`: 청록 바탕. 서버를 깨우는 중일 때만 써요.
- **도트 그림** `PixelStone`, `PixelIcon` (`src/components/Pixel.tsx`): 10×10 돌과 8×8 아이콘. 이모지나 유니코드 기호를 아이콘으로 쓰지 않아요.

## 움직임

- 깜빡임은 `steps()`로 끊어요(램프처럼 켜졌다 꺼짐). 부드러운 페이드를 쓰지 않아요.
- `prefers-reduced-motion`이면 깜빡임과 내려앉는 움직임을 멈추고, 로딩 점은 모두 켜진 상태로 보여요.

## 반응형

- 모바일이 기준(390px)이고, 좌우 여백은 16px이에요.
- 1024px 이상에서는 홈이 두 칸(왼쪽 420px 방 만들기, 오른쪽 방 목록)이 돼요.
- 대국 화면 PC 배치(왼쪽 큰 판, 오른쪽 진영 패널)는 3단계에서 만들어요.
