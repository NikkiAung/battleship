import { type FC } from "react";
import { GameBoard } from "./GameBoard";
import { type CellState, TOTAL_SHIP_CELLS } from "../idl/battleship";
import "./AttackPhase.css";

interface AttackPhaseProps {
  // own board state
  ownCellStates: CellState[];
  ownShipPositions: number[];
  ownHitsReceived: number;
  // opponent board state
  opponentCellStates: CellState[];
  opponentHitsReceived: number;
  // game state
  isMyTurn: boolean;
  onAttack: (index: number) => void;
  isLoading: boolean;
}

// attack phase ui - shows both boards
export const AttackPhase: FC<AttackPhaseProps> = ({
  ownCellStates,
  ownShipPositions,
  ownHitsReceived,
  opponentCellStates,
  opponentHitsReceived,
  isMyTurn,
  onAttack,
  isLoading,
}) => {
  return (
    <div className="attack-phase">
      <div className="turn-indicator">
        {isMyTurn ? (
          <span className="your-turn">Your Turn - Fire!</span>
        ) : (
          <span className="opponent-turn">Opponent's Turn...</span>
        )}
      </div>

      <div className="boards-container">
        <div className="board-section">
          <h3>Your Fleet</h3>
          <p className="hits-counter">
            Hits received: {ownHitsReceived} / {TOTAL_SHIP_CELLS}
          </p>
          <GameBoard
            cellStates={ownCellStates}
            shipPositions={ownShipPositions}
            disabled
          />
        </div>

        <div className="board-section">
          <h3>Enemy Waters</h3>
          <p className="hits-counter">
            Hits landed: {opponentHitsReceived} / {TOTAL_SHIP_CELLS}
          </p>
          <GameBoard
            cellStates={opponentCellStates}
            onCellClick={isMyTurn && !isLoading ? onAttack : undefined}
            isOpponentBoard
            disabled={!isMyTurn || isLoading}
          />
        </div>
      </div>

      {isLoading && <p className="loading-text">Processing attack...</p>}
    </div>
  );
};
