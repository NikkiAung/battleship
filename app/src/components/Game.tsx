import { type FC, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { GameLobby } from "./GameLobby";
import { ShipPlacement } from "./ShipPlacement";
import { AttackPhase } from "./AttackPhase";
import { GameFinalization } from "./GameFinalization";
import { useGameSession } from "../hooks/useGameSession";
import "./Game.css";

// game phases (ui state machine)
type GamePhase = "lobby" | "placement" | "waiting" | "battle" | "finished";

// main game component — orchestrates all phases
export const Game: FC = () => {
  const gs = useGameSession();

  // ---- derive ui phase from on-chain state ----
  const derivePhase = (): GamePhase => {
    if (!gs.gameId || !gs.gameSession) return "lobby";
    if (gs.gameStateIs("finished")) return "finished";
    if (gs.gameStateIs("inProgress")) return "battle";
    if (gs.bothShipsPlaced()) return "waiting";
    if (!gs.ownBoard?.shipsPlaced) return "placement";
    return "waiting";
  };

  const phase = derivePhase();

  // ---- tee auth on wallet connect ----
  useEffect(() => {
    if (gs.isConnected && !gs.teeAuthenticated) {
      gs.authenticateTee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.isConnected]);

  // ---- auto-delegate when both players have placed ships ----
  useEffect(() => {
    if (
      phase === "waiting" &&
      gs.bothShipsPlaced() &&
      gs.gameId &&
      gs.gameStateIs("initialized") &&
      !gs.isDelegated &&
      !gs.isLoading &&
      gs.publicKey &&
      gs.gameSession?.playerOne.equals(gs.publicKey)
    ) {
      // game creator triggers delegation
      gs.delegateToER(gs.gameId).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    gs.gameSession,
    gs.ownBoard?.shipsPlaced,
    gs.opponentBoard?.shipsPlaced,
  ]);

  // ---- auto-check winner after each attack ----
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

  // ---- auto-undelegate when game finishes ----
  useEffect(() => {
    if (phase === "finished" && gs.isDelegated && !gs.isLoading) {
      gs.undelegateFromER().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gs.isDelegated]);

  // ---- handlers ----

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
    // ships are already on-chain from autoPlaceShips
    // delegation happens automatically in the effect above
    console.log("ships confirmed, waiting for opponent...");
  };

  const handleAttack = async (cellIndex: number) => {
    if (!gs.gameId || !gs.isMyTurn()) return;
    try {
      // in ER with TEE, the hit/miss is determined by the TEE validator
      // which has access to the encrypted ship grid
      // for now we pass false; the program records it accordingly
      await gs.processAttack(gs.gameId, cellIndex, false);
    } catch (err) {
      console.error("attack failed:", err);
    }
  };

  const handleFinalize = async () => {
    if (!gs.gameId) return;
    try {
      // undelegate if still in ER
      if (gs.isDelegated) {
        await gs.undelegateFromER();
      }
      await gs.finalizeGame(gs.gameId);
      // try to reveal opponent grid from TEE
      const revealed = await gs.revealOpponentGrid();
      if (revealed) {
        console.log("opponent grid revealed from TEE:", revealed);
      }
    } catch (err) {
      console.error("finalize failed:", err);
    }
  };

  const handleBackToLobby = () => {
    gs.reset();
  };

  // game id hex for display
  const gameIdHex = gs.gameId
    ? Buffer.from(gs.gameId.toArray("le", 8)).toString("hex")
    : null;

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
          <h2>Waiting for opponent...</h2>
          <p>Share this Game ID with your opponent:</p>
          <code className="game-id-code">{gameIdHex}</code>
          {gs.bothShipsPlaced() && !gs.isDelegated && (
            <p className="ready-text">
              Both players ready! Delegating to ER...
            </p>
          )}
          {gs.isDelegated && (
            <p className="ready-text">
              Delegated to Ephemeral Rollup! Starting game...
            </p>
          )}
          {gs.teeAuthenticated && <p className="tee-badge">TEE Verified</p>}
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
