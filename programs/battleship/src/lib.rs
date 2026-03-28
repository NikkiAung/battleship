use anchor_lang::prelude::*;

pub mod errors;
pub mod state;

declare_id!("8tX8EQWsszJhLvbjws2cechrWR9MVxBG4sb3iTU2coJY");

#[program]
pub mod battleship {
    use super::*;

    /// Placeholder — real instructions will be added in the next step.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
