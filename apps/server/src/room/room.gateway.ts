import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import {
  Ack,
  ClientErrorPayloadSchema,
  RECONNECT_GRACE_MS,
  ClientToServerEvents,
  GameMovePayloadSchema,
  JoinDecisionPayloadSchema,
  JoinRequestPayloadSchema,
  JoinRequestTicket,
  RoomCreatePayloadSchema,
  RoomSummary,
  ServerToClientEvents,
  type SessionAuth,
} from '@gomoku/shared';
import { CLIENT_URL } from '../config';
import { RoomEvent, RoomService } from './room.service';
import { RateLimiter } from './rate-limiter';
import { logError, logInfo, shortId } from '../logging/log';

/** 소켓마다 붙여 두는 값. 연결 상태 복구 때도 함께 돌아와요. */
type SocketData = { sessionId: string };
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INVALID: Ack<never> = { ok: false, error: 'invalid-payload' };
const LIMITED: Ack<never> = { ok: false, error: 'rate-limited' };

/** 세션마다 10초에 30번까지. 사람이 두는 속도보다 훨씬 넉넉해요. */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10_000;

/**
 * 방, 입장 요청, 대국 이벤트 (docs/ux-spec.md 7장).
 * 핸들러가 돌려준 값은 Socket.IO acknowledgement로 보낸 사람에게 가고,
 * 다른 사람에게 알릴 일은 RoomService의 이벤트를 받아 그 사람의 세션 방(세션 ID)으로 보내요.
 *
 * 플레이어는 소켓이 아니라 세션 ID로 구분해요 (ux-spec 3장 "같은 사람 알아보기").
 * - 처음 연결하면 세션 ID를 발급하고, 다시 연결할 때 handshake auth로 받아요(새로고침 포함).
 * - 짧은 끊김은 Socket.IO 연결 상태 복구로 같은 소켓이 그대로 돌아와요.
 * - 한 세션의 소켓이 모두 끊기면 RoomService가 30초를 기다려요.
 */
@WebSocketGateway({
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: RECONNECT_GRACE_MS,
    skipMiddlewares: true,
  },
  // 이 게임의 메시지는 작아요(닉네임, 좌표). 큰 메시지로 메모리를 채우는 걸 막아요.
  maxHttpBufferSize: 10_000,
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: GameServer;

  /** 세션마다 연결된 소켓 수. 0이 되면 끊긴 거예요(예: 같은 세션의 탭 복제는 둘 이상). */
  private readonly sockets = new Map<string, number>();
  private readonly limiter = new RateLimiter(RATE_LIMIT, RATE_WINDOW_MS);

  constructor(private readonly rooms: RoomService) {
    rooms.onEvent((event) => this.dispatch(event));
  }

  handleConnection(client: GameSocket) {
    // 연결 상태 복구로 돌아온 소켓은 data와 참여한 방이 그대로예요.
    let sessionId = client.data.sessionId;
    if (!sessionId) {
      const given = (client.handshake.auth as SessionAuth | undefined)?.sessionId;
      sessionId = typeof given === 'string' && UUID.test(given) ? given : randomUUID();
      client.data.sessionId = sessionId;
      void client.join(sessionId);
    }
    this.sockets.set(sessionId, (this.sockets.get(sessionId) ?? 0) + 1);
    logInfo('socket_connected', { session: shortId(sessionId), recovered: client.recovered, sessions: this.sockets.size });
    client.emit('session:assigned', { sessionId });
    this.rooms.connect(sessionId);
  }

  handleDisconnect(client: GameSocket) {
    const sessionId = client.data.sessionId;
    if (!sessionId) return;
    const left = (this.sockets.get(sessionId) ?? 1) - 1;
    if (left > 0) {
      this.sockets.set(sessionId, left);
      return;
    }
    this.sockets.delete(sessionId);
    this.limiter.forget(sessionId);
    logInfo('session_disconnected', { session: shortId(sessionId), sessions: this.sockets.size });
    this.rooms.disconnect(sessionId);
  }

  // ---- 방 ----

  @SubscribeMessage('room:list')
  handleList(@ConnectedSocket() client: GameSocket): Ack<RoomSummary[]> {
    if (!this.allow(client)) return LIMITED;
    return { ok: true, data: this.rooms.list() };
  }

  @SubscribeMessage('room:create')
  handleCreate(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): Ack<RoomSummary> {
    if (!this.allow(client)) return LIMITED;
    const parsed = RoomCreatePayloadSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    const result = this.rooms.create(client.data.sessionId, parsed.data.nickname);
    if (result.ok) logInfo('room_created', { room: shortId(result.data.id), rooms: this.rooms.list().length });
    else if (result.error === 'too-many-rooms') logError('room_limit_reached');
    return result;
  }

  @SubscribeMessage('room:close')
  handleClose(@ConnectedSocket() client: GameSocket): Ack {
    if (!this.allow(client)) return LIMITED;
    return this.rooms.close(client.data.sessionId);
  }

  @SubscribeMessage('room:leave')
  handleLeave(@ConnectedSocket() client: GameSocket): Ack {
    if (!this.allow(client)) return LIMITED;
    return this.rooms.leave(client.data.sessionId);
  }

  @SubscribeMessage('room:reopen')
  handleReopen(@ConnectedSocket() client: GameSocket): Ack<RoomSummary> {
    if (!this.allow(client)) return LIMITED;
    return this.rooms.reopen(client.data.sessionId);
  }

  // ---- 입장 요청 ----

  @SubscribeMessage('join:request')
  handleJoinRequest(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): Ack<JoinRequestTicket> {
    if (!this.allow(client)) return LIMITED;
    const parsed = JoinRequestPayloadSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    return this.rooms.requestJoin(client.data.sessionId, parsed.data.roomId, parsed.data.nickname);
  }

  @SubscribeMessage('join:cancel')
  handleJoinCancel(@ConnectedSocket() client: GameSocket): Ack {
    if (!this.allow(client)) return LIMITED;
    return this.rooms.cancelJoin(client.data.sessionId);
  }

  @SubscribeMessage('join:accept')
  handleJoinAccept(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): Ack {
    if (!this.allow(client)) return LIMITED;
    const parsed = JoinDecisionPayloadSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    return this.rooms.accept(client.data.sessionId, parsed.data.requestId);
  }

  @SubscribeMessage('join:reject')
  handleJoinReject(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): Ack {
    if (!this.allow(client)) return LIMITED;
    const parsed = JoinDecisionPayloadSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    return this.rooms.reject(client.data.sessionId, parsed.data.requestId);
  }

  // ---- 대국 ----

  @SubscribeMessage('game:move')
  handleMove(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): Ack {
    if (!this.allow(client)) return LIMITED;
    const parsed = GameMovePayloadSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    return this.rooms.move(client.data.sessionId, parsed.data);
  }

  @SubscribeMessage('game:resign')
  handleResign(@ConnectedSocket() client: GameSocket): Ack {
    if (!this.allow(client)) return LIMITED;
    return this.rooms.resign(client.data.sessionId);
  }

  @SubscribeMessage('rematch:request')
  handleRematch(@ConnectedSocket() client: GameSocket): Ack {
    if (!this.allow(client)) return LIMITED;
    return this.rooms.requestRematch(client.data.sessionId);
  }

  // ---- 진단 ----

  /** 브라우저에서 난 오류를 로그로 남겨요. 답은 보내지 않아요. */
  @SubscribeMessage('client:error')
  handleClientError(@ConnectedSocket() client: GameSocket, @MessageBody() payload: unknown): void {
    if (!this.allow(client)) return;
    const parsed = ClientErrorPayloadSchema.safeParse(payload);
    if (!parsed.success) return;
    logError('client_error', { session: shortId(client.data.sessionId), ...parsed.data });
  }

  private allow(client: GameSocket): boolean {
    const allowed = this.limiter.take(client.data.sessionId);
    if (!allowed) logError('rate_limited', { session: shortId(client.data.sessionId) });
    return allowed;
  }

  private dispatch(event: RoomEvent) {
    switch (event.type) {
      case 'requests-changed':
        this.server.to(event.hostId).emit('join:requests', event.requests);
        break;
      case 'join-resolved':
        this.server.to(event.playerId).emit('join:resolved', { resolution: event.resolution });
        break;
      case 'game-state':
        this.server.to(event.playerId).emit('game:state', event.payload);
        break;
      case 'game-over':
        this.server.to(event.playerId).emit('game:over', event.payload);
        logInfo('game_over', {
          to: shortId(event.playerId),
          reason: event.payload.reason,
          winner: event.payload.winner,
          moves: event.payload.moveCount,
        });
        break;
      case 'rematch-status':
        this.server.to(event.playerId).emit('rematch:status', { requestedBy: event.requestedBy });
        break;
      case 'opponent-left':
        this.server.to(event.playerId).emit('opponent:left', event.payload);
        break;
      case 'opponent-disconnected':
        this.server.to(event.playerId).emit('opponent:disconnected', { remainingMs: event.remainingMs });
        break;
      case 'opponent-reconnected':
        this.server.to(event.playerId).emit('opponent:reconnected');
        break;
      case 'resume':
        this.server.to(event.playerId).emit('session:resume', event.payload);
        break;
    }
  }
}
