use anchor_lang::prelude::*;

// ──────────────────────────────────────────────
// Seeds
// ──────────────────────────────────────────────

pub const GAME_SESSION_SEED: &[u8] = b"game_session";
pub const PLAYER_BOARD_SEED: &[u8] = b"player_board";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/// Total number of cells on the board (10x10 grid).
pub const BOARD_SIZE: usize = 100;

/// Total number of ship cells across all 5 ships:
/// Aircraft Carrier (5) + Battleship (4) + Cruiser (3) + Submarine (3) + Destroyer (2) = 17
pub const TOTAL_SHIP_CELLS: u8 = 17;

/// Ship sizes in descending order.
pub const SHIP_SIZES: [u8; 5] = [5, 4, 3, 3, 2];

/// Size of the encrypted ship grid payload.
pub const ENCRYPTED_GRID_SIZE: usize = 112;

// ──────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────

/// Tracks the lifecycle of a game session.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum GameState {
    /// Game created, waiting for player two to join.
    Initialized,
    /// Both players have placed their ships.
    ShipsPlaced,
    /// Gameplay in progress (attacks are being processed).
    InProgress,
    /// A winner has been determined.
    Finished,
}

/// Represents the state of a single cell on the board as seen by the attacker.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum CellState {
    /// Cell has not been attacked yet.
    Unknown = 0,
    /// Cell was attacked and the shot missed.
    Miss = 1,
    /// Cell was attacked and the shot hit a ship.
    Hit = 2,
}

// ──────────────────────────────────────────────
// Accounts
// ──────────────────────────────────────────────

/// Represents a game session between two players.
///
/// PDA seeds: [b"game_session", &game_id.to_le_bytes()]
#[account]
pub struct GameSession {
    /// Unique identifier for this game.
    pub game_id: u64,

    /// Wallet pubkey of player one (the game creator).
    pub player_one: Pubkey,

    /// Wallet pubkey of player two (joins after creation). None until they join.
    pub player_two: Option<Pubkey>,

    /// Pubkey of the player whose turn it is.
    pub current_turn: Pubkey,

    /// Current state of the game lifecycle.
    pub game_state: GameState,

    /// The winner, set once the game reaches Finished state.
    pub winner: Option<Pubkey>,
}

impl GameSession {
    /// Space needed for serialization (excluding the 8-byte Anchor discriminator).
    ///   game_id:      8
    ///   player_one:   32
    ///   player_two:   1 + 32 = 33  (Option<Pubkey>)
    ///   current_turn: 32
    ///   game_state:   1
    ///   winner:       1 + 32 = 33  (Option<Pubkey>)
    ///   ─────────────────────────
    ///   Total:        139
    pub const SIZE: usize = 8 + 32 + 33 + 32 + 1 + 33;
}

/// Represents a single player's board in a game.
///
/// PDA seeds: [b"player_board", &game_id.to_le_bytes(), player.as_ref()]
#[account]
pub struct PlayerBoard {
    /// The game this board belongs to.
    pub game_id: u64,

    /// The player who owns this board.
    pub player: Pubkey,

    /// SHA-256 commitment hash of the ship grid (for post-game verification).
    pub grid_commitment: [u8; 32],

    /// Tracks the outcome of attacks on this board.
    /// Each cell is stored as a u8 matching CellState (0=Unknown, 1=Miss, 2=Hit).
    pub cell_states: [u8; BOARD_SIZE],

    /// Number of hit cells received. Game ends when this reaches TOTAL_SHIP_CELLS (17).
    pub hits_received: u8,

    /// Encrypted ship positions stored in the TEE.
    pub ship_grid_encrypted: [u8; ENCRYPTED_GRID_SIZE],

    /// Whether ships have been placed on this board.
    pub ships_placed: bool,
}

impl PlayerBoard {
    /// Space needed for serialization (excluding the 8-byte Anchor discriminator).
    ///   game_id:              8
    ///   player:               32
    ///   grid_commitment:      32
    ///   cell_states:          100
    ///   hits_received:        1
    ///   ship_grid_encrypted:  112
    ///   ships_placed:         1
    ///   ─────────────────────────
    ///   Total:                286
    pub const SIZE: usize = 8 + 32 + 32 + BOARD_SIZE + 1 + ENCRYPTED_GRID_SIZE + 1;
}
