import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CLIENT_URL, PORT } from './config';
import { logError, logInfo } from './logging/log';

// 처리하지 못한 오류도 같은 JSON 모양으로 남겨요.
process.on('unhandledRejection', (reason) => logError('unhandled_rejection', { message: String(reason) }));
process.on('uncaughtException', (error) => {
  logError('uncaught_exception', { message: error.message, stack: error.stack });
  process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정
  app.enableCors({
    origin: CLIENT_URL,
    credentials: true,
  });

  await app.listen(PORT);
  logInfo('server_started', { port: PORT, client: CLIENT_URL });
}
bootstrap();
