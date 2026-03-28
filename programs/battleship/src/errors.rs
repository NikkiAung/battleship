use anchor_lang::prelude::*;

#[error_code]
pub enum GameError {
    #[msg("game has already started")]
    GameAlreadyStarted,
    #[msg("game is not in the initialized state")]
    GameNotInitialized,
    #[msg("game is not in progress")]
    GameNotInProgress,
    #[msg("game is already full")]
    GameFull,
    #[msg("game is already finished")]
    GameAlreadyFinished,
    #[msg("it is not your turn")]
    NotYourTurn,
    #[msg("you are not authorized to perform this action")]
    Unauthorized,
    #[msg("ships have already been placed on this board")]
    ShipsAlreadyPlaced,
    #[msg("ships have not been placed by both players yet")]
    ShipsNotPlaced,
    #[msg("invalid ship placement")]
    InvalidShipPlacement,
    #[msg("invalid coordinate, must be 0-99")]
    InvalidCoordinate,
    #[msg("this cell has already been attacked")]
    CellAlreadyAttacked,
}
