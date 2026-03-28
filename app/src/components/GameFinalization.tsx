import { type FC } from "react";
import "./GameFinalization.css";

interface GameFinalizationProps {
  winner: string; // pubkey of winner
  isWinner: boolean;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

// game over screen
export const GameFinalization: FC<GameFinalizationProps> = ({
  winner,
  isWinner,
  onPlayAgain,
  onBackToLobby,
}) => {
  return (
    <div className="game-finalization">
      <div className="result-banner">
        {isWinner ? (
          <h1 className="victory">Victory!</h1>
        ) : (
          <h1 className="defeat">Defeat</h1>
        )}
      </div>

      <div className="winner-info">
        <p>Winner:</p>
        <code className="winner-address">{winner}</code>
      </div>

      <div className="finalization-actions">
        <button className="btn btn-primary" onClick={onPlayAgain}>
          Play Again
        </button>
        <button className="btn btn-secondary" onClick={onBackToLobby}>
          Back to Lobby
        </button>
      </div>
    </div>
  );
};
