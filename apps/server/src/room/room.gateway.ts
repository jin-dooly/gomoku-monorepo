import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import {
  Ack,
  ClientToServerEvents,
  RoomCreatePayloadSchema,
  RoomSummary,
  ServerToClientEvents,
} from '@gomoku/shared';
import { CLIENT_URL } from '../config';
import { RoomService } from './room.service';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * 방 이벤트 (docs/ux-spec.md 7장).
 * 핸들러가 돌려준 값은 Socket.IO acknowledgement로 클라이언트에 그대로 가요.
 */
@WebSocketGateway({
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayDisconnect {
  constructor(private readonly rooms: RoomService) {}

  handleDisconnect(client: GameSocket) {
    this.rooms.disconnect(client.id);
  }

  @SubscribeMessage('room:list')
  handleList(): Ack<RoomSummary[]> {
    return { ok: true, data: this.rooms.list() };
  }

  @SubscribeMessage('room:create')
  handleCreate(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): Ack<RoomSummary> {
    const parsed = RoomCreatePayloadSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, error: 'invalid-payload' };
    return this.rooms.create(client.id, parsed.data.nickname);
  }

  @SubscribeMessage('room:close')
  handleClose(@ConnectedSocket() client: GameSocket): Ack {
    return this.rooms.close(client.id);
  }

  @SubscribeMessage('room:leave')
  handleLeave(@ConnectedSocket() client: GameSocket): Ack {
    return this.rooms.leave(client.id);
  }
}
