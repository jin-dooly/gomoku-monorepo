import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  Ack,
  ClientToServerEvents,
  JoinDecisionPayloadSchema,
  JoinRequestPayloadSchema,
  JoinRequestTicket,
  RoomCreatePayloadSchema,
  RoomSummary,
  ServerToClientEvents,
} from '@gomoku/shared';
import { CLIENT_URL } from '../config';
import { RoomEvent, RoomService } from './room.service';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

const INVALID: Ack<never> = { ok: false, error: 'invalid-payload' };

/**
 * 방과 입장 요청 이벤트 (docs/ux-spec.md 7장).
 * 핸들러가 돌려준 값은 Socket.IO acknowledgement로 보낸 사람에게 가고,
 * 다른 사람에게 알릴 일은 RoomService의 이벤트를 받아 소켓 ID로 보내요.
 */
@WebSocketGateway({
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: GameServer;

  constructor(private readonly rooms: RoomService) {
    rooms.onEvent((event) => this.dispatch(event));
  }

  handleDisconnect(client: GameSocket) {
    this.rooms.disconnect(client.id);
  }

  // ---- 방 ----

  @SubscribeMessage('room:list')
  handleList(): Ack<RoomSummary[]> {
    return { ok: true, data: this.rooms.list() };
  }

  @SubscribeMessage('room:create')
  handleCreate(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): Ack<RoomSummary> {
    const parsed = RoomCreatePayloadSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
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

  // ---- 입장 요청 ----

  @SubscribeMessage('join:request')
  handleJoinRequest(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): Ack<JoinRequestTicket> {
    const parsed = JoinRequestPayloadSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    return this.rooms.requestJoin(client.id, parsed.data.roomId, parsed.data.nickname);
  }

  @SubscribeMessage('join:cancel')
  handleJoinCancel(@ConnectedSocket() client: GameSocket): Ack {
    return this.rooms.cancelJoin(client.id);
  }

  @SubscribeMessage('join:accept')
  handleJoinAccept(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): Ack {
    const parsed = JoinDecisionPayloadSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    return this.rooms.accept(client.id, parsed.data.requestId);
  }

  @SubscribeMessage('join:reject')
  handleJoinReject(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): Ack {
    const parsed = JoinDecisionPayloadSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    return this.rooms.reject(client.id, parsed.data.requestId);
  }

  private dispatch(event: RoomEvent) {
    switch (event.type) {
      case 'requests-changed':
        this.server.to(event.hostId).emit('join:requests', event.requests);
        break;
      case 'join-resolved':
        this.server.to(event.socketId).emit('join:resolved', { resolution: event.resolution });
        break;
      case 'game-over':
        this.server.to(event.socketId).emit('game:over', event.payload);
        break;
    }
  }
}
