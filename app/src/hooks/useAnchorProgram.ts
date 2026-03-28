import { useMemo } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, type Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { ConnectionMagicRouter } from "@magicblock-labs/ephemeral-rollups-sdk";
import idl from "../idl/battleship.json";
import {
  PROGRAM_ID,
  GAME_SESSION_SEED,
  PLAYER_BOARD_SEED,
} from "../idl/battleship";

// magicblock er endpoint
const ER_ENDPOINT = "https://devnet.magicblock.app";

export const useAnchorProgram = () => {
  const wallet = useAnchorWallet();

  const programId = useMemo(() => new PublicKey(PROGRAM_ID), []);

  // standard L1 connection for init/placement (accounts don't exist yet)
  const l1Connection = useMemo(
    () => new Connection(clusterApiUrl("devnet"), "confirmed"),
    []
  );

  // magic router for gameplay txs (auto-routes L1/ER based on delegation)
  const magicConnection = useMemo(
    () => new ConnectionMagicRouter(ER_ENDPOINT, { commitment: "confirmed" }),
    []
  );

  // L1 provider + program for init operations
  const l1Provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(l1Connection, wallet, {
      commitment: "confirmed",
      skipPreflight: true,
    });
  }, [l1Connection, wallet]);

  const l1Program = useMemo(() => {
    if (!l1Provider) return null;
    return new Program(idl as Idl, l1Provider);
  }, [l1Provider]);

  // magic router provider + program for gameplay (after delegation)
  const erProvider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(magicConnection, wallet, {
      commitment: "confirmed",
      skipPreflight: true,
    });
  }, [magicConnection, wallet]);

  const erProgram = useMemo(() => {
    if (!erProvider) return null;
    return new Program(idl as Idl, erProvider);
  }, [erProvider]);

  const getGameSessionPda = (gameId: BN) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(GAME_SESSION_SEED), gameId.toArrayLike(Buffer, "le", 8)],
      programId
    );
  };

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
    l1Program, // for init, placement, startGame, finalize (L1 ops)
    erProgram, // for processAttack, checkWinner (routed via MagicRouter)
    l1Connection, // raw L1 connection for delegation txs
    magicConnection, // for commit+undelegate
    programId,
    getGameSessionPda,
    getPlayerBoardPda,
  };
};
