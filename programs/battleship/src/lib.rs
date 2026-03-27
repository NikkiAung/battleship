use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::*;

declare_id!("8tX8EQWsszJhLvbjws2cechrWR9MVxBG4sb3iTU2coJY");

// #[ephemeral]
#[program]
pub mod battleship {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn delegate(ctx: Context<Delegate>) -> Result<()> {
        // Delegation logic here
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct Delegate {}
