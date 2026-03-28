import { useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, type Idl, BN } from "@coral-xyz/anchor";
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

  const programId = useMemo(() => new PublicKey(PROGRAM_ID), []);

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(idl as Idl, provider);
  }, [provider]);

  // derive game session pda from u64 game_id
  const getGameSessionPda = (gameId: BN) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(GAME_SESSION_SEED), gameId.toArrayLike(Buffer, "le", 8)],
      programId
    );
  };

  // derive player board pda from u64 game_id and player pubkey
  const getPlayerBoardPda = (gameId: BN, player: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(PLAYER_BOARD_SEED),
        gameId.toArrayLike(Buffer, "le", 8),
        player.toBuffer(),
      ],
      programId
    );
  };

  return {
    program,
    provider,
    programId,
    getGameSessionPda,
    getPlayerBoardPda,
  };
};
