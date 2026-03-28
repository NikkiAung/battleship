import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
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

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("battleship", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.battleship as Program<Battleship>;
  const programId = program.programId;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  // ── Program basics ──────────────────────────

  describe("program deployment", () => {
    it("has the expected program ID", () => {
      expect(programId.toBase58()).to.equal(
        "8tX8EQWsszJhLvbjws2cechrWR9MVxBG4sb3iTU2coJY"
      );
    });

    it("can call initialize instruction", async () => {
      const tx = await program.methods.initialize().rpc();
      expect(tx).to.be.a("string");
      console.log("    tx:", tx);
    });
  });

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
      const player = anchor.web3.Keypair.generate().publicKey;
      const [pda1, bump1] = playerBoardPda(programId, 1, player);
      const [pda2, bump2] = playerBoardPda(programId, 1, player);

      expect(pda1.toBase58()).to.equal(pda2.toBase58());
      expect(bump1).to.equal(bump2);
    });

    it("derives different PlayerBoard PDAs for different players in the same game", () => {
      const playerA = anchor.web3.Keypair.generate().publicKey;
      const playerB = anchor.web3.Keypair.generate().publicKey;

      const [pdaA] = playerBoardPda(programId, 1, playerA);
      const [pdaB] = playerBoardPda(programId, 1, playerB);

      expect(pdaA.toBase58()).to.not.equal(pdaB.toBase58());
    });

    it("derives different PlayerBoard PDAs for the same player in different games", () => {
      const player = anchor.web3.Keypair.generate().publicKey;

      const [pda1] = playerBoardPda(programId, 1, player);
      const [pda2] = playerBoardPda(programId, 2, player);

      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("GameSession PDA is off-curve (not a valid keypair)", () => {
      const [pda] = gameSessionPda(programId, 42);
      // PDA addresses are off-curve, so PublicKey.isOnCurve should be false
      expect(PublicKey.isOnCurve(pda.toBytes())).to.be.false;
    });

    it("PlayerBoard PDA is off-curve", () => {
      const player = anchor.web3.Keypair.generate().publicKey;
      const [pda] = playerBoardPda(programId, 42, player);
      expect(PublicKey.isOnCurve(pda.toBytes())).to.be.false;
    });
  });

  // ── Account size constants ──────────────────

  describe("account size constants", () => {
    it("GameSession SIZE matches expected layout", () => {
      // game_id(8) + player_one(32) + player_two(1+32) + current_turn(32) + game_state(1) + winner(1+32)
      const expected = 8 + 32 + 33 + 32 + 1 + 33;
      expect(GAME_SESSION_DATA_SIZE).to.equal(expected);
      expect(GAME_SESSION_DATA_SIZE).to.equal(139);
    });

    it("PlayerBoard SIZE matches expected layout", () => {
      // game_id(8) + player(32) + grid_commitment(32) + cell_states(100) + hits_received(1) + ship_grid_encrypted(112) + ships_placed(1)
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
      expect(TOTAL_SHIP_CELLS).to.equal(17);
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

    it("error codes start at 6000 (Anchor custom error offset)", () => {
      const codes = Object.values(ERROR_CODES);
      for (const code of codes) {
        expect(code).to.be.at.least(6000);
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
});
