import { useCallback, useEffect, useRef, useState } from "react";
import { BN, Program, type Idl } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useAnchorProgram } from "./useAnchorProgram";
import { useSolanaWallet } from "./useSolanaWallet";
import {
  type GameSession,
  type PlayerBoard,
  isGameState,
  BOARD_SIZE,
  CellState,
} from "../idl/battleship";
import {
  generateShipPlacements,
  encryptGridAsync,
  generateSecret,
  getShipCells,
  type ShipGrid,
} from "../helpers/shipGrid";
import {
  delegateGameSession,
  delegatePlayerBoard,
  commitAndUndelegateAll,
  createErProvider,
  getErConnection,
} from "../services/delegation";
import { clearTeeAuth } from "../services/tee";
import idl from "../idl/battleship.json";

export interface GameSessionState {
  gameId: BN | null;
  gameSession: GameSession | null;
  ownBoard: PlayerBoard | null;
  opponentBoard: PlayerBoard | null;
  shipGrid: ShipGrid | null;
  shipCells: number[];
  error: string | null;
  isLoading: boolean;
  isDelegated: boolean;
}

const RPC_OPTS = { skipPreflight: true, commitment: "confirmed" as const };

export const useGameSession = () => {
  const { program, provider, getGameSessionPda, getPlayerBoardPda } =
    useAnchorProgram();
  const { publicKey, isConnected, connection, signTransaction } =
    useSolanaWallet();

  const [state, setState] = useState<GameSessionState>({
    gameId: null,
    gameSession: null,
    ownBoard: null,
    opponentBoard: null,
    shipGrid: null,
    shipCells: [],
    error: null,
    isLoading: false,
    isDelegated: false,
  });

  const secretRef = useRef<Uint8Array | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const erProgramRef = useRef<Program<Idl> | null>(null);

  const patch = (p: Partial<GameSessionState>) =>
    setState((s) => ({ ...s, ...p }));

  // ---------- fetch helpers ----------

  const getActiveProgram = useCallback((): Program<Idl> | null => {
    if (state.isDelegated && erProgramRef.current) return erProgramRef.current;
    return program;
  }, [state.isDelegated, program]);

  const fetchGameSession = useCallback(
    async (gameId: BN): Promise<GameSession | null> => {
      const prog = getActiveProgram();
      if (!prog) return null;
      try {
        const [pda] = getGameSessionPda(gameId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (await (prog.account as any).gameSession.fetch(
          pda
        )) as GameSession;
      } catch {
        return null;
      }
    },
    [getActiveProgram, getGameSessionPda]
  );

  const fetchPlayerBoard = useCallback(
    async (gameId: BN, player: PublicKey): Promise<PlayerBoard | null> => {
      const prog = getActiveProgram();
      if (!prog) return null;
      try {
        const [pda] = getPlayerBoardPda(gameId, player);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (await (prog.account as any).playerBoard.fetch(
          pda
        )) as PlayerBoard;
      } catch {
        return null;
      }
    },
    [getActiveProgram, getPlayerBoardPda]
  );

  // ---------- polling ----------

  const startPolling = useCallback(
    (gameId: BN) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (!publicKey) return;
        const session = await fetchGameSession(gameId);
        if (!session) return;

        const opponentKey = session.playerOne.equals(publicKey)
          ? session.playerTwo
          : session.playerOne;

        const ownBoard = await fetchPlayerBoard(gameId, publicKey);
        const opponentBoard = opponentKey
          ? await fetchPlayerBoard(gameId, opponentKey)
          : null;

        patch({ gameSession: session, ownBoard, opponentBoard });
      }, 2000);
    },
    [publicKey, fetchGameSession, fetchPlayerBoard]
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ---------- er setup ----------

  const setupErProgram = useCallback(() => {
    if (!provider?.wallet) return;
    const erProvider = createErProvider(provider.wallet);
    erProgramRef.current = new Program(idl as Idl, erProvider);
  }, [provider]);

  // ---------- instructions ----------

  // 1. create game (L1)
  const initializeGame = useCallback(async (): Promise<BN> => {
    if (!program || !publicKey) throw new Error("wallet not connected");
    patch({ isLoading: true, error: null });

    try {
      const buf = new Uint8Array(8);
      crypto.getRandomValues(buf);
      const gameId = new BN(buf, "le");
      const [gameSessionPda] = getGameSessionPda(gameId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (program.methods as any)
        .initializeGame(gameId)
        .accounts({
          gameSession: gameSessionPda,
          playerOne: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc(RPC_OPTS);

      const session = await fetchGameSession(gameId);
      patch({ gameId, gameSession: session, isLoading: false });
      startPolling(gameId);
      return gameId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      patch({ error: msg, isLoading: false });
      throw err;
    }
  }, [program, publicKey, getGameSessionPda, fetchGameSession, startPolling]);

  // 2. join game (L1)
  const joinGame = useCallback(
    async (gameId: BN) => {
      if (!program || !publicKey) throw new Error("wallet not connected");
      patch({ isLoading: true, error: null });

      try {
        const [gameSessionPda] = getGameSessionPda(gameId);
        const [playerBoardPda] = getPlayerBoardPda(gameId, publicKey);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .initializePlayerBoard(gameId)
          .accounts({
            gameSession: gameSessionPda,
            playerBoard: playerBoardPda,
            player: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc(RPC_OPTS);

        const session = await fetchGameSession(gameId);
        const ownBoard = await fetchPlayerBoard(gameId, publicKey);
        patch({ gameId, gameSession: session, ownBoard, isLoading: false });
        startPolling(gameId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        patch({ error: msg, isLoading: false });
        throw err;
      }
    },
    [
      program,
      publicKey,
      getGameSessionPda,
      getPlayerBoardPda,
      fetchGameSession,
      fetchPlayerBoard,
      startPolling,
    ]
  );

  // 2b. create own board (L1)
  const initializePlayerBoard = useCallback(
    async (gameId: BN) => {
      if (!program || !publicKey) throw new Error("wallet not connected");
      patch({ isLoading: true, error: null });

      try {
        const [gameSessionPda] = getGameSessionPda(gameId);
        const [playerBoardPda] = getPlayerBoardPda(gameId, publicKey);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .initializePlayerBoard(gameId)
          .accounts({
            gameSession: gameSessionPda,
            playerBoard: playerBoardPda,
            player: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc(RPC_OPTS);

        const ownBoard = await fetchPlayerBoard(gameId, publicKey);
        patch({ ownBoard, isLoading: false });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        patch({ error: msg, isLoading: false });
        throw err;
      }
    },
    [program, publicKey, getGameSessionPda, getPlayerBoardPda, fetchPlayerBoard]
  );

  // 3. auto place ships (L1)
  const autoPlaceShips = useCallback(
    async (gameId: BN) => {
      if (!program || !publicKey) throw new Error("wallet not connected");
      patch({ isLoading: true, error: null });

      try {
        const grid = generateShipPlacements();
        const secret = generateSecret();
        secretRef.current = secret;

        const { encrypted, commitment } = await encryptGridAsync(grid, secret);
        const [playerBoardPda] = getPlayerBoardPda(gameId, publicKey);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .autoPlaceShips(
            gameId,
            Array.from(grid),
            Array.from(encrypted),
            Array.from(commitment)
          )
          .accounts({
            playerBoard: playerBoardPda,
            player: publicKey,
          })
          .rpc(RPC_OPTS);

        const cells = getShipCells(grid);
        const ownBoard = await fetchPlayerBoard(gameId, publicKey);
        patch({ shipGrid: grid, shipCells: cells, ownBoard, isLoading: false });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        patch({ error: msg, isLoading: false });
        throw err;
      }
    },
    [program, publicKey, getPlayerBoardPda, fetchPlayerBoard]
  );

  // 4. start game — transitions Initialized → InProgress (L1)
  const startGame = useCallback(
    async (gameId: BN) => {
      if (!program || !publicKey) throw new Error("wallet not connected");
      patch({ isLoading: true, error: null });

      try {
        const session = state.gameSession;
        if (!session?.playerTwo) throw new Error("no opponent yet");

        const [gameSessionPda] = getGameSessionPda(gameId);
        const [boardOnePda] = getPlayerBoardPda(gameId, session.playerOne);
        const [boardTwoPda] = getPlayerBoardPda(gameId, session.playerTwo);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .startGame(gameId)
          .accounts({
            gameSession: gameSessionPda,
            boardOne: boardOnePda,
            boardTwo: boardTwoPda,
          })
          .rpc(RPC_OPTS);

        const updated = await fetchGameSession(gameId);
        patch({ gameSession: updated, isLoading: false });

        // auto-delegate to ER after starting the game
        if (updated) {
          await doDelegation(gameId, updated);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        patch({ error: msg, isLoading: false });
        throw err;
      }
    },
    [
      program,
      publicKey,
      state.gameSession,
      getGameSessionPda,
      getPlayerBoardPda,
      fetchGameSession,
    ]
  );

  // internal delegation helper
  const doDelegation = async (gameId: BN, session: GameSession) => {
    if (!program || !publicKey || !signTransaction) return;

    try {
      await delegateGameSession(program, publicKey, gameId);

      if (session.playerTwo) {
        await delegatePlayerBoard(
          connection,
          publicKey,
          gameId,
          session.playerOne,
          signTransaction
        );
        await delegatePlayerBoard(
          connection,
          publicKey,
          gameId,
          session.playerTwo,
          signTransaction
        );
      }

      setupErProgram();
      patch({ isDelegated: true });
      console.log("delegation complete, gameplay now in ER");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("delegation failed:", msg);
      patch({ error: `delegation failed, playing on L1: ${msg}` });
    }
  };

  // 5. delegate game to ER (L1 → ER) — callable manually
  const delegateToER = useCallback(
    async (gameId: BN) => {
      if (!state.gameSession) throw new Error("no game session");
      patch({ isLoading: true, error: null });
      await doDelegation(gameId, state.gameSession);
      patch({ isLoading: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.gameSession]
  );

  // 6. process attack (ER if delegated, L1 fallback)
  // hit/miss is determined on-chain from ship_positions — no client trust needed
  const processAttack = useCallback(
    async (gameId: BN, cell: number) => {
      if (!publicKey) throw new Error("wallet not connected");
      const prog = getActiveProgram();
      if (!prog) throw new Error("no program");
      patch({ isLoading: true, error: null });

      try {
        const session = state.gameSession;
        if (!session) throw new Error("no active game session");

        const opponentKey = session.playerOne.equals(publicKey)
          ? session.playerTwo
          : session.playerOne;
        if (!opponentKey) throw new Error("no opponent");

        const [gameSessionPda] = getGameSessionPda(gameId);
        const [targetBoardPda] = getPlayerBoardPda(gameId, opponentKey);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prog.methods as any)
          .processAttack(gameId, cell)
          .accounts({
            gameSession: gameSessionPda,
            targetBoard: targetBoardPda,
            attacker: publicKey,
          })
          .rpc(RPC_OPTS);

        const updatedSession = await fetchGameSession(gameId);
        const opponentBoard = await fetchPlayerBoard(gameId, opponentKey);
        patch({ gameSession: updatedSession, opponentBoard, isLoading: false });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        patch({ error: msg, isLoading: false });
        throw err;
      }
    },
    [
      publicKey,
      getActiveProgram,
      state.gameSession,
      getGameSessionPda,
      getPlayerBoardPda,
      fetchGameSession,
      fetchPlayerBoard,
    ]
  );

  // 7. check winner (ER or L1)
  const checkWinner = useCallback(
    async (gameId: BN) => {
      if (!publicKey) return;
      const prog = getActiveProgram();
      if (!prog) return;

      try {
        const session = state.gameSession;
        if (!session) return;

        const opponentKey = session.playerOne.equals(publicKey)
          ? session.playerTwo
          : session.playerOne;
        if (!opponentKey) return;

        const [gameSessionPda] = getGameSessionPda(gameId);
        const [boardOnePda] = getPlayerBoardPda(gameId, session.playerOne);
        const [boardTwoPda] = getPlayerBoardPda(gameId, opponentKey);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prog.methods as any)
          .checkWinner(gameId)
          .accounts({
            gameSession: gameSessionPda,
            boardOne: boardOnePda,
            boardTwo: boardTwoPda,
          })
          .rpc(RPC_OPTS);

        const updated = await fetchGameSession(gameId);
        patch({ gameSession: updated });
      } catch (err) {
        console.warn("check_winner failed:", err);
      }
    },
    [
      publicKey,
      getActiveProgram,
      state.gameSession,
      getGameSessionPda,
      getPlayerBoardPda,
      fetchGameSession,
    ]
  );

  // 8. undelegate from ER (ER → L1)
  const undelegateFromER = useCallback(async () => {
    if (!publicKey || !signTransaction) throw new Error("wallet not connected");
    if (!state.gameId || !state.gameSession) throw new Error("no game");
    patch({ isLoading: true, error: null });

    try {
      const session = state.gameSession;
      const opponentKey = session.playerOne.equals(publicKey)
        ? session.playerTwo
        : session.playerOne;

      if (opponentKey) {
        const erConn = getErConnection();
        await commitAndUndelegateAll(
          erConn,
          publicKey,
          state.gameId,
          session.playerOne,
          opponentKey,
          signTransaction
        );
      }

      erProgramRef.current = null;
      patch({ isDelegated: false, isLoading: false });
      console.log("undelegation complete, state back on L1");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      patch({ error: msg, isLoading: false });
      throw err;
    }
  }, [publicKey, signTransaction, state.gameId, state.gameSession]);

  // 9. finalize game (L1)
  const finalizeGame = useCallback(
    async (gameId: BN) => {
      if (!program) throw new Error("wallet not connected");
      patch({ isLoading: true, error: null });

      try {
        const [gameSessionPda] = getGameSessionPda(gameId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .finalizeGame(gameId)
          .accounts({ gameSession: gameSessionPda })
          .rpc(RPC_OPTS);

        const session = await fetchGameSession(gameId);
        patch({ gameSession: session, isLoading: false });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        patch({ error: msg, isLoading: false });
        throw err;
      }
    },
    [program, getGameSessionPda, fetchGameSession]
  );

  // ---------- derived helpers ----------

  const gameStateIs = (variant: keyof typeof isGameState): boolean => {
    if (!state.gameSession) return false;
    return isGameState[variant](state.gameSession.gameState);
  };

  const isMyTurn = (): boolean => {
    if (!state.gameSession || !publicKey) return false;
    return state.gameSession.currentTurn.equals(publicKey);
  };

  const getWinner = (): string | null => {
    if (!state.gameSession?.winner) return null;
    return state.gameSession.winner.toBase58();
  };

  const amIWinner = (): boolean => {
    if (!state.gameSession?.winner || !publicKey) return false;
    return state.gameSession.winner.equals(publicKey);
  };

  const getOwnCellStates = (): number[] => {
    if (!state.ownBoard) return new Array(BOARD_SIZE).fill(CellState.Unknown);
    return Array.from(state.ownBoard.cellStates);
  };

  const getOpponentCellStates = (): number[] => {
    if (!state.opponentBoard)
      return new Array(BOARD_SIZE).fill(CellState.Unknown);
    return Array.from(state.opponentBoard.cellStates);
  };

  const getOpponentHitsReceived = (): number =>
    state.opponentBoard?.hitsReceived ?? 0;
  const getOwnHitsReceived = (): number => state.ownBoard?.hitsReceived ?? 0;

  const bothShipsPlaced = (): boolean =>
    (state.ownBoard?.shipsPlaced ?? false) &&
    (state.opponentBoard?.shipsPlaced ?? false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    secretRef.current = null;
    erProgramRef.current = null;
    clearTeeAuth();
    setState({
      gameId: null,
      gameSession: null,
      ownBoard: null,
      opponentBoard: null,
      shipGrid: null,
      shipCells: [],
      error: null,
      isLoading: false,
      isDelegated: false,
    });
  }, [stopPolling]);

  return {
    ...state,
    isConnected,
    publicKey,
    // instructions
    initializeGame,
    joinGame,
    initializePlayerBoard,
    autoPlaceShips,
    startGame,
    delegateToER,
    processAttack,
    checkWinner,
    undelegateFromER,
    finalizeGame,
    // derived
    gameStateIs,
    isMyTurn,
    getWinner,
    amIWinner,
    getOwnCellStates,
    getOpponentCellStates,
    getOpponentHitsReceived,
    getOwnHitsReceived,
    bothShipsPlaced,
    // control
    startPolling,
    stopPolling,
    reset,
  };
};
