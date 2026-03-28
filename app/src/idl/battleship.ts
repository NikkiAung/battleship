// battleship program types — matches programs/battleship/src/state.rs

import type { PublicKey } from "@solana/web3.js";
import type { BN } from "@coral-xyz/anchor";

// program id from anchor deploy
export const PROGRAM_ID = "8tX8EQWsszJhLvbjws2cechrWR9MVxBG4sb3iTU2coJY";

// board constants (must match state.rs)
export const BOARD_SIZE = 100;
export const TOTAL_SHIP_CELLS = 17;
export const SHIP_SIZES = [5, 4, 3, 3, 2];
export const ENCRYPTED_GRID_SIZE = 112;
export const GRID_SIZE = 10;

// cell state enum — matches CellState in state.rs
// Unknown=0, Miss=1, Hit=2 (attacker's view of opponent board)
export const CellState = {
  Unknown: 0,
  Miss: 1,
  Hit: 2,
} as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

// anchor deserializes rust enums as { variantName: {} } objects
export type GameStateValue =
  | { initialized: Record<string, never> }
  | { shipsPlaced: Record<string, never> }
  | { inProgress: Record<string, never> }
  | { finished: Record<string, never> };

// helper to check game state variant
export const isGameState = {
  initialized: (s: GameStateValue): boolean => "initialized" in s,
  shipsPlaced: (s: GameStateValue): boolean => "shipsPlaced" in s,
  inProgress: (s: GameStateValue): boolean => "inProgress" in s,
  finished: (s: GameStateValue): boolean => "finished" in s,
};

// game session account — matches GameSession in state.rs
export interface GameSession {
  gameId: BN;
  playerOne: PublicKey;
  playerTwo: PublicKey | null;
  currentTurn: PublicKey;
  gameState: GameStateValue;
  winner: PublicKey | null;
}

// player board account — matches PlayerBoard in state.rs
export interface PlayerBoard {
  gameId: BN;
  player: PublicKey;
  gridCommitment: number[]; // [u8; 32]
  cellStates: number[]; // [u8; 100]
  hitsReceived: number; // u8
  shipGridEncrypted: number[]; // [u8; 112]
  shipPositions: number[]; // [u8; 100] raw grid: 1=ship, 0=water
  shipsPlaced: boolean;
}

// pda seeds
export const GAME_SESSION_SEED = "game_session";
export const PLAYER_BOARD_SEED = "player_board";
