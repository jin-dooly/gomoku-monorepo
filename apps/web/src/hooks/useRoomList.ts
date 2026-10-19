import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomSummary } from '@gomoku/shared';
import { request } from '../lib/request';
import type { RequestErrorCode } from '../lib/errors';

export type RoomListState =
  | { status: 'idle' }
  | { status: 'loading'; rooms: RoomSummary[] | null }
  | { status: 'ready'; rooms: RoomSummary[] }
  | { status: 'error'; rooms: RoomSummary[] | null; error: RequestErrorCode };

/**
 * 방 목록은 실시간으로 갱신하지 않아요 (ux-spec 결정 기록 2026-10-18).
 * 홈에 들어올 때(연결되는 순간 포함)와 새로고침 버튼을 누를 때만 불러와요.
 */
export const useRoomList = (connected: boolean) => {
  const [state, setState] = useState<RoomListState>({ status: 'idle' });
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++latest.current;
    setState((prev) => ({ status: 'loading', rooms: 'rooms' in prev ? prev.rooms : null }));

    const result = await request('room:list');
    if (id !== latest.current) return; // 더 늦게 보낸 요청의 결과만 반영해요

    setState((prev) =>
      result.ok
        ? { status: 'ready', rooms: result.data }
        : { status: 'error', rooms: 'rooms' in prev ? prev.rooms : null, error: result.error },
    );
  }, []);

  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

  return { state, refresh };
};
