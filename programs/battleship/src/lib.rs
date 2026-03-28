use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;

pub mod errors;
pub mod events;
pub mod state;

use errors::GameError;
use events::*;
use state::*;

declare_id!("8tX8EQWsszJhLvbjws2cechrWR9MVxBG4sb3iTU2coJY");

#[ephemeral]
#[program]
pub mod battleship {
    use super::*;

    // create a new game session, caller becomes player one
    pub fn initialize_game(ctx: Context<InitializeGame>, game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game_session;
        game.game_id = game_id;
        game.player_one = ctx.accounts.player_one.key();
        game.player_two = None;
        game.current_turn = ctx.accounts.player_one.key();
        game.game_state = GameState::Initialized;
        game.winner = None;

        emit!(GameInitialized {
            game_id,
            player_one: ctx.accounts.player_one.key(),
        });

        Ok(())
    }

    // create a player board for an existing game, second player joins here
    pub fn initialize_player_board(
        ctx: Context<InitializePlayerBoard>,
        game_id: u64,
    ) -> Result<()> {
        let game = &mut ctx.accounts.game_session;
        let board = &mut ctx.accounts.player_board;
        let player = ctx.accounts.player.key();

        require!(
            game.game_state == GameState::Initialized,
            GameError::GameAlreadyStarted
        );

        // if caller is not player one, they join as player two
        if player != game.player_one {
            require!(game.player_two.is_none(), GameError::GameFull);
            game.player_two = Some(player);
        }

        board.game_id = game_id;
        board.player = player;
        board.grid_commitment = [0u8; 32];
        board.cell_states = [0u8; BOARD_SIZE];
        board.hits_received = 0;
        board.ship_grid_encrypted = [0u8; ENCRYPTED_GRID_SIZE];
        board.ship_positions = [0u8; BOARD_SIZE];
        board.ships_placed = false;

        Ok(())
    }

    // place ships on the board: stores raw positions, encrypted grid, and commitment
    pub fn auto_place_ships(
        ctx: Context<AutoPlaceShips>,
        _game_id: u64,
        ship_positions: [u8; BOARD_SIZE],
        encrypted_grid: [u8; ENCRYPTED_GRID_SIZE],
        grid_commitment: [u8; 32],
    ) -> Result<()> {
        let board = &mut ctx.accounts.player_board;

        require!(!board.ships_placed, GameError::ShipsAlreadyPlaced);

        // validate ship count
        let ship_count: u8 = ship_positions.iter().filter(|&&v| v == 1).count() as u8;
        require!(
            ship_count == TOTAL_SHIP_CELLS,
            GameError::InvalidShipPlacement
        );

        board.ship_positions = ship_positions;
        board.ship_grid_encrypted = encrypted_grid;
        board.grid_commitment = grid_commitment;
        board.ships_placed = true;

        Ok(())
    }

    // start the game once both players have placed ships
    pub fn start_game(ctx: Context<StartGame>, _game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game_session;
        let board_one = &ctx.accounts.board_one;
        let board_two = &ctx.accounts.board_two;

        require!(
            game.game_state == GameState::Initialized,
            GameError::GameAlreadyStarted
        );
        require!(game.player_two.is_some(), GameError::GameNotInitialized);
        require!(board_one.ships_placed, GameError::ShipsNotPlaced);
        require!(board_two.ships_placed, GameError::ShipsNotPlaced);

        game.game_state = GameState::InProgress;

        Ok(())
    }

    // process an attack on the opponent's board
    // hit/miss is determined on-chain from ship_positions — no client trust needed
    pub fn process_attack(ctx: Context<ProcessAttack>, _game_id: u64, cell: u8) -> Result<()> {
        let game = &mut ctx.accounts.game_session;
        let target_board = &mut ctx.accounts.target_board;
        let attacker = ctx.accounts.attacker.key();

        require!(
            game.game_state == GameState::InProgress,
            GameError::GameNotInProgress
        );
        require!(game.current_turn == attacker, GameError::NotYourTurn);
        require!((cell as usize) < BOARD_SIZE, GameError::InvalidCoordinate);
        require!(
            target_board.cell_states[cell as usize] == 0,
            GameError::CellAlreadyAttacked
        );

        // determine hit or miss from the target board's ship positions
        let is_hit = target_board.ship_positions[cell as usize] == 1;

        if is_hit {
            target_board.cell_states[cell as usize] = CellState::Hit as u8;
            target_board.hits_received += 1;
        } else {
            target_board.cell_states[cell as usize] = CellState::Miss as u8;
        }

        // swap turns
        if attacker == game.player_one {
            game.current_turn = game.player_two.unwrap();
        } else {
            game.current_turn = game.player_one;
        }

        emit!(AttackProcessed {
            game_id: game.game_id,
            attacker,
            cell,
            hit: is_hit,
        });

        Ok(())
    }

    // check if a winner exists based on hits received
    pub fn check_winner(ctx: Context<CheckWinner>, _game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game_session;
        let board_one = &ctx.accounts.board_one;
        let board_two = &ctx.accounts.board_two;

        require!(
            game.game_state == GameState::InProgress,
            GameError::GameNotInProgress
        );

        if board_one.hits_received >= TOTAL_SHIP_CELLS {
            // player one's ships are sunk, player two wins
            game.winner = game.player_two;
            game.game_state = GameState::Finished;
        } else if board_two.hits_received >= TOTAL_SHIP_CELLS {
            // player two's ships are sunk, player one wins
            game.winner = Some(game.player_one);
            game.game_state = GameState::Finished;
        }

        Ok(())
    }

    // delegate game session to ephemeral rollup for fast gameplay
    pub fn delegate_to_er(ctx: Context<DelegateToER>, game_id: u64) -> Result<()> {
        // delegate the game session pda to the er
        ctx.accounts.delegate_game_session(
            &ctx.accounts.payer,
            &[GAME_SESSION_SEED, &game_id.to_le_bytes()],
            DelegateConfig::default(),
        )?;

        Ok(())
    }

    // undelegate game session from er, commits final state back to l1
    pub fn undelegate_from_er(ctx: Context<UndelegateFromER>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.game_session.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
            None,
        )?;

        Ok(())
    }

    // finalize the game, record winner on chain
    pub fn finalize_game(ctx: Context<FinalizeGame>, _game_id: u64) -> Result<()> {
        let game = &ctx.accounts.game_session;

        require!(
            game.game_state == GameState::Finished,
            GameError::GameNotInProgress
        );
        require!(game.winner.is_some(), GameError::GameNotInProgress);

        emit!(GameFinalized {
            game_id: game.game_id,
            winner: game.winner.unwrap(),
        });

        Ok(())
    }
}

// -- account contexts --

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct InitializeGame<'info> {
    #[account(
        init,
        payer = player_one,
        space = 8 + GameSession::SIZE,
        seeds = [GAME_SESSION_SEED, &game_id.to_le_bytes()],
        bump,
    )]
    pub game_session: Account<'info, GameSession>,
    #[account(mut)]
    pub player_one: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct InitializePlayerBoard<'info> {
    #[account(mut, seeds = [GAME_SESSION_SEED, &game_id.to_le_bytes()], bump)]
    pub game_session: Account<'info, GameSession>,
    #[account(
        init,
        payer = player,
        space = 8 + PlayerBoard::SIZE,
        seeds = [PLAYER_BOARD_SEED, &game_id.to_le_bytes(), player.key().as_ref()],
        bump,
    )]
    pub player_board: Account<'info, PlayerBoard>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct AutoPlaceShips<'info> {
    #[account(
        mut,
        seeds = [PLAYER_BOARD_SEED, &game_id.to_le_bytes(), player.key().as_ref()],
        bump,
    )]
    pub player_board: Account<'info, PlayerBoard>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct StartGame<'info> {
    #[account(mut, seeds = [GAME_SESSION_SEED, &game_id.to_le_bytes()], bump)]
    pub game_session: Account<'info, GameSession>,
    // player one's board
    pub board_one: Account<'info, PlayerBoard>,
    // player two's board
    pub board_two: Account<'info, PlayerBoard>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct ProcessAttack<'info> {
    #[account(mut, seeds = [GAME_SESSION_SEED, &game_id.to_le_bytes()], bump)]
    pub game_session: Account<'info, GameSession>,
    // the board being attacked (opponent's board)
    #[account(mut)]
    pub target_board: Account<'info, PlayerBoard>,
    pub attacker: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CheckWinner<'info> {
    #[account(mut, seeds = [GAME_SESSION_SEED, &game_id.to_le_bytes()], bump)]
    pub game_session: Account<'info, GameSession>,
    // player one's board
    pub board_one: Account<'info, PlayerBoard>,
    // player two's board
    pub board_two: Account<'info, PlayerBoard>,
}

// delegate macro injects delegation program accounts
#[delegate]
#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct DelegateToER<'info> {
    #[account(
        mut,
        seeds = [GAME_SESSION_SEED, &game_id.to_le_bytes()],
        bump,
        del,
    )]
    pub game_session: Account<'info, GameSession>,
    pub payer: Signer<'info>,
}

// commit macro injects magic_context and magic_program
#[commit]
#[derive(Accounts)]
pub struct UndelegateFromER<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub game_session: Account<'info, GameSession>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct FinalizeGame<'info> {
    #[account(seeds = [GAME_SESSION_SEED, &game_id.to_le_bytes()], bump)]
    pub game_session: Account<'info, GameSession>,
}
