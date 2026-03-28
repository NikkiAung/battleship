import { useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "../idl/battleship.json";
import {
  PROGRAM_ID,
  GAME_SESSION_SEED,
  PLAYER_BOARD_SEED,
} from "../idl/battleship";

// hook to get anchor program instance
export const useAnchorProgram = () => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    return new Program(idl as Idl, provider);
  }, [connection, wallet]);

  const programId = useMemo(() => new PublicKey(PROGRAM_ID), []);

  // derive game session pda
  const getGameSessionPda = (gameId: number[]) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(GAME_SESSION_SEED), Buffer.from(gameId)],
      programId
    );
  };

  // derive player board pda
  const getPlayerBoardPda = (gameId: number[], player: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(PLAYER_BOARD_SEED), Buffer.from(gameId), player.toBuffer()],
      programId
    );
  };

  return {
    program,
    programId,
    getGameSessionPda,
    getPlayerBoardPda,
  };
};
