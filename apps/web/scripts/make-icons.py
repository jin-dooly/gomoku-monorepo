"""
파비콘과 공유 미리보기 그림을 도트 그대로 만들어요. 외부 라이브러리 없이 표준 라이브러리만 써요.

  python apps/web/scripts/make-icons.py

결과: public/favicon.svg, public/apple-touch-icon.png(180×180), public/og-image.png(1200×630)
돌 모양은 src/components/Pixel.tsx의 10×10 도트 돌과 같아요.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "public"

INK = (0x16, 0x14, 0x2E)
DEEP = (0x0C, 0x0B, 0x1C)
BLACK_HI = (0x6A, 0x64, 0xA0)
WHITE = (0xFF, 0xFF, 0xFF)
WHITE_SHADE = (0xCF, 0xC6, 0xB2)
WOOD = (0xC9, 0x87, 0x3F)
WOOD_LINE = (0x5A, 0x38, 0x15)
WOOD_FRAME = (0x7A, 0x4E, 0x22)
LAMP = (0x3F, 0xD6, 0xC6)

# 10×10 돌 (행마다 칠할 x 범위)
STONE_ROWS = [(3, 7), (1, 9), (1, 9), (0, 10), (0, 10), (0, 10), (0, 10), (1, 9), (1, 9), (3, 7)]


def stone_pixels(kind: str) -> dict[tuple[int, int], tuple[int, int, int]]:
    pixels = {}
    for y, (x0, x1) in enumerate(STONE_ROWS):
        for x in range(x0, x1):
            if kind == "black":
                pixels[(x, y)] = DEEP
            else:
                pixels[(x, y)] = WHITE_SHADE if y >= 7 else WHITE
    if kind == "black":
        pixels[(2, 2)] = pixels[(3, 2)] = pixels[(2, 3)] = BLACK_HI
    return pixels


class Canvas:
    def __init__(self, width: int, height: int, fill: tuple[int, int, int]):
        self.w, self.h = width, height
        self.px = [[fill] * width for _ in range(height)]

    def rect(self, x: int, y: int, w: int, h: int, color: tuple[int, int, int]) -> None:
        for yy in range(max(0, y), min(self.h, y + h)):
            row = self.px[yy]
            for xx in range(max(0, x), min(self.w, x + w)):
                row[xx] = color

    def sprite(self, pixels: dict, x: int, y: int, scale: int) -> None:
        for (sx, sy), color in pixels.items():
            self.rect(x + sx * scale, y + sy * scale, scale, scale, color)

    def png(self) -> bytes:
        raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in self.px)

        def chunk(tag: bytes, data: bytes) -> bytes:
            return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        header = struct.pack(">IIBBBBB", self.w, self.h, 8, 2, 0, 0, 0)
        return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def favicon_svg() -> str:
    """16×16 격자: 남색 바탕에 흑돌(왼쪽 위)과 백돌(오른쪽 아래)이 겹쳐요."""
    rects = ['<rect width="16" height="16" fill="#16142e"/>']
    for kind, ox, oy in (("white", 6, 6), ("black", 0, 0)):
        for (x, y), color in stone_pixels(kind).items():
            rects.append(f'<rect x="{x + ox}" y="{y + oy}" width="1" height="1" fill="#{color[0]:02x}{color[1]:02x}{color[2]:02x}"/>')
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">'
        + "".join(rects)
        + "</svg>\n"
    )


def touch_icon() -> bytes:
    c = Canvas(180, 180, INK)
    scale = 11  # 16칸 × 11 = 176
    c.sprite(stone_pixels("white"), 2 + 6 * scale, 2 + 6 * scale, scale)
    c.sprite(stone_pixels("black"), 2, 2, scale)
    return c.png()


def og_image() -> bytes:
    """1200×630: 오른쪽에 도트 오목판(가로 5목, 청록 링), 왼쪽에 큰 흑돌·백돌."""
    c = Canvas(1200, 630, INK)
    cell, n = 34, 15
    size = cell * n
    bx, by = 1200 - size - 60, (630 - size) // 2
    c.rect(bx - 10, by - 10, size + 20, size + 20, DEEP)
    c.rect(bx - 6, by - 6, size + 12, size + 12, WOOD_FRAME)
    c.rect(bx, by, size, size, WOOD)
    for i in range(n):
        c.rect(bx + cell // 2 - 1, by + cell // 2 + i * cell - 1, size - cell + 2, 3, WOOD_LINE)
        c.rect(bx + cell // 2 + i * cell - 1, by + cell // 2 - 1, 3, size - cell + 2, WOOD_LINE)
    stone_scale = 3  # 10 × 3 = 30px
    black = stone_pixels("black")
    white = stone_pixels("white")
    place = lambda pixels, r, k: c.sprite(pixels, bx + k * cell + 2, by + r * cell + 2, stone_scale)  # noqa: E731
    for k in range(3, 8):  # 이긴 줄: 링 먼저
        c.rect(bx + k * cell, by + 8 * cell, cell, cell, LAMP)
        c.rect(bx + k * cell + 3, by + 8 * cell + 3, cell - 6, cell - 6, WOOD)
        place(black, 8, k)
    for r, k in ((7, 4), (7, 5), (9, 3), (9, 5), (10, 6), (8, 2)):
        place(white, r, k)
    for r, k in ((7, 7), (6, 6)):
        place(black, r, k)
    c.sprite(stone_pixels("white"), 150 + 9 * 16, 170 + 9 * 16, 16)
    c.sprite(stone_pixels("black"), 150, 170, 16)
    return c.png()


def main() -> None:
    PUBLIC.mkdir(exist_ok=True)
    (PUBLIC / "favicon.svg").write_text(favicon_svg(), encoding="utf-8")
    (PUBLIC / "apple-touch-icon.png").write_bytes(touch_icon())
    (PUBLIC / "og-image.png").write_bytes(og_image())
    print("favicon.svg, apple-touch-icon.png, og-image.png")


if __name__ == "__main__":
    main()
