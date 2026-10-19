import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomGateway } from './room/room.gateway';
import { RoomService } from './room/room.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, RoomGateway, RoomService],
})
export class AppModule {}
