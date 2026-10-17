import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { GameMoveSchema } from '@gomoku/shared';
import { CLIENT_URL } from '../config';

@WebSocketGateway({
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private gameService: GameService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.gameService.removePlayer(client.id);
  }

  @SubscribeMessage('join-game')
  handleJoinGame(client: Socket, payload: { playerName: string }) {
    const player = this.gameService.addPlayer(client.id, payload.playerName);
    client.emit('player-joined', player);
    this.server.emit('game-state', this.gameService.getGameState());
  }

  @SubscribeMessage('make-move')
  handleMakeMove(client: Socket, payload: unknown) {
    try {
      const move = GameMoveSchema.parse(payload);
      const result = this.gameService.makeMove(move);
      
      if (result.success) {
        this.server.emit('game-state', this.gameService.getGameState());
        if (result.winner) {
          this.server.emit('game-over', { winner: result.winner });
        }
      } else {
        client.emit('move-error', { message: result.error });
      }
    } catch (error) {
      client.emit('move-error', { message: 'Invalid move data' });
    }
  }

  @SubscribeMessage('reset-game')
  handleResetGame() {
    this.gameService.resetGame();
    this.server.emit('game-state', this.gameService.getGameState());
  }
}
