import { useEffect, useState } from 'react';

/**
 * 마감 시각까지 남은 시간(ms)을 0까지 줄여 가며 돌려줘요.
 * 서버는 기기 시계 차이를 피하려고 남은 시간(remainingMs)만 보내므로,
 * 받은 순간의 기기 시각에 더해서 마감 시각을 만들어 넘겨요(`deadlineFrom`).
 */
export const useCountdown = (deadline: number, tickMs = 250): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [deadline, tickMs]);

  return Math.max(0, deadline - now);
};

export const deadlineFrom = (remainingMs: number): number => Date.now() + remainingMs;

/** 남은 시간을 `0:48`처럼 보여줘요. 초는 올림해서 0초가 되는 순간에만 0이 돼요. */
export const formatClock = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const secondsLeft = (ms: number): number => Math.ceil(ms / 1000);
