// battleship program types
// auto-generated from IDL

import type { PublicKey } from "@solana/web3.js";

// program id from deployed contract
export const PROGRAM_ID = "8tX8EQWsszJhLvbjws2cechrWR9MVxBG4sb3iTU2coJY";

// cell state constants
export const CellState = {
  Empty: 0,
  Ship: 1,
  Hit: 2,
  Miss: 3,
} as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

// game state constants
export const GameState = {
  WaitingForPlayers: 0,
  Placement: 1,
  InProgress: 2,
  Delegated: 3,
  Finished: 4,
} as const;
export type GameState = (typeof GameState)[keyof typeof GameState];

// game session account
export interface GameSession {
  gameId: number[];
  playerOne: PublicKey;
  playerTwo: PublicKey | null;
  currentTurn: PublicKey;
  gameState: GameState;
  winner: PublicKey | null;
  bump: number;
}

// player board account
export interface PlayerBoard {
  gameId: number[];
  player: PublicKey;
  shipPositions: number[];
  cellStates: CellState[];
  hitsReceived: number;
  isReady: boolean;
  bump: number;
}

// pda seeds
export const GAME_SESSION_SEED = "game_session";
export const PLAYER_BOARD_SEED = "player_board";

// ship sizes for battleship (5+4+3+3+2=17 total cells)
export const SHIP_SIZES = [5, 4, 3, 3, 2];
export const TOTAL_SHIP_CELLS = 17;
export const GRID_SIZE = 10;
