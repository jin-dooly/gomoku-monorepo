// 배포 환경에서는 호스팅 서비스(Render 등)의 환경변수로 값을 덮어씀
export const PORT = Number(process.env.PORT) || 3001;
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
