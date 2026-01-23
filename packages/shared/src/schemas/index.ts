import { z } from 'zod';

export const GameMoveSchema = z.object({
  row: z.number().int().min(0).max(14),
  col: z.number().int().min(0).max(14),
  player: z.union([z.literal(1), z.literal(2)]),
  timestamp: z.number(),
});

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  playerNumber: z.union([z.literal(1), z.literal(2)]),
});

export const GameStateSchema = z.object({
  board: z.array(z.array(z.union([z.number(), z.null()]))),
  currentPlayer: z.union([z.literal(1), z.literal(2)]),
  winner: z.union([z.literal(1), z.literal(2), z.null()]),
  isGameOver: z.boolean(),
});
