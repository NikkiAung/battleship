use anchor_lang::prelude::*;

// seeds
pub const GAME_SESSION_SEED: &[u8] = b"game_session";
pub const PLAYER_BOARD_SEED: &[u8] = b"player_board";

// board constants
pub const BOARD_SIZE: usize = 100;
pub const TOTAL_SHIP_CELLS: u8 = 17;
pub const SHIP_SIZES: [u8; 5] = [5, 4, 3, 3, 2];
pub const ENCRYPTED_GRID_SIZE: usize = 112;

// game lifecycle states
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum GameState {
    Initialized,
    ShipsPlaced,
    InProgress,
    Finished,
}

// cell state as seen by attacker
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum CellState {
    Unknown = 0,
    Miss = 1,
    Hit = 2,
}

// pda: [b"game_session", &game_id.to_le_bytes()]
#[account]
pub struct GameSession {
    pub game_id: u64,
    pub player_one: Pubkey,
    pub player_two: Option<Pubkey>,
    pub current_turn: Pubkey,
    pub game_state: GameState,
    pub winner: Option<Pubkey>,
}

impl GameSession {
    // 8 + 32 + 33 + 32 + 1 + 33 = 139
    pub const SIZE: usize = 8 + 32 + 33 + 32 + 1 + 33;
}

// pda: [b"player_board", &game_id.to_le_bytes(), player.as_ref()]
#[account]
pub struct PlayerBoard {
    pub game_id: u64,
    pub player: Pubkey,
    pub grid_commitment: [u8; 32],
    pub cell_states: [u8; BOARD_SIZE],
    pub hits_received: u8,
    pub ship_grid_encrypted: [u8; ENCRYPTED_GRID_SIZE],
    pub ships_placed: bool,
}

impl PlayerBoard {
    // 8 + 32 + 32 + 100 + 1 + 112 + 1 = 286
    pub const SIZE: usize = 8 + 32 + 32 + BOARD_SIZE + 1 + ENCRYPTED_GRID_SIZE + 1;
}
