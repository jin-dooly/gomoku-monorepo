export type GameState = {
  board: (number | null)[][];
  currentPlayer: 1 | 2;
  winner: 1 | 2 | null;
  isGameOver: boolean;
};

export type Player = {
  id: string;
  name: string;
  playerNumber: 1 | 2;
};

export type GameMove = {
  row: number;
  col: number;
  player: 1 | 2;
  timestamp: number;
};
