// er delegation — delegate accounts to ER, commit+undelegate back to L1

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { type Program, type Idl, BN } from "@coral-xyz/anchor";
import {
  createDelegateInstruction,
  createCommitAndUndelegateInstruction,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  PROGRAM_ID,
  GAME_SESSION_SEED,
  PLAYER_BOARD_SEED,
} from "../idl/battleship";

const programId = new PublicKey(PROGRAM_ID);

function playerBoardPda(gameId: BN, player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PLAYER_BOARD_SEED),
      gameId.toArrayLike(Buffer, "le", 8),
      player.toBuffer(),
    ],
    programId
  );
}

function gameSessionPda(gameId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GAME_SESSION_SEED), gameId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

// delegate game_session via anchor program's #[delegate] instruction
export async function delegateGameSession(
  program: Program<Idl>,
  payer: PublicKey,
  gameId: BN
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sig = await (program.methods as any)
    .delegateToEr(gameId)
    .accounts({ payer })
    .rpc({ skipPreflight: true });

  console.log("game_session delegated, sig:", sig);
  return sig;
}

// delegate a player_board via raw SDK instruction
export async function delegatePlayerBoard(
  connection: Connection,
  payer: PublicKey,
  gameId: BN,
  player: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const [boardKey] = playerBoardPda(gameId, player);

  const ix = createDelegateInstruction({
    payer,
    delegatedAccount: boardKey,
    ownerProgram: programId,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = payer;
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;

  const signed = await signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
  });
  await connection.confirmTransaction(sig, "confirmed");

  console.log("player_board delegated, sig:", sig);
  return sig;
}

// commit final state and undelegate all accounts back to L1
export async function commitAndUndelegateAll(
  connection: Connection,
  payer: PublicKey,
  gameId: BN,
  playerOne: PublicKey,
  playerTwo: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const [gameSessionKey] = gameSessionPda(gameId);
  const [boardOneKey] = playerBoardPda(gameId, playerOne);
  const [boardTwoKey] = playerBoardPda(gameId, playerTwo);

  const ix = createCommitAndUndelegateInstruction(payer, [
    gameSessionKey,
    boardOneKey,
    boardTwoKey,
  ]);

  const tx = new Transaction().add(ix);
  tx.feePayer = payer;
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;

  const signed = await signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
  });

  console.log("commit+undelegate sent, sig:", sig);
  return sig;
}
