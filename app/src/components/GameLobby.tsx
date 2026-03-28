import { type FC, useState } from "react";
import { WalletConnectButton } from "./WalletConnectButton";
import "./GameLobby.css";

interface GameLobbyProps {
  isWalletConnected: boolean;
  onCreateGame: () => void;
  onJoinGame: (gameId: string) => void;
  isLoading: boolean;
}

// game lobby ui - create or join game
export const GameLobby: FC<GameLobbyProps> = ({
  isWalletConnected,
  onCreateGame,
  onJoinGame,
  isLoading,
}) => {
  const [gameIdInput, setGameIdInput] = useState("");

  const handleJoinGame = () => {
    if (gameIdInput.trim()) {
      onJoinGame(gameIdInput.trim());
    }
  };

  return (
    <div className="game-lobby">
      <h1>Battleship</h1>
      <p className="subtitle">
        On-chain PvP powered by MagicBlock Ephemeral Rollups
      </p>

      <div className="wallet-section">
        <WalletConnectButton />
      </div>

      {isWalletConnected ? (
        <div className="lobby-actions">
          <div className="action-section">
            <h3>Create New Game</h3>
            <button
              className="btn btn-primary"
              onClick={onCreateGame}
              disabled={isLoading}
            >
              {isLoading ? "Creating..." : "Create Game"}
            </button>
          </div>

          <div className="divider">or</div>

          <div className="action-section">
            <h3>Join Existing Game</h3>
            <input
              type="text"
              className="game-id-input"
              placeholder="Enter Game ID"
              value={gameIdInput}
              onChange={(e) => setGameIdInput(e.target.value)}
              disabled={isLoading}
            />
            <button
              className="btn btn-secondary"
              onClick={handleJoinGame}
              disabled={isLoading || !gameIdInput.trim()}
            >
              {isLoading ? "Joining..." : "Join Game"}
            </button>
          </div>
        </div>
      ) : (
        <p className="connect-prompt">Connect your wallet to play</p>
      )}
    </div>
  );
};
