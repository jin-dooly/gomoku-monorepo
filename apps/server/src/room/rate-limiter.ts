/**
 * 세션마다 최근 window 동안 보낸 요청 수를 세요(슬라이딩 윈도). 한도를 넘으면 false.
 * 사람이 정상적으로 두는 속도(몇 초에 한두 번)보다 훨씬 넉넉하게 잡아서, 스크립트로 퍼붓는 것만 막아요.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  take(key: string): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  forget(key: string): void {
    this.hits.delete(key);
  }
}
