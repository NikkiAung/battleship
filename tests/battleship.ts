import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Battleship } from "../target/types/battleship";

// ──────────────────────────────────────────────
// Constants (mirror the Rust program values)
// ──────────────────────────────────────────────

const GAME_SESSION_SEED = "game_session";
const PLAYER_BOARD_SEED = "player_board";

const BOARD_SIZE = 100;
const TOTAL_SHIP_CELLS = 17;
const SHIP_SIZES = [5, 4, 3, 3, 2];
const ENCRYPTED_GRID_SIZE = 112;

// Account sizes (excluding 8-byte Anchor discriminator)
const GAME_SESSION_DATA_SIZE = 8 + 32 + 33 + 32 + 1 + 33; // 139
const PLAYER_BOARD_DATA_SIZE =
  8 + 32 + 32 + BOARD_SIZE + 1 + ENCRYPTED_GRID_SIZE + 1; // 286

// Error codes (Anchor custom errors start at 6000)
const ERROR_CODES = {
  GameAlreadyStarted: 6000,
  GameNotInitialized: 6001,
  GameNotInProgress: 6002,
  GameFull: 6003,
  GameAlreadyFinished: 6004,
  NotYourTurn: 6005,
  Unauthorized: 6006,
  ShipsAlreadyPlaced: 6007,
  ShipsNotPlaced: 6008,
  InvalidShipPlacement: 6009,
  InvalidCoordinate: 6010,
  CellAlreadyAttacked: 6011,
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function gameSessionPda(
  programId: PublicKey,
  gameId: number
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(gameId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GAME_SESSION_SEED), buf],
    programId
  );
}

function playerBoardPda(
  programId: PublicKey,
  gameId: number,
  player: PublicKey
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(gameId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_BOARD_SEED), buf, player.toBuffer()],
    programId
  );
}

/** Airdrop SOL to a keypair and wait for confirmation. */
async function airdrop(
  connection: anchor.web3.Connection,
  to: PublicKey,
  amount = 2 * LAMPORTS_PER_SOL
) {
  const sig = await connection.requestAirdrop(to, amount);
  await connection.confirmTransaction(sig, "confirmed");
}

/** Return a unique game_id based on timestamp + random to avoid PDA collisions across test runs. */
function uniqueGameId(): number {
  return (
    Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000)
  );
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("battleship", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.battleship as Program<Battleship>;
  const programId = program.programId;
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;

  // ── PDA derivation ─────────────────────────

  describe("PDA derivation", () => {
    it("derives GameSession PDA deterministically for a given game_id", () => {
      const [pda1, bump1] = gameSessionPda(programId, 1);
      const [pda2, bump2] = gameSessionPda(programId, 1);

      expect(pda1.toBase58()).to.equal(pda2.toBase58());
      expect(bump1).to.equal(bump2);
    });

    it("derives different GameSession PDAs for different game_ids", () => {
      const [pda1] = gameSessionPda(programId, 1);
      const [pda2] = gameSessionPda(programId, 2);

      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("derives PlayerBoard PDA deterministically for a given game_id + player", () => {
      const player = Keypair.generate().publicKey;
      const [pda1, bump1] = playerBoardPda(programId, 1, player);
      const [pda2, bump2] = playerBoardPda(programId, 1, player);

      expect(pda1.toBase58()).to.equal(pda2.toBase58());
      expect(bump1).to.equal(bump2);
    });

    it("derives different PlayerBoard PDAs for different players in the same game", () => {
      const playerA = Keypair.generate().publicKey;
      const playerB = Keypair.generate().publicKey;

      const [pdaA] = playerBoardPda(programId, 1, playerA);
      const [pdaB] = playerBoardPda(programId, 1, playerB);

      expect(pdaA.toBase58()).to.not.equal(pdaB.toBase58());
    });

    it("derives different PlayerBoard PDAs for the same player in different games", () => {
      const player = Keypair.generate().publicKey;

      const [pda1] = playerBoardPda(programId, 1, player);
      const [pda2] = playerBoardPda(programId, 2, player);

      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("GameSession PDA is off-curve (not a valid keypair)", () => {
      const [pda] = gameSessionPda(programId, 42);
      expect(PublicKey.isOnCurve(pda.toBytes())).to.be.false;
    });

    it("PlayerBoard PDA is off-curve", () => {
      const player = Keypair.generate().publicKey;
      const [pda] = playerBoardPda(programId, 42, player);
      expect(PublicKey.isOnCurve(pda.toBytes())).to.be.false;
    });
  });

  // ── Account size constants ──────────────────

  describe("account size constants", () => {
    it("GameSession SIZE matches expected layout", () => {
      const expected = 8 + 32 + 33 + 32 + 1 + 33;
      expect(GAME_SESSION_DATA_SIZE).to.equal(expected);
      expect(GAME_SESSION_DATA_SIZE).to.equal(139);
    });

    it("PlayerBoard SIZE matches expected layout", () => {
      const expected = 8 + 32 + 32 + 100 + 1 + 112 + 1;
      expect(PLAYER_BOARD_DATA_SIZE).to.equal(expected);
      expect(PLAYER_BOARD_DATA_SIZE).to.equal(286);
    });

    it("total account allocation includes 8-byte discriminator", () => {
      const gameSessionTotal = 8 + GAME_SESSION_DATA_SIZE;
      const playerBoardTotal = 8 + PLAYER_BOARD_DATA_SIZE;

      expect(gameSessionTotal).to.equal(147);
      expect(playerBoardTotal).to.equal(294);
    });
  });

  // ── Game constants ──────────────────────────

  describe("game constants", () => {
    it("board is 10x10 = 100 cells", () => {
      expect(BOARD_SIZE).to.equal(100);
    });

    it("ships have correct sizes", () => {
      expect(SHIP_SIZES).to.deep.equal([5, 4, 3, 3, 2]);
    });

    it("there are 5 ships total", () => {
      expect(SHIP_SIZES.length).to.equal(5);
    });

    it("total ship cells equals sum of all ship sizes (17)", () => {
      const sum = SHIP_SIZES.reduce((a, b) => a + b, 0);
      expect(sum).to.equal(TOTAL_SHIP_CELLS);
    });

    it("encrypted grid size is 112 bytes", () => {
      expect(ENCRYPTED_GRID_SIZE).to.equal(112);
    });

    it("every ship fits within the 10x10 board", () => {
      for (const size of SHIP_SIZES) {
        expect(size).to.be.at.most(10);
        expect(size).to.be.at.least(1);
      }
    });
  });

  // ── Error codes ─────────────────────────────

  describe("error codes", () => {
    it("IDL contains all expected error codes", () => {
      const idlErrors = (program.idl.errors ?? []) as Array<{
        code: number;
        name: string;
        msg: string;
      }>;

      for (const [name, code] of Object.entries(ERROR_CODES)) {
        const found = idlErrors.find((e) => e.code === code);
        expect(found, `error code ${code} (${name}) should exist in IDL`).to.not
          .be.undefined;
      }
    });

    it("error codes are sequential from 6000 to 6011", () => {
      const codes = Object.values(ERROR_CODES).sort((a, b) => a - b);
      expect(codes[0]).to.equal(6000);
      expect(codes[codes.length - 1]).to.equal(6011);

      for (let i = 1; i < codes.length; i++) {
        expect(codes[i]).to.equal(codes[i - 1] + 1);
      }
    });

    it("has 12 custom error codes total", () => {
      expect(Object.keys(ERROR_CODES).length).to.equal(12);
    });

    it("each error has a non-empty message in the IDL", () => {
      const idlErrors = (program.idl.errors ?? []) as Array<{
        code: number;
        name: string;
        msg: string;
      }>;
      for (const err of idlErrors) {
        expect(err.msg, `error ${err.code} should have a message`).to.be.a(
          "string"
        );
        expect(err.msg.length).to.be.greaterThan(0);
      }
    });
  });

  // ── initialize_game ─────────────────────────

  describe("initialize_game", () => {
    it("creates a GameSession PDA with correct initial state", async () => {
      const gameId = uniqueGameId();
      const playerOne = provider.wallet;

      const [gameSessionPdaKey] = gameSessionPda(programId, gameId);

      await program.methods
        .initializeGame(new anchor.BN(gameId))
        .accounts({
          gameSession: gameSessionPdaKey,
          playerOne: playerOne.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Fetch and verify the on-chain state
      const gameSession = await program.account.gameSession.fetch(
        gameSessionPdaKey
      );

      expect(gameSession.gameId.toNumber()).to.equal(gameId);
      expect(gameSession.playerOne.toBase58()).to.equal(
        playerOne.publicKey.toBase58()
      );
      expect(gameSession.playerTwo).to.be.null;
      expect(gameSession.currentTurn.toBase58()).to.equal(
        playerOne.publicKey.toBase58()
      );
      expect(gameSession.gameState).to.deep.equal({ initialized: {} });
      expect(gameSession.winner).to.be.null;
    });

    it("creates games with different IDs independently", async () => {
      const gameId1 = uniqueGameId();
      const gameId2 = gameId1 + 1;

      const [pda1] = gameSessionPda(programId, gameId1);
      const [pda2] = gameSessionPda(programId, gameId2);

      await program.methods
        .initializeGame(new anchor.BN(gameId1))
        .accounts({
          gameSession: pda1,
          playerOne: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .initializeGame(new anchor.BN(gameId2))
        .accounts({
          gameSession: pda2,
          playerOne: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const game1 = await program.account.gameSession.fetch(pda1);
      const game2 = await program.account.gameSession.fetch(pda2);

      expect(game1.gameId.toNumber()).to.equal(gameId1);
      expect(game2.gameId.toNumber()).to.equal(gameId2);
    });

    it("fails when trying to create a game with a duplicate game_id", async () => {
      const gameId = uniqueGameId();
      const [pda] = gameSessionPda(programId, gameId);

      await program.methods
        .initializeGame(new anchor.BN(gameId))
        .accounts({
          gameSession: pda,
          playerOne: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Attempting to create the same game again should fail (PDA already exists)
      try {
        await program.methods
          .initializeGame(new anchor.BN(gameId))
          .accounts({
            gameSession: pda,
            playerOne: provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown an error for duplicate game_id");
      } catch (err: any) {
        // Anchor throws when trying to init an already-existing account
        expect(err).to.exist;
      }
    });

    it("different players can each create their own games", async () => {
      const playerTwo = Keypair.generate();
      await airdrop(connection, playerTwo.publicKey);

      const gameId1 = uniqueGameId();
      const gameId2 = gameId1 + 1;

      const [pda1] = gameSessionPda(programId, gameId1);
      const [pda2] = gameSessionPda(programId, gameId2);

      // Player one (provider wallet) creates game 1
      await program.methods
        .initializeGame(new anchor.BN(gameId1))
        .accounts({
          gameSession: pda1,
          playerOne: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Player two creates game 2
      await program.methods
        .initializeGame(new anchor.BN(gameId2))
        .accounts({
          gameSession: pda2,
          playerOne: playerTwo.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([playerTwo])
        .rpc();

      const game1 = await program.account.gameSession.fetch(pda1);
      const game2 = await program.account.gameSession.fetch(pda2);

      expect(game1.playerOne.toBase58()).to.equal(
        provider.wallet.publicKey.toBase58()
      );
      expect(game2.playerOne.toBase58()).to.equal(
        playerTwo.publicKey.toBase58()
      );
    });
  });

  // ── initialize_player_board ─────────────────

  describe("initialize_player_board", () => {
    let gameId: number;
    let gameSessionPdaKey: PublicKey;
    let playerTwo: Keypair;

    beforeEach(async () => {
      gameId = uniqueGameId();
      [gameSessionPdaKey] = gameSessionPda(programId, gameId);
      playerTwo = Keypair.generate();

      // Create a fresh game for each test
      await program.methods
        .initializeGame(new anchor.BN(gameId))
        .accounts({
          gameSession: gameSessionPdaKey,
          playerOne: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Fund player two
      await airdrop(connection, playerTwo.publicKey);
    });

    it("player one can create their board", async () => {
      const [boardPda] = playerBoardPda(
        programId,
        gameId,
        provider.wallet.publicKey
      );

      await program.methods
        .initializePlayerBoard(new anchor.BN(gameId))
        .accounts({
          gameSession: gameSessionPdaKey,
          playerBoard: boardPda,
          player: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const board = await program.account.playerBoard.fetch(boardPda);

      expect(board.gameId.toNumber()).to.equal(gameId);
      expect(board.player.toBase58()).to.equal(
        provider.wallet.publicKey.toBase58()
      );
      expect(board.hitsReceived).to.equal(0);
      expect(board.shipsPlaced).to.be.false;
      expect(board.gridCommitment).to.deep.equal(new Array(32).fill(0));
      expect(board.cellStates).to.deep.equal(new Array(100).fill(0));
      expect(board.shipGridEncrypted).to.deep.equal(new Array(112).fill(0));
    });

    it("player two joins the game by creating their board", async () => {
      const [boardPda] = playerBoardPda(programId, gameId, playerTwo.publicKey);

      await program.methods
        .initializePlayerBoard(new anchor.BN(gameId))
        .accounts({
          gameSession: gameSessionPdaKey,
          playerBoard: boardPda,
          player: playerTwo.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([playerTwo])
        .rpc();

      // Verify the board was created
      const board = await program.account.playerBoard.fetch(boardPda);
      expect(board.player.toBase58()).to.equal(playerTwo.publicKey.toBase58());
      expect(board.gameId.toNumber()).to.equal(gameId);

      // Verify player_two was set on the game session
      const gameSession = await program.account.gameSession.fetch(
        gameSessionPdaKey
      );
      expect(gameSession.playerTwo.toBase58()).to.equal(
        playerTwo.publicKey.toBase58()
      );
    });

    it("both players can create boards in the same game", async () => {
      const [board1Pda] = playerBoardPda(
        programId,
        gameId,
        provider.wallet.publicKey
      );
      const [board2Pda] = playerBoardPda(
        programId,
        gameId,
        playerTwo.publicKey
      );

      // Player one creates their board
      await program.methods
        .initializePlayerBoard(new anchor.BN(gameId))
        .accounts({
          gameSession: gameSessionPdaKey,
          playerBoard: board1Pda,
          player: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Player two creates their board (joins the game)
      await program.methods
        .initializePlayerBoard(new anchor.BN(gameId))
        .accounts({
          gameSession: gameSessionPdaKey,
          playerBoard: board2Pda,
          player: playerTwo.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([playerTwo])
        .rpc();

      const board1 = await program.account.playerBoard.fetch(board1Pda);
      const board2 = await program.account.playerBoard.fetch(board2Pda);

      expect(board1.player.toBase58()).to.equal(
        provider.wallet.publicKey.toBase58()
      );
      expect(board2.player.toBase58()).to.equal(playerTwo.publicKey.toBase58());
    });

    it("a third player cannot join a full game", async () => {
      const playerThree = Keypair.generate();
      await airdrop(connection, playerThree.publicKey);

      // Player two joins the game
      const [board2Pda] = playerBoardPda(
        programId,
        gameId,
        playerTwo.publicKey
      );
      await program.methods
        .initializePlayerBoard(new anchor.BN(gameId))
        .accounts({
          gameSession: gameSessionPdaKey,
          playerBoard: board2Pda,
          player: playerTwo.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([playerTwo])
        .rpc();

      // Player three attempts to join — should fail with GameFull
      const [board3Pda] = playerBoardPda(
        programId,
        gameId,
        playerThree.publicKey
      );
      try {
        await program.methods
          .initializePlayerBoard(new anchor.BN(gameId))
          .accounts({
            gameSession: gameSessionPdaKey,
            playerBoard: board3Pda,
            player: playerThree.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([playerThree])
          .rpc();
        expect.fail("Should have thrown GameFull error");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("GameFull");
        expect(err.error.errorCode.number).to.equal(ERROR_CODES.GameFull);
      }
    });

    it("a player cannot create two boards in the same game", async () => {
      const [boardPda] = playerBoardPda(
        programId,
        gameId,
        provider.wallet.publicKey
      );

      // First board creation succeeds
      await program.methods
        .initializePlayerBoard(new anchor.BN(gameId))
        .accounts({
          gameSession: gameSessionPdaKey,
          playerBoard: boardPda,
          player: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Second board creation should fail (PDA already exists)
      try {
        await program.methods
          .initializePlayerBoard(new anchor.BN(gameId))
          .accounts({
            gameSession: gameSessionPdaKey,
            playerBoard: boardPda,
            player: provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown — board PDA already exists");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });

    it("game session state remains Initialized after boards are created", async () => {
      const [board1Pda] = playerBoardPda(
        programId,
        gameId,
        provider.wallet.publicKey
      );
      const [board2Pda] = playerBoardPda(
        programId,
        gameId,
        playerTwo.publicKey
      );

      await program.methods
        .initializePlayerBoard(new anchor.BN(gameId))
        .accounts({
          gameSession: gameSessionPdaKey,
          playerBoard: board1Pda,
          player: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .initializePlayerBoard(new anchor.BN(gameId))
        .accounts({
          gameSession: gameSessionPdaKey,
          playerBoard: board2Pda,
          player: playerTwo.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([playerTwo])
        .rpc();

      // Game state should still be Initialized (ships not placed yet)
      const gameSession = await program.account.gameSession.fetch(
        gameSessionPdaKey
      );
      expect(gameSession.gameState).to.deep.equal({ initialized: {} });
    });
  });

  // ── IDL shape verification ──────────────────

  describe("IDL shape", () => {
    it("has initialize_game instruction in IDL", () => {
      // program.idl uses the raw JSON IDL which has snake_case names
      const idl = program.idl as any;
      const ix = idl.instructions.find(
        (i: any) => i.name === "initialize_game" || i.name === "initializeGame"
      );
      expect(ix).to.not.be.undefined;
      expect(ix.accounts.length).to.equal(3); // game_session, player_one, system_program
      expect(ix.args.length).to.equal(1); // game_id
    });

    it("has initialize_player_board instruction in IDL", () => {
      const idl = program.idl as any;
      const ix = idl.instructions.find(
        (i: any) =>
          i.name === "initialize_player_board" ||
          i.name === "initializePlayerBoard"
      );
      expect(ix).to.not.be.undefined;
      expect(ix.accounts.length).to.equal(4); // game_session, player_board, player, system_program
      expect(ix.args.length).to.equal(1); // game_id
    });

    it("has process_undelegation instruction injected by #[ephemeral]", () => {
      const idl = program.idl as any;
      const ix = idl.instructions.find(
        (i: any) =>
          i.name === "process_undelegation" || i.name === "processUndelegation"
      );
      expect(ix, "#[ephemeral] macro should inject process_undelegation").to.not
        .be.undefined;
    });

    it("IDL includes GameSession and PlayerBoard account types", () => {
      const idl = program.idl as any;
      const typeNames: string[] = idl.types.map((t: any) => t.name);
      // Check both snake_case (raw JSON) and PascalCase possibilities
      const hasGameSession =
        typeNames.includes("GameSession") || typeNames.includes("gameSession");
      const hasPlayerBoard =
        typeNames.includes("PlayerBoard") || typeNames.includes("playerBoard");
      const hasGameState =
        typeNames.includes("GameState") || typeNames.includes("gameState");

      expect(hasGameSession, "IDL should include GameSession type").to.be.true;
      expect(hasPlayerBoard, "IDL should include PlayerBoard type").to.be.true;
      expect(hasGameState, "IDL should include GameState type").to.be.true;
    });
  });
});
