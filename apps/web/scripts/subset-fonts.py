"""
Galmuri 폰트를 웹용으로 잘라요.

  - core: ASCII와 화면 문구(apps/web/src)에 쓰인 글자. 모든 화면이 처음에 받아요.
  - ext-N: 나머지 한글 음절과 자모. 닉네임 같은 사용자 입력에만 필요해서 unicode-range로 나눠 두면
    브라우저가 실제로 쓰인 글자가 든 조각만 받아요.
  - 한자와 일본 가나는 넣지 않아요(화면은 한국어 전용). 닉네임에 있으면 시스템 글꼴로 보여요.

원본은 apps/web/fonts-src/galmuri/에 두고, 결과는 src/assets/fonts/galmuri/와 src/styles/fonts.css에 써요.
화면 문구를 바꿔서 새 글자가 생기면 다시 돌려요(테스트가 알려줘요).

  python -m venv .venv && .venv/Scripts/pip install fonttools==4.55.3 brotli==1.1.0
  .venv/Scripts/python apps/web/scripts/subset-fonts.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

WEB = Path(__file__).resolve().parent.parent
SRC_FONTS = WEB / "fonts-src" / "galmuri"
OUT_FONTS = WEB / "src" / "assets" / "fonts" / "galmuri"
OUT_CSS = WEB / "src" / "styles" / "fonts.css"
CORE_CHARS = OUT_FONTS / "core-chars.txt"

# (파일 이름, font-family, font-weight)
FACES = [
    ("Galmuri11", "Galmuri11", 400),
    ("Galmuri11-Bold", "Galmuri11", 700),
    ("Galmuri14", "Galmuri14", 400),
    ("Galmuri9", "Galmuri9", 400),
]

EXT_CHUNKS = 8
HANGUL = range(0xAC00, 0xD7A4)
JAMO = list(range(0x1100, 0x1200)) + list(range(0x3130, 0x3190))


def ui_characters() -> set[int]:
    """화면에 나오는 글자: 테스트 파일을 뺀 소스의 모든 문자 + ASCII 출력 문자."""
    chars = set(range(0x20, 0x7F))
    for path in (WEB / "src").rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".css"} or ".test." in path.name or path.parent.name == "test":
            continue
        for ch in path.read_text(encoding="utf-8"):
            if ord(ch) >= 0x80 and not ch.isspace():
                chars.add(ord(ch))
    return chars


def to_ranges(codepoints: list[int]) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for cp in sorted(codepoints):
        if ranges and cp == ranges[-1][1] + 1:
            ranges[-1] = (ranges[-1][0], cp)
        else:
            ranges.append((cp, cp))
    return ranges


def unicode_range(codepoints: list[int]) -> str:
    return ", ".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in to_ranges(codepoints))


def write_subset(source: Path, target: Path, codepoints: list[int]) -> None:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.glyph_names = False
    font = TTFont(source)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(target)


def main() -> int:
    ui = ui_characters()
    css = [
        "/*",
        " * 이 파일은 scripts/subset-fonts.py가 만들어요. 직접 고치지 마세요.",
        " * Galmuri (https://github.com/quiple/galmuri, npm `galmuri` 2.40.3), SIL Open Font License 1.1.",
        " * 라이선스 전문: ../assets/fonts/galmuri/OFL.txt",
        " *",
        " * core: ASCII + 화면 문구 글자 / ext-N: 나머지 한글(닉네임용), 쓰인 조각만 받아요.",
        " */",
    ]

    for old in OUT_FONTS.glob("*.woff2"):
        old.unlink()

    total_before = total_core = total_ext = 0
    for name, family, weight in FACES:
        source = SRC_FONTS / f"{name}.woff2"
        total_before += source.stat().st_size
        available = set(TTFont(source).getBestCmap())

        core = sorted(c for c in ui if c in available)
        rest = [c for c in list(HANGUL) + JAMO if c in available and c not in ui]
        size = -(-len(rest) // EXT_CHUNKS)
        chunks = [rest[i : i + size] for i in range(0, len(rest), size)]

        files = [(f"{name}.core.woff2", core)] + [(f"{name}.ext-{i + 1}.woff2", chunk) for i, chunk in enumerate(chunks)]
        for filename, codepoints in files:
            write_subset(source, OUT_FONTS / filename, codepoints)
            bytes_ = (OUT_FONTS / filename).stat().st_size
            if ".core." in filename:
                total_core += bytes_
            else:
                total_ext += bytes_
            css += [
                "",
                "@font-face {",
                f"  font-family: '{family}';",
                f"  src: url('../assets/fonts/galmuri/{filename}') format('woff2');",
                f"  font-weight: {weight};",
                "  font-display: swap;",
                f"  unicode-range: {unicode_range(codepoints)};",
                "}",
            ]

    OUT_CSS.write_text("\n".join(css) + "\n", encoding="utf-8")
    CORE_CHARS.write_text("".join(chr(c) for c in sorted(ui) if c >= 0x80) + "\n", encoding="utf-8")

    kb = lambda n: f"{n / 1024:.0f}KB"  # noqa: E731
    print(f"원본 합계 {kb(total_before)} → core 합계 {kb(total_core)} (항상 받음) + ext 합계 {kb(total_ext)} (필요한 조각만)")
    print(f"화면 문구 글자 {len([c for c in ui if c >= 0x80])}자")
    return 0


if __name__ == "__main__":
    sys.exit(main())
