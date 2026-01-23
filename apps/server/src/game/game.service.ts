import { Injectable } from '@nestjs/common';
import { GameState, GameMove, Player } from '@gomoku/shared';

@Injectable()
export class GameService {
  private gameState: GameState;
  private players: Map<string, Player> = new Map();

  constructor() {
    this.resetGame();
  }

  resetGame() {
    this.gameState = {
      board: Array(15)
        .fill(null)
        .map(() => Array(15).fill(null)),
      currentPlayer: 1,
      winner: null,
      isGameOver: false,
    };
  }

  addPlayer(clientId: string, name: string): Player {
    const playerNumber = this.players.size < 2 ? (this.players.size + 1) as 1 | 2 : 1;
    const player: Player = {
      id: clientId,
      name,
      playerNumber,
    };
    this.players.set(clientId, player);
    return player;
  }

  removePlayer(clientId: string) {
    this.players.delete(clientId);
  }

  getGameState(): GameState {
    return { ...this.gameState };
  }

  makeMove(move: GameMove): { success: boolean; winner?: 1 | 2; error?: string } {
    if (this.gameState.isGameOver) {
      return { success: false, error: 'Game is already over' };
    }

    if (this.gameState.currentPlayer !== move.player) {
      return { success: false, error: 'Not your turn' };
    }

    if (this.gameState.board[move.row][move.col] !== null) {
      return { success: false, error: 'Cell is already occupied' };
    }

    // Make the move
    this.gameState.board[move.row][move.col] = move.player;

    // Check for winner
    const winner = this.checkWinner(move.row, move.col, move.player);
    if (winner) {
      this.gameState.winner = winner;
      this.gameState.isGameOver = true;
      return { success: true, winner };
    }

    // Check for draw (board full)
    const isBoardFull = this.gameState.board.every((row) =>
      row.every((cell) => cell !== null),
    );
    if (isBoardFull) {
      this.gameState.isGameOver = true;
      return { success: true };
    }

    // Switch player
    this.gameState.currentPlayer = this.gameState.currentPlayer === 1 ? 2 : 1;

    return { success: true };
  }

  private checkWinner(row: number, col: number, player: 1 | 2): 1 | 2 | null {
    const directions = [
      [0, 1], // horizontal
      [1, 0], // vertical
      [1, 1], // diagonal \
      [1, -1], // diagonal /
    ];

    for (const [dx, dy] of directions) {
      let count = 1; // Count the current move

      // Check positive direction
      for (let i = 1; i < 5; i++) {
        const newRow = row + dx * i;
        const newCol = col + dy * i;
        if (
          newRow >= 0 &&
          newRow < 15 &&
          newCol >= 0 &&
          newCol < 15 &&
          this.gameState.board[newRow][newCol] === player
        ) {
          count++;
        } else {
          break;
        }
      }

      // Check negative direction
      for (let i = 1; i < 5; i++) {
        const newRow = row - dx * i;
        const newCol = col - dy * i;
        if (
          newRow >= 0 &&
          newRow < 15 &&
          newCol >= 0 &&
          newCol < 15 &&
          this.gameState.board[newRow][newCol] === player
        ) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 5) {
        return player;
      }
    }

    return null;
  }
}
