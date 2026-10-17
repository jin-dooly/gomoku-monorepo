import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (
  url: string = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'
) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Socket 연결
    setSocket(io(url, {
      transports: ['websocket'],
    }));
  }, [url]);

  useEffect(() => {
    if (!socket) return;

    // 연결 이벤트
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // 정리 함수
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return socket;
};
