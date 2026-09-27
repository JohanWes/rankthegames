"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import type {
  GameState,
  RunGame,
  RunPair,
  RunSelection,
  CreateRunResponse
} from "@/lib/types";
import {
  getBracketRoundPair,
  isCorrectPick,
  MAX_TOURNAMENT_ROUNDS,
  shouldShowStageIntro
} from "@/lib/bracket";
import { consumeWarmRun, preloadCover, takeWarmRunIfReady } from "@/lib/run-prefetch";

const REVEAL_DELAY_MS = 400;
const TRANSITION_DELAY_MS = 700;
const SWAP_DELAY_MS = 150;
const STAGE_INTRO_DELAY_MS = 1200;
const HIGH_SCORE_KEY = "rankthegames_highscore";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type State = {
  phase: GameState;
  runId: string | null;
  signedRunToken: string | null;
  games: Record<string, RunGame>;
  roundPairs: RunPair[];
  leftGame: RunGame | null;
  rightGame: RunGame | null;
  currentRound: number;
  streak: number;
  previousStreak: number;
  highScore: number;
  isNewHighScore: boolean;
  selections: RunSelection[];
  error: string | null;
};

/** Score state carried into a freshly loaded run. */
type ScoreCarry = Pick<State, "streak" | "previousStreak" | "highScore" | "isNewHighScore">;

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: CreateRunResponse; carry: ScoreCarry }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "SELECT_GAME"; gameId: string }
  | { type: "REVEAL_DONE" }
  | { type: "TRANSITION_DONE" }
  | { type: "SWAP_DONE" }
  | { type: "STAGE_INTRO_DONE" };

/** Phases that auto-advance after a fixed delay. */
const PHASE_TIMERS: Partial<Record<GameState, [number, Action]>> = {
  REVEALING: [REVEAL_DELAY_MS, { type: "REVEAL_DONE" }],
  CORRECT: [TRANSITION_DELAY_MS, { type: "TRANSITION_DONE" }],
  INCORRECT: [TRANSITION_DELAY_MS, { type: "TRANSITION_DONE" }],
  TRANSITIONING: [SWAP_DELAY_MS, { type: "SWAP_DONE" }],
  ROUND_INTRO: [STAGE_INTRO_DELAY_MS, { type: "STAGE_INTRO_DONE" }]
};

function getInitialState(): State {
  return {
    phase: "LOADING",
    runId: null,
    signedRunToken: null,
    games: {},
    roundPairs: [],
    leftGame: null,
    rightGame: null,
    currentRound: 0,
    streak: 0,
    previousStreak: 0,
    highScore: 0,
    isNewHighScore: false,
    selections: [],
    error: null
  };
}

function getRoundPairGames(
  games: Record<string, RunGame>,
  roundPairs: RunPair[],
  round: number,
  selections: RunSelection[]
) {
  const roundPair = getBracketRoundPair(round, roundPairs, selections);

  return {
    leftGame: roundPair ? games[roundPair.leftGameId] ?? null : null,
    rightGame: roundPair ? games[roundPair.rightGameId] ?? null : null
  };
}

function readStoredHighScore(): number {
  return parseInt(localStorage.getItem(HIGH_SCORE_KEY) ?? "", 10) || 0;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return getInitialState();

    case "FETCH_SUCCESS": {
      const { payload, carry } = action;
      const { leftGame, rightGame } = getRoundPairGames(payload.games, payload.roundPairs, 1, []);

      return {
        ...getInitialState(),
        ...carry,
        phase: "AWAITING_CHOICE",
        runId: payload.runId,
        signedRunToken: payload.signedRunToken,
        games: payload.games,
        roundPairs: payload.roundPairs,
        leftGame,
        rightGame,
        currentRound: 1
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
      const lastSelection = state.selections[state.selections.length - 1];
      if (state.phase !== "REVEALING" || !lastSelection || !state.leftGame || !state.rightGame) {
        return state;
      }

      if (!isCorrectPick(state.leftGame, state.rightGame, lastSelection.pickedGameId)) {
        return { ...state, phase: "INCORRECT" };
      }

      const newStreak = state.streak + 1;
      return {
        ...state,
        phase: "CORRECT",
        streak: newStreak,
        highScore: Math.max(state.highScore, newStreak),
        isNewHighScore: newStreak > state.previousStreak
      };
    }

    case "TRANSITION_DONE": {
      if (state.phase === "CORRECT") return { ...state, phase: "TRANSITIONING" };
      if (state.phase === "INCORRECT") return { ...state, phase: "GAME_OVER" };
      return state;
    }

    case "SWAP_DONE": {
      if (state.phase !== "TRANSITIONING") return state;

      if (state.currentRound >= MAX_TOURNAMENT_ROUNDS) {
        return { ...state, phase: "TOURNAMENT_COMPLETE" };
      }

      const nextRound = state.currentRound + 1;
      const { leftGame, rightGame } = getRoundPairGames(
        state.games,
        state.roundPairs,
        nextRound,
        state.selections
      );

      return {
        ...state,
        phase: shouldShowStageIntro(nextRound) ? "ROUND_INTRO" : "AWAITING_CHOICE",
        leftGame,
        rightGame,
        currentRound: nextRound
      };
    }

    case "STAGE_INTRO_DONE":
      if (state.phase !== "ROUND_INTRO") return state;
      return { ...state, phase: "AWAITING_CHOICE" };

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
  roundPairs: RunPair[];
  games: Record<string, RunGame>;
  selectGame: (gameId: string) => void;
  playAgain: () => void;
  continueAfterReset: () => void;
};

export function useGame(): UseGameReturn {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const fetchRef = useRef(false);

  /** Load a run, skipping the loading state entirely when a warmed run is ready. */
  const loadRun = useCallback(async (getCarry: () => ScoreCarry) => {
    const warmRun = takeWarmRunIfReady();
    if (warmRun) {
      dispatch({ type: "FETCH_SUCCESS", payload: warmRun, carry: getCarry() });
      return;
    }

    dispatch({ type: "FETCH_START" });
    try {
      const payload = await consumeWarmRun();
      dispatch({ type: "FETCH_SUCCESS", payload, carry: getCarry() });
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to start game"
      });
    }
  }, []);

  const playAgain = useCallback(() => {
    void loadRun(() => {
      const highScore = readStoredHighScore();
      return { streak: 0, previousStreak: highScore, highScore, isNewHighScore: false };
    });
  }, [loadRun]);

  // Initial fetch on mount
  useEffect(() => {
    if (!fetchRef.current) {
      fetchRef.current = true;
      playAgain();
    }
  }, [playAgain]);

  // Auto-advance timed phases
  useEffect(() => {
    const timer = PHASE_TIMERS[state.phase];
    if (!timer) return;
    const [delayMs, action] = timer;
    const timeoutId = setTimeout(() => dispatch(action), delayMs);
    return () => clearTimeout(timeoutId);
  }, [state.phase]);

  // Preload covers for the next round so the swap never shows a blank card
  const { currentRound, roundPairs, selections, games } = state;
  useEffect(() => {
    const nextPair = getBracketRoundPair(currentRound + 1, roundPairs, selections);
    if (!nextPair) return;
    for (const id of [nextPair.leftGameId, nextPair.rightGameId]) {
      const url = games[id]?.imageUrl;
      if (url) preloadCover(url);
    }
  }, [currentRound, roundPairs, selections, games]);

  // Persist high score to localStorage
  useEffect(() => {
    if (state.highScore > 0) {
      localStorage.setItem(HIGH_SCORE_KEY, String(state.highScore));
    }
  }, [state.highScore]);

  const selectGame = useCallback((gameId: string) => {
    dispatch({ type: "SELECT_GAME", gameId });
  }, []);

  const { streak, previousStreak, highScore, isNewHighScore } = state;
  const continueAfterReset = useCallback(() => {
    void loadRun(() => ({ streak, previousStreak, highScore, isNewHighScore }));
  }, [loadRun, streak, previousStreak, highScore, isNewHighScore]);

  return {
    phase: state.phase,
    leftGame: state.leftGame,
    rightGame: state.rightGame,
    currentRound,
    streak,
    previousStreak,
    highScore,
    isNewHighScore,
    error: state.error,
    selections,
    runId: state.runId,
    signedRunToken: state.signedRunToken,
    roundPairs,
    games,
    selectGame,
    playAgain,
    continueAfterReset
  };
}
