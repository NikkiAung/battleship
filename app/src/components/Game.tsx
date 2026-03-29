import { type FC, useEffect, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { GameLobby } from "./GameLobby";
import { ShipPlacement } from "./ShipPlacement";
import { AttackPhase } from "./AttackPhase";
import { GameFinalization } from "./GameFinalization";
import { useGameSession } from "../hooks/useGameSession";
import "./Game.css";

type GamePhase = "lobby" | "placement" | "waiting" | "battle" | "finished";

export const Game: FC = () => {
  const gs = useGameSession();
  const [startError, setStartError] = useState<string | null>(null);

  const derivePhase = (): GamePhase => {
    if (!gs.gameId || !gs.gameSession) return "lobby";
    if (gs.gameStateIs("finished")) return "finished";
    if (gs.gameStateIs("inProgress")) return "battle";
    if (gs.bothShipsPlaced()) return "waiting";
    if (!gs.ownBoard?.shipsPlaced) return "placement";
    return "waiting";
  };

  const phase = derivePhase();

  // auto-check winner after each attack
  useEffect(() => {
    if (phase === "battle" && gs.gameId) {
      const ownHits = gs.getOwnHitsReceived();
      const oppHits = gs.getOpponentHitsReceived();
      if (ownHits >= 17 || oppHits >= 17) {
        gs.checkWinner(gs.gameId).catch(console.error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.ownBoard?.hitsReceived, gs.opponentBoard?.hitsReceived]);

  // auto-undelegate when game finishes
  useEffect(() => {
    if (phase === "finished" && gs.isDelegated && !gs.isLoading) {
      gs.undelegateFromER().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gs.isDelegated]);

  const handleCreateGame = async () => {
    try {
      const gameId = await gs.initializeGame();
      await gs.initializePlayerBoard(gameId);
    } catch (err) {
      console.error("create game failed:", err);
    }
  };

  const handleJoinGame = async (gameIdHex: string) => {
    try {
      const bytes = [];
      for (let i = 0; i < gameIdHex.length; i += 2) {
        bytes.push(parseInt(gameIdHex.slice(i, i + 2), 16));
      }
      const gameId = new BN(Buffer.from(bytes), "le");
      await gs.joinGame(gameId);
    } catch (err) {
      console.error("join game failed:", err);
    }
  };

  const handleAutoPlace = async () => {
    if (!gs.gameId) return;
    try {
      await gs.autoPlaceShips(gs.gameId);
    } catch (err) {
      console.error("auto place ships failed:", err);
    }
  };

  const handleReady = async () => {
    console.log("ships confirmed, waiting for opponent...");
  };

  // player one clicks this to start the game
  const handleStartGame = async () => {
    if (!gs.gameId) return;
    setStartError(null);
    try {
      await gs.startGame(gs.gameId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("start game failed:", msg, err);
      setStartError(msg);
    }
  };

  const handleAttack = async (cellIndex: number) => {
    if (!gs.gameId || !gs.isMyTurn()) return;
    try {
      await gs.processAttack(gs.gameId, cellIndex);
    } catch (err) {
      console.error("attack failed:", err);
    }
  };

  const handleFinalize = async () => {
    if (!gs.gameId) return;
    try {
      if (gs.isDelegated) {
        await gs.undelegateFromER();
      }
      await gs.finalizeGame(gs.gameId);
    } catch (err) {
      console.error("finalize failed:", err);
    }
  };

  const handleBackToLobby = () => {
    gs.reset();
    setStartError(null);
  };

  const gameIdHex = gs.gameId
    ? Buffer.from(gs.gameId.toArray("le", 8)).toString("hex")
    : null;

  const isPlayerOne =
    gs.publicKey && gs.gameSession?.playerOne
      ? gs.publicKey.equals(gs.gameSession.playerOne)
      : false;

  return (
    <div className="game">
      {phase === "lobby" && (
        <GameLobby
          isWalletConnected={gs.isConnected}
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          isLoading={gs.isLoading}
        />
      )}

      {phase === "placement" && (
        <ShipPlacement
          cellStates={gs.getOwnCellStates()}
          shipCells={gs.shipCells}
          onAutoPlace={handleAutoPlace}
          onReady={handleReady}
          isLoading={gs.isLoading}
          isReady={gs.ownBoard?.shipsPlaced ?? false}
        />
      )}

      {phase === "waiting" && (
        <div className="waiting-screen">
          <h2>
            {gs.bothShipsPlaced()
              ? "Both players ready!"
              : "Waiting for opponent..."}
          </h2>

          <p>Game ID (share with opponent):</p>
          <code className="game-id-code">{gameIdHex}</code>

          {gs.bothShipsPlaced() && isPlayerOne && (
            <div className="start-section">
              <button
                className="btn btn-primary"
                onClick={handleStartGame}
                disabled={gs.isLoading}
              >
                {gs.isLoading ? "Starting..." : "Start Game"}
              </button>
              {startError && <p className="error-text">{startError}</p>}
            </div>
          )}

          {gs.bothShipsPlaced() && !isPlayerOne && (
            <p className="ready-text">
              Waiting for player one to start the game...
            </p>
          )}

          {gs.isDelegated && (
            <p className="ready-text">Delegated to Ephemeral Rollup</p>
          )}
        </div>
      )}

      {phase === "battle" && (
        <AttackPhase
          ownCellStates={gs.getOwnCellStates()}
          ownShipCells={gs.shipCells}
          ownHitsReceived={gs.getOwnHitsReceived()}
          opponentCellStates={gs.getOpponentCellStates()}
          opponentHitsReceived={gs.getOpponentHitsReceived()}
          isMyTurn={gs.isMyTurn()}
          onAttack={handleAttack}
          isLoading={gs.isLoading}
        />
      )}

      {phase === "finished" && (
        <GameFinalization
          winner={gs.getWinner() ?? "Unknown"}
          isWinner={gs.amIWinner()}
          onPlayAgain={handleFinalize}
          onBackToLobby={handleBackToLobby}
        />
      )}

      {gs.error && (
        <div className="error-banner">
          <p>{gs.error}</p>
        </div>
      )}

      {gameIdHex && phase !== "lobby" && (
        <div className="game-id-display">
          Game ID: {gameIdHex}
          {gs.isDelegated && <span className="er-badge"> [ER]</span>}
        </div>
      )}
    </div>
  );
};
