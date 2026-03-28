use anchor_lang::prelude::*;

#[error_code]
pub enum GameError {
    // ── Game lifecycle errors ────────────────────
    #[msg("Game has already started.")]
    GameAlreadyStarted,

    #[msg("Game is not in the initialized state.")]
    GameNotInitialized,

    #[msg("Game is not in progress.")]
    GameNotInProgress,

    #[msg("Game is already full — both player slots are taken.")]
    GameFull,

    #[msg("Game is already finished.")]
    GameAlreadyFinished,

    // ── Turn / authorization errors ─────────────
    #[msg("It is not your turn.")]
    NotYourTurn,

    #[msg("You are not authorized to perform this action.")]
    Unauthorized,

    // ── Ship placement errors ───────────────────
    #[msg("Ships have already been placed on this board.")]
    ShipsAlreadyPlaced,

    #[msg("Ships have not been placed by both players yet.")]
    ShipsNotPlaced,

    #[msg("Invalid ship placement — ships overlap or go out of bounds.")]
    InvalidShipPlacement,

    // ── Attack errors ───────────────────────────
    #[msg("Invalid coordinate — must be within the 10x10 grid (0-99).")]
    InvalidCoordinate,

    #[msg("This cell has already been attacked.")]
    CellAlreadyAttacked,
}
