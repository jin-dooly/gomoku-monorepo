import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 화면 문구에 쓰인 글자가 모두 기본 폰트 조각(core)에 들어 있는지 확인해요.
 * 실패하면 새 글자가 생긴 거라 `scripts/subset-fonts.py`를 다시 돌려요.
 * (조각에 없으면 그 글자만 닉네임용 조각을 따로 받아서 화면이 잠깐 깜빡일 수 있어요.)
 */
const SRC = resolve(__dirname, '..');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'test' ? [] : sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) && !name.includes('.test.') ? [path] : [];
  });

describe('폰트 서브셋', () => {
  it('화면 문구의 글자가 모두 core 조각에 있어요', () => {
    const core = new Set(readFileSync(join(SRC, 'assets/fonts/galmuri/core-chars.txt'), 'utf-8'));
    const missing = new Set<string>();
    for (const file of sourceFiles(SRC)) {
      for (const ch of readFileSync(file, 'utf-8')) {
        if (ch.codePointAt(0)! >= 0x80 && !/\s/.test(ch) && !core.has(ch)) missing.add(ch);
      }
    }
    expect([...missing].join(''), 'scripts/subset-fonts.py를 다시 돌려 주세요').toBe('');
  });
});
