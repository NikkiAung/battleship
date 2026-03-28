// er delegation lifecycle manager
// handles delegate → gameplay in ER → commit+undelegate back to L1

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, type Program, type Idl, BN } from "@coral-xyz/anchor";
import {
  createDelegateInstruction,
  createCommitAndUndelegateInstruction,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  PROGRAM_ID,
  GAME_SESSION_SEED,
  PLAYER_BOARD_SEED,
} from "../idl/battleship";

// magicblock er endpoint for devnet
const ER_ENDPOINT = "https://devnet.magicblock.app";

const programId = new PublicKey(PROGRAM_ID);

// get the ER connection for sending gameplay txs directly
export function getErConnection(): Connection {
  return new Connection(ER_ENDPOINT, "confirmed");
}

// create an AnchorProvider pointed at the ER endpoint
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createErProvider(wallet: any): AnchorProvider {
  const erConnection = getErConnection();
  return new AnchorProvider(erConnection, wallet, {
    commitment: "confirmed",
    skipPreflight: true,
  });
}

// derive pda helpers
function gameSessionPda(gameId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GAME_SESSION_SEED), gameId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

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

// delegate the game_session account to the ER validator
// uses the anchor program's delegate_to_er instruction which has #[delegate] macro
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

  console.log("game_session delegated to ER, sig:", sig);
  return sig;
}

// delegate a player_board account to ER using raw SDK instruction
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

  console.log("player_board delegated to ER, sig:", sig);
  return sig;
}

// commit and undelegate all accounts back to L1
export async function commitAndUndelegateAll(
  erConnection: Connection,
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
  const { blockhash } = await erConnection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;

  const signed = await signTransaction(tx);
  const sig = await erConnection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
  });

  console.log("commit+undelegate sent, sig:", sig);
  return sig;
}
