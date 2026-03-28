import { type FC } from "react";
import { GameBoard } from "./GameBoard";
import {
  type CellState,
  SHIP_SIZES,
  TOTAL_SHIP_CELLS,
} from "../idl/battleship";
import "./ShipPlacement.css";

interface ShipPlacementProps {
  cellStates: CellState[];
  shipPositions: number[];
  onAutoPlace: () => void;
  onReady: () => void;
  isLoading: boolean;
  isReady: boolean;
}

// ship placement phase ui
export const ShipPlacement: FC<ShipPlacementProps> = ({
  cellStates,
  shipPositions,
  onAutoPlace,
  onReady,
  isLoading,
  isReady,
}) => {
  const placedShipsCount = shipPositions.length;
  const allShipsPlaced = placedShipsCount === TOTAL_SHIP_CELLS;

  return (
    <div className="ship-placement">
      <h2>Place Your Ships</h2>

      <div className="ship-info">
        <p>Ships to place:</p>
        <ul className="ship-list">
          {SHIP_SIZES.map((size, i) => (
            <li key={i}>
              {size === 5 && "Carrier (5)"}
              {size === 4 && "Battleship (4)"}
              {size === 3 && i === 2 && "Cruiser (3)"}
              {size === 3 && i === 3 && "Submarine (3)"}
              {size === 2 && "Destroyer (2)"}
            </li>
          ))}
        </ul>
        <p className="placed-count">
          Cells placed: {placedShipsCount} / {TOTAL_SHIP_CELLS}
        </p>
      </div>

      <GameBoard
        cellStates={cellStates}
        shipPositions={shipPositions}
        disabled
      />

      <div className="placement-actions">
        <button
          className="btn btn-secondary"
          onClick={onAutoPlace}
          disabled={isLoading || isReady}
        >
          {isLoading ? "Placing..." : "Auto-Place Ships"}
        </button>

        <button
          className="btn btn-primary"
          onClick={onReady}
          disabled={!allShipsPlaced || isLoading || isReady}
        >
          {isReady ? "Ready!" : "Confirm Placement"}
        </button>
      </div>
    </div>
  );
};
