import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CLIENT_URL, PORT } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정
  app.enableCors({
    origin: CLIENT_URL,
    credentials: true,
  });

  await app.listen(PORT);
  console.log(`Server is running on port ${PORT} (client: ${CLIENT_URL})`);
}
bootstrap();
