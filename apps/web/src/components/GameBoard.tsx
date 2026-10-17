import { GameState, Player } from '@gomoku/shared';

interface GameBoardProps {
  gameState: GameState;
  player: Player | null;
  onCellClick: (row: number, col: number) => void;
}

export const GameBoard = ({ gameState, player, onCellClick }: GameBoardProps) => {
  const getCellContent = (row: number, col: number) => {
    const value = gameState.board[row][col];
    if (value === 1) return '⚫';
    if (value === 2) return '⚪';
    return '';
  };

  const canMakeMove = (row: number, col: number) => {
    if (gameState.isGameOver) return false;
    if (!player) return false;
    if (gameState.currentPlayer !== player.playerNumber) return false;
    return gameState.board[row][col] === null;
  };

  return (
    <div className="game-board">
      <div className="board-info">
        <p>현재 플레이어: {gameState.currentPlayer === 1 ? '⚫' : '⚪'}</p>
        {gameState.isGameOver && gameState.winner && (
          <p>승자: {gameState.winner === 1 ? '⚫' : '⚪'}</p>
        )}
        {player && (
          <p>당신은: {player.playerNumber === 1 ? '⚫' : '⚪'} ({player.name})</p>
        )}
      </div>
      <div className="board-grid">
        {gameState.board.map((row, rowIndex) => (
          <div key={rowIndex} className="board-row">
            {row.map((_cell, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                className="board-cell"
                onClick={() => onCellClick(rowIndex, colIndex)}
                disabled={!canMakeMove(rowIndex, colIndex)}
              >
                {getCellContent(rowIndex, colIndex)}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
