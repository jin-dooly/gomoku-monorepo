/** 남은 시간이 15초보다 적으면 주황으로 바꿔요 (ux-spec 5장). */
export const LOW_MS = 15_000;

/** 남은 시간 막대. 숫자는 옆에 따로 보여주므로 스크린 리더에는 숨겨요. */
export const Meter = ({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) => {
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));
  return (
    <div className={remainingMs < LOW_MS ? 'meter meter--low' : 'meter'} aria-hidden="true">
      <i className="meter__fill" style={{ width: `${ratio * 100}%` }} />
    </div>
  );
};
