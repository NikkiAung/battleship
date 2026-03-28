import { type FC } from "react";
import {
  WalletMultiButton,
  WalletDisconnectButton,
} from "@solana/wallet-adapter-react-ui";
import { useSolanaWallet } from "../hooks/useSolanaWallet";
import "./WalletConnectButton.css";

// wallet connect button with balance display
export const WalletConnectButton: FC = () => {
  const { isConnected, truncatedAddress } = useSolanaWallet();

  return (
    <div className="wallet-container">
      {isConnected ? (
        <div className="wallet-connected">
          <span className="wallet-address">{truncatedAddress}</span>
          <WalletDisconnectButton />
        </div>
      ) : (
        <WalletMultiButton />
      )}
    </div>
  );
};
