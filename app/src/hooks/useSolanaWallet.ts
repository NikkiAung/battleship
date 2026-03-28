import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useMemo } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// hook for wallet operations
export const useSolanaWallet = () => {
  const { connection } = useConnection();
  const wallet = useWallet();

  // get wallet balance in sol
  const getBalance = useCallback(async () => {
    if (!wallet.publicKey) return null;
    const balance = await connection.getBalance(wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }, [connection, wallet.publicKey]);

  // check if wallet is connected
  const isConnected = useMemo(() => wallet.connected, [wallet.connected]);

  // get truncated address for display
  const truncatedAddress = useMemo(() => {
    if (!wallet.publicKey) return null;
    const address = wallet.publicKey.toBase58();
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }, [wallet.publicKey]);

  return {
    ...wallet,
    connection,
    getBalance,
    isConnected,
    truncatedAddress,
  };
};
