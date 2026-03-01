"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import type {
  GameState,
  RunGame,
  RunChallenger,
  RunSelection,
  CreateRunResponse
} from "@/lib/types";
import { consumeWarmRun } from "@/lib/run-prefetch";

const MAX_ROUNDS = 10;
const REVEAL_DELAY_MS = 900;
const TRANSITION_DELAY_MS = 1100;
const SWAP_DELAY_MS = 500;
const HIGH_SCORE_KEY = "rankthegames_highscore";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type State = {
  phase: GameState;
  runId: string | null;
  signedRunToken: string | null;
  games: Record<string, RunGame>;
  challengerQueue: RunChallenger[];
  leftGame: RunGame | null;
  rightGame: RunGame | null;
  currentRound: number;
  streak: number;
  previousStreak: number;
  highScore: number;
  isNewHighScore: boolean;
  selections: RunSelection[];
  startedAt: number | null;
  error: string | null;
};

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: CreateRunResponse; highScore: number }
  | { type: "FETCH_SUCCESS_CONTINUE"; payload: CreateRunResponse; streak: number; highScore: number; previousStreak: number; isNewHighScore: boolean }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "SELECT_GAME"; gameId: string }
  | { type: "REVEAL_DONE"; wasCorrect: boolean }
  | { type: "TRANSITION_DONE" }
  | { type: "SWAP_DONE" }
  | { type: "PLAY_AGAIN" }
  | { type: "RESET_CONTINUE" };

function getInitialState(): State {
  return {
    phase: "LOADING",
    runId: null,
    signedRunToken: null,
    games: {},
    challengerQueue: [],
    leftGame: null,
    rightGame: null,
    currentRound: 0,
    streak: 0,
    previousStreak: 0,
    highScore: 0,
    isNewHighScore: false,
    selections: [],
    startedAt: null,
    error: null
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...getInitialState(), phase: "LOADING" };

    case "FETCH_SUCCESS": {
      const { payload, highScore } = action;
      const leftGame = payload.games[payload.initialPair.leftGameId] ?? null;
      const rightGame = payload.games[payload.initialPair.rightGameId] ?? null;

      return {
        ...getInitialState(),
        phase: "AWAITING_CHOICE",
        runId: payload.runId,
        signedRunToken: payload.signedRunToken,
        games: payload.games,
        challengerQueue: payload.challengerQueue,
        leftGame,
        rightGame,
        currentRound: 1,
        streak: 0,
        previousStreak: highScore,
        highScore,
        isNewHighScore: false,
        selections: [],
        startedAt: Date.now(),
        error: null
      };
    }

    case "FETCH_SUCCESS_CONTINUE": {
      const { payload } = action;
      const leftGame = payload.games[payload.initialPair.leftGameId] ?? null;
      const rightGame = payload.games[payload.initialPair.rightGameId] ?? null;

      return {
        ...getInitialState(),
        phase: "AWAITING_CHOICE",
        runId: payload.runId,
        signedRunToken: payload.signedRunToken,
        games: payload.games,
        challengerQueue: payload.challengerQueue,
        leftGame,
        rightGame,
        currentRound: 1,
        streak: action.streak,
        previousStreak: action.previousStreak,
        highScore: action.highScore,
        isNewHighScore: action.isNewHighScore,
        selections: [],
        startedAt: Date.now(),
        error: null
      };
    }

    case "FETCH_ERROR":
      return { ...state, phase: "LOADING", error: action.error };

    case "SELECT_GAME": {
      if (state.phase !== "AWAITING_CHOICE" || !state.leftGame || !state.rightGame) {
        return state;
      }

      const selection: RunSelection = {
        round: state.currentRound,
        pickedGameId: action.gameId,
        completedAt: new Date().toISOString()
      };

      return {
        ...state,
        phase: "REVEALING",
        selections: [...state.selections, selection]
      };
    }

    case "REVEAL_DONE": {
      if (state.phase !== "REVEALING") return state;

      if (action.wasCorrect) {
        const newStreak = state.streak + 1;
        const newHighScore = Math.max(state.highScore, newStreak);
        const isNewHighScore = newStreak > state.previousStreak;

        // If we just completed the max round correctly, trigger a reset
        if (state.currentRound >= MAX_ROUNDS) {
          return {
            ...state,
            phase: "RESETTING",
            streak: newStreak,
            highScore: newHighScore,
            isNewHighScore
          };
        }

        return {
          ...state,
          phase: "CORRECT",
          streak: newStreak,
          highScore: newHighScore,
          isNewHighScore
        };
      }

      return {
        ...state,
        phase: "INCORRECT"
      };
    }

    case "TRANSITION_DONE": {
      if (state.phase === "CORRECT") {
        return {
          ...state,
          phase: "TRANSITIONING"
        };
      }

      if (state.phase === "INCORRECT") {
        return {
          ...state,
          phase: "GAME_OVER"
        };
      }

      return state;
    }

    case "SWAP_DONE": {
      if (state.phase !== "TRANSITIONING") return state;

      // Winner-stays: picked game becomes left, next challenger becomes right
      const lastSelection = state.selections[state.selections.length - 1];
      if (!lastSelection) return state;

      const pickedGame = state.games[lastSelection.pickedGameId] ?? null;
      const nextChallenger = state.challengerQueue.find(
        (c) => c.round === state.currentRound + 1
      );
      const nextRightGame = nextChallenger
        ? state.games[nextChallenger.gameId] ?? null
        : null;

      return {
        ...state,
        phase: "AWAITING_CHOICE",
        leftGame: pickedGame,
        rightGame: nextRightGame,
        currentRound: state.currentRound + 1
      };
    }

    case "RESET_CONTINUE":
      return {
        ...getInitialState(),
        phase: "LOADING",
        streak: state.streak,
        previousStreak: state.previousStreak,
        highScore: state.highScore,
        isNewHighScore: state.isNewHighScore
      };

    case "PLAY_AGAIN":
      return { ...getInitialState(), phase: "LOADING" };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type UseGameReturn = {
  phase: GameState;
  leftGame: RunGame | null;
  rightGame: RunGame | null;
  currentRound: number;
  streak: number;
  previousStreak: number;
  highScore: number;
  isNewHighScore: boolean;
  error: string | null;
  selections: RunSelection[];
  runId: string | null;
  signedRunToken: string | null;
  startedAt: number | null;
  challengerQueue: RunChallenger[];
  games: Record<string, RunGame>;
  selectGame: (gameId: string) => void;
  playAgain: () => void;
  continueAfterReset: () => void;
};

export function useGame(): UseGameReturn {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const fetchRef = useRef(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRun = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    try {
      const data: CreateRunResponse = await consumeWarmRun();
      const stored = typeof window !== "undefined" ? localStorage.getItem(HIGH_SCORE_KEY) : null;
      const highScore = stored ? parseInt(stored, 10) || 0 : 0;
      dispatch({ type: "FETCH_SUCCESS", payload: data, highScore });
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to start game"
      });
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    if (!fetchRef.current) {
      fetchRef.current = true;
      fetchRun();
    }
  }, [fetchRun]);

  // Determine correctness for the current pick
  const isCorrectPick = useCallback(
    (gameId: string): boolean => {
      if (!state.leftGame || !state.rightGame) return false;
      if (state.leftGame.snapshotScore === state.rightGame.snapshotScore) return true;
      const correctId =
        state.leftGame.snapshotScore > state.rightGame.snapshotScore
          ? state.leftGame.id
          : state.rightGame.id;
      return gameId === correctId;
    },
    [state.leftGame, state.rightGame]
  );

  // Handle REVEALING → CORRECT/INCORRECT timeout
  useEffect(() => {
    if (state.phase === "REVEALING") {
      const lastSelection = state.selections[state.selections.length - 1];
      if (!lastSelection) return;
      const wasCorrect = isCorrectPick(lastSelection.pickedGameId);

      revealTimerRef.current = setTimeout(() => {
        dispatch({ type: "REVEAL_DONE", wasCorrect });
      }, REVEAL_DELAY_MS);

      return () => {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      };
    }
  }, [state.phase, state.selections, isCorrectPick]);

  // Handle CORRECT → TRANSITIONING, INCORRECT → GAME_OVER
  useEffect(() => {
    if (state.phase === "CORRECT" || state.phase === "INCORRECT") {
      transitionTimerRef.current = setTimeout(() => {
        dispatch({ type: "TRANSITION_DONE" });
      }, TRANSITION_DELAY_MS);

      return () => {
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      };
    }
  }, [state.phase]);

  // Handle TRANSITIONING → AWAITING_CHOICE (card swap animation window)
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.phase === "TRANSITIONING") {
      swapTimerRef.current = setTimeout(() => {
        dispatch({ type: "SWAP_DONE" });
      }, SWAP_DELAY_MS);

      return () => {
        if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
      };
    }
  }, [state.phase]);

  // Persist high score to localStorage
  useEffect(() => {
    if (state.highScore > 0 && typeof window !== "undefined") {
      localStorage.setItem(HIGH_SCORE_KEY, String(state.highScore));
    }
  }, [state.highScore]);

  const selectGame = useCallback(
    (gameId: string) => {
      if (state.phase !== "AWAITING_CHOICE") return;
      dispatch({ type: "SELECT_GAME", gameId });
    },
    [state.phase]
  );

  const continueAfterReset = useCallback(async () => {
    const carryStreak = state.streak;
    const carryHighScore = state.highScore;
    const carryPreviousStreak = state.previousStreak;
    const carryIsNewHighScore = state.isNewHighScore;

    dispatch({ type: "RESET_CONTINUE" });
    try {
      const data: CreateRunResponse = await consumeWarmRun();
      dispatch({
        type: "FETCH_SUCCESS_CONTINUE",
        payload: data,
        streak: carryStreak,
        highScore: carryHighScore,
        previousStreak: carryPreviousStreak,
        isNewHighScore: carryIsNewHighScore
      });
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to start game"
      });
    }
  }, [state.streak, state.highScore, state.previousStreak, state.isNewHighScore]);

  const playAgain = useCallback(() => {
    fetchRef.current = false;
    dispatch({ type: "PLAY_AGAIN" });
    fetchRef.current = true;
    fetchRun();
  }, [fetchRun]);

  return {
    phase: state.phase,
    leftGame: state.leftGame,
    rightGame: state.rightGame,
    currentRound: state.currentRound,
    streak: state.streak,
    previousStreak: state.previousStreak,
    highScore: state.highScore,
    isNewHighScore: state.isNewHighScore,
    error: state.error,
    selections: state.selections,
    runId: state.runId,
    signedRunToken: state.signedRunToken,
    startedAt: state.startedAt,
    challengerQueue: state.challengerQueue,
    games: state.games,
    selectGame,
    playAgain,
    continueAfterReset
  };
}
