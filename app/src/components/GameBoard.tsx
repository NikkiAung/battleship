import { type FC } from "react";
import { CellState, GRID_SIZE } from "../idl/battleship";
import "./GameBoard.css";

interface GameBoardProps {
  // on-chain cell_states u8[100]: 0=Unknown, 1=Miss, 2=Hit
  cellStates: number[];
  // local-only ship cells (own board only, never sent to chain)
  shipCells?: number[];
  onCellClick?: (index: number) => void;
  isOpponentBoard?: boolean;
  disabled?: boolean;
}

// 10x10 game board grid component
export const GameBoard: FC<GameBoardProps> = ({
  cellStates,
  shipCells = [],
  onCellClick,
  isOpponentBoard = false,
  disabled = false,
}) => {
  // get cell class based on state
  const getCellClass = (index: number): string => {
    const state = cellStates[index];
    const hasShip = shipCells.includes(index);
    const classes = ["cell"];

    // show ship positions only on own board
    if (!isOpponentBoard && hasShip && state === CellState.Unknown) {
      classes.push("ship");
    }

    if (state === CellState.Hit) {
      classes.push("hit");
    } else if (state === CellState.Miss) {
      classes.push("miss");
    }

    if (onCellClick && !disabled) {
      classes.push("clickable");
    }

    return classes.join(" ");
  };

  // handle cell click
  const handleCellClick = (index: number) => {
    if (disabled || !onCellClick) return;
    // only allow clicking on unknown cells (for attacks)
    if (cellStates[index] !== CellState.Unknown) return;
    onCellClick(index);
  };

  // render column headers (A-J)
  const renderColumnHeaders = () => {
    const headers = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      headers.push(
        <div key={`col-${i}`} className="header-cell">
          {String.fromCharCode(65 + i)}
        </div>
      );
    }
    return headers;
  };

  // render row headers (1-10)
  const renderRowHeader = (row: number) => (
    <div key={`row-header-${row}`} className="header-cell">
      {row + 1}
    </div>
  );

  // render grid cells
  const renderCells = () => {
    const rows = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      const rowCells = [renderRowHeader(row)];
      for (let col = 0; col < GRID_SIZE; col++) {
        const index = row * GRID_SIZE + col;
        rowCells.push(
          <div
            key={index}
            className={getCellClass(index)}
            onClick={() => handleCellClick(index)}
          />
        );
      }
      rows.push(
        <div key={`row-${row}`} className="board-row">
          {rowCells}
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="game-board">
      <div className="board-row header-row">
        <div className="header-cell corner" />
        {renderColumnHeaders()}
      </div>
      {renderCells()}
    </div>
  );
};
