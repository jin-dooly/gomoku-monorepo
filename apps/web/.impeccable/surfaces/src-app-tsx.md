---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: 오목 앱 화면 (01–10)

Mode: Operate. 두 사람이 방을 만들고, 입장을 수락하고, 한 판 두고, 재대결하는 작업 화면. 모바일과 PC가 같은 비중.

## Direction contract

THESIS: 오목 한 판을 1P 대 2P 오락실 대전으로 다뤄요. 흑 진영과 백 진영이 판을 사이에 두고 마주 보고, 차례는 진영에 들어오는 램프 하나로 읽혀요. 버리는 것: 회색 카드 두 장과 가운데 판을 놓는 보드게임 앱 기본 배치.

OWN-WORLD: 캐비닛 남색 바탕(#16142E), 흑 진영은 더 깊은 남색, 백 진영은 종이색(#F2EEE3), 동전 노랑(#FFC93C)은 누를 수 있는 것에만, 차례 램프 청록(#3FD6C6), 도트 나무판(#C9873F), 마지막 수 주황(#FF6B3D), 도장 빨강(#E5484D). 글꼴은 Galmuri 하나(11 Bold 22/44px, 14 Regular 14/28px). 모서리는 각지고, 버튼은 4px 아래 그림자 베벨, 눌리면 내려앉아요. 돌은 16×16 도트 스프라이트.

STORY: 들어오자마자 닉네임 넣고 방을 만들거나 고른다. 도전자가 오면 방장은 바로 알고 수락한다. 대국 중에는 누구 차례인지, 내 색이 무엇인지 램프 하나로 안다. 끝나면 재대결 한 번으로 색을 바꿔 다시 붙는다.

FIRST VIEWPORT: 04 대국 모바일. 위 56px 마키(OMOK 2P, 연결 램프, 수 수, ⋮), 상대 진영 패널, 342px 도트 판, 내 진영 패널(램프 켜짐), 하단 노란 [G7에 두기]와 [취소]. PC는 왼쪽 큰 판, 오른쪽 진영 패널 세로 스택.

FORM: 내 근거 목록 3번(90년대 오락실 대전 캐비닛), seed:888bc5ba1f335d5e. 시그니처: 입장 요청이 '새로운 도전자 등장!' 배너로 들어오고, 수락하면 VS 화면. 키운 규칙: 상태는 도장으로 남음(항공권 지갑), 노랑은 누를 수 있는 것에만(소비자 앱).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
