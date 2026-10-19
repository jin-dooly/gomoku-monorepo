const pad = (n: number) => String(n).padStart(2, '0');

/** 방 생성일시를 초 단위로 보여줘요. 예: `2026.10.18 14:32:07 생성` (ux-spec 3장) */
export const formatCreatedAt = (epochMs: number): string => {
  const d = new Date(epochMs);
  const date = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date} ${time} 생성`;
};
