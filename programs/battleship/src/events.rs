use anchor_lang::prelude::*;

#[event]
pub struct GameInitialized {
    pub game_id: u64,
    pub player_one: Pubkey,
}

#[event]
pub struct AttackProcessed {
    pub game_id: u64,
    pub attacker: Pubkey,
    pub cell: u8,
    pub hit: bool,
}

#[event]
pub struct GameFinalized {
    pub game_id: u64,
    pub winner: Pubkey,
}
