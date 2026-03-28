import { type FC, useState } from "react";
import { GameLobby } from "./GameLobby";
import { ShipPlacement } from "./ShipPlacement";
import { AttackPhase } from "./AttackPhase";
import { GameFinalization } from "./GameFinalization";
import { useSolanaWallet } from "../hooks/useSolanaWallet";
import { CellState, GameState, GRID_SIZE } from "../idl/battleship";
import "./Game.css";

// game phases
type GamePhase = "lobby" | "placement" | "battle" | "finished";

// main game component - orchestrates all phases
export const Game: FC = () => {
  const { isConnected, publicKey } = useSolanaWallet();

  // game state
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [isLoading, setIsLoading] = useState(false);
  const [gameId, setGameId] = useState<number[] | null>(null);

  // player state
  const [ownCellStates, setOwnCellStates] = useState<CellState[]>(
    Array(GRID_SIZE * GRID_SIZE).fill(CellState.Empty)
  );
  const [ownShipPositions, setOwnShipPositions] = useState<number[]>([]);
  const [ownHitsReceived, setOwnHitsReceived] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // opponent state
  const [opponentCellStates, setOpponentCellStates] = useState<CellState[]>(
    Array(GRID_SIZE * GRID_SIZE).fill(CellState.Empty)
  );
  const [opponentHitsReceived, setOpponentHitsReceived] = useState(0);

  // turn state
  const [isMyTurn, setIsMyTurn] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_gameState, setGameState] = useState<GameState>(
    GameState.WaitingForPlayers
  );
  const [winner, setWinner] = useState<string | null>(null);

  // generate random game id (8 bytes)
  const generateGameId = (): number[] => {
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    return Array.from(arr);
  };

  // create a new game
  const handleCreateGame = async () => {
    setIsLoading(true);
    try {
      const newGameId = generateGameId();
      setGameId(newGameId);
      // todo: call initialize_game instruction
      console.log("Creating game with id:", newGameId);
      setPhase("placement");
    } catch (err) {
      console.error("Failed to create game:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // join an existing game
  const handleJoinGame = async (gameIdStr: string) => {
    setIsLoading(true);
    try {
      // parse game id from hex string
      const parsed =
        gameIdStr.match(/.{1,2}/g)?.map((x) => parseInt(x, 16)) ?? [];
      if (parsed.length !== 8) {
        throw new Error("Invalid game ID format");
      }
      setGameId(parsed);
      // todo: call initialize_player_board instruction
      console.log("Joining game:", parsed);
      setPhase("placement");
    } catch (err) {
      console.error("Failed to join game:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // auto-place ships (calls program)
  const handleAutoPlace = async () => {
    setIsLoading(true);
    try {
      // todo: call auto_place_ships instruction
      // for now, mock random placement
      const positions: number[] = [];
      const shipSizes = [5, 4, 3, 3, 2];

      for (const size of shipSizes) {
        let placed = false;
        while (!placed) {
          const horizontal = Math.random() > 0.5;
          const maxRow = horizontal ? GRID_SIZE : GRID_SIZE - size;
          const maxCol = horizontal ? GRID_SIZE - size : GRID_SIZE;
          const row = Math.floor(Math.random() * maxRow);
          const col = Math.floor(Math.random() * maxCol);

          const shipCells: number[] = [];
          for (let i = 0; i < size; i++) {
            const idx = horizontal
              ? row * GRID_SIZE + col + i
              : (row + i) * GRID_SIZE + col;
            shipCells.push(idx);
          }

          // check no overlap
          if (!shipCells.some((c) => positions.includes(c))) {
            positions.push(...shipCells);
            placed = true;
          }
        }
      }

      setOwnShipPositions(positions);

      // update cell states to show ships
      const newCellStates = Array(GRID_SIZE * GRID_SIZE).fill(CellState.Empty);
      positions.forEach((idx) => {
        newCellStates[idx] = CellState.Ship;
      });
      setOwnCellStates(newCellStates);

      console.log("Ships placed at:", positions);
    } catch (err) {
      console.error("Failed to place ships:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // confirm ship placement
  const handleReady = async () => {
    setIsLoading(true);
    try {
      // todo: set ready flag on chain
      setIsReady(true);
      // todo: wait for opponent ready, then start battle
      // for now, auto-start battle
      setGameState(GameState.InProgress);
      setIsMyTurn(true);
      setPhase("battle");
    } catch (err) {
      console.error("Failed to confirm placement:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // process attack
  const handleAttack = async (index: number) => {
    if (!isMyTurn || isLoading) return;

    setIsLoading(true);
    try {
      // todo: call process_attack instruction
      // mock: random hit/miss
      const isHit = Math.random() > 0.5;
      const newOpponentCells = [...opponentCellStates];
      newOpponentCells[index] = isHit ? CellState.Hit : CellState.Miss;
      setOpponentCellStates(newOpponentCells);

      if (isHit) {
        const newHits = opponentHitsReceived + 1;
        setOpponentHitsReceived(newHits);

        // check winner (17 hits = all ships sunk)
        if (newHits >= 17) {
          setWinner(publicKey?.toBase58() ?? "Unknown");
          setGameState(GameState.Finished);
          setPhase("finished");
          return;
        }
      }

      // switch turns
      setIsMyTurn(false);

      // simulate opponent turn after delay
      setTimeout(() => {
        const availableCells = ownCellStates
          .map((s, i) => (s !== CellState.Hit && s !== CellState.Miss ? i : -1))
          .filter((i) => i !== -1);
        const targetIdx =
          availableCells[Math.floor(Math.random() * availableCells.length)];

        const isOwnHit = ownShipPositions.includes(targetIdx);
        const newOwnCells = [...ownCellStates];
        newOwnCells[targetIdx] = isOwnHit ? CellState.Hit : CellState.Miss;
        setOwnCellStates(newOwnCells);

        if (isOwnHit) {
          const newOwnHits = ownHitsReceived + 1;
          setOwnHitsReceived(newOwnHits);

          if (newOwnHits >= 17) {
            setWinner("Opponent");
            setGameState(GameState.Finished);
            setPhase("finished");
            return;
          }
        }

        setIsMyTurn(true);
      }, 1000);
    } catch (err) {
      console.error("Failed to process attack:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // reset game
  const handlePlayAgain = () => {
    setPhase("placement");
    setOwnCellStates(Array(GRID_SIZE * GRID_SIZE).fill(CellState.Empty));
    setOwnShipPositions([]);
    setOwnHitsReceived(0);
    setIsReady(false);
    setOpponentCellStates(Array(GRID_SIZE * GRID_SIZE).fill(CellState.Empty));
    setOpponentHitsReceived(0);
    setIsMyTurn(false);
    setWinner(null);
  };

  const handleBackToLobby = () => {
    handlePlayAgain();
    setGameId(null);
    setPhase("lobby");
  };

  return (
    <div className="game">
      {phase === "lobby" && (
        <GameLobby
          isWalletConnected={isConnected}
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          isLoading={isLoading}
        />
      )}

      {phase === "placement" && (
        <ShipPlacement
          cellStates={ownCellStates}
          shipPositions={ownShipPositions}
          onAutoPlace={handleAutoPlace}
          onReady={handleReady}
          isLoading={isLoading}
          isReady={isReady}
        />
      )}

      {phase === "battle" && (
        <AttackPhase
          ownCellStates={ownCellStates}
          ownShipPositions={ownShipPositions}
          ownHitsReceived={ownHitsReceived}
          opponentCellStates={opponentCellStates}
          opponentHitsReceived={opponentHitsReceived}
          isMyTurn={isMyTurn}
          onAttack={handleAttack}
          isLoading={isLoading}
        />
      )}

      {phase === "finished" && winner && (
        <GameFinalization
          winner={winner}
          isWinner={winner === publicKey?.toBase58()}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={handleBackToLobby}
        />
      )}

      {gameId && phase !== "lobby" && (
        <div className="game-id-display">
          Game ID: {gameId.map((b) => b.toString(16).padStart(2, "0")).join("")}
        </div>
      )}
    </div>
  );
};
