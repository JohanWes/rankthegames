"use client";

import { useEffect, useRef } from "react";
import { useGame } from "@/hooks/useGame";
import { useBeaconSubmit } from "@/hooks/useBeaconSubmit";
import { usePreloadImages } from "@/hooks/usePreloadImages";
import { GameCard, type GameCardState } from "@/components/GameCard";
import { VsBanner } from "@/components/VsBanner";
import { GameHeader } from "@/components/GameHeader";
import { GameOverModal } from "@/components/GameOverModal";
import { ScreenFlash } from "@/components/ScreenFlash";
import type { RunGame, GameState } from "@/lib/types";

const MAX_ROUNDS = 10;

function getCardState(
  phase: GameState,
  pickedId: string | null,
  gameId: string,
  correctId: string | null
): GameCardState {
  if (phase === "AWAITING_CHOICE") return "idle";

  if (phase === "REVEALING") {
    return pickedId === gameId ? "selected" : "idle";
  }

  const isCorrect = gameId === correctId;

  if (phase === "CORRECT" || phase === "TRANSITIONING") {
    return pickedId === gameId ? "correct" : "opponent-correct";
  }

  if (phase === "INCORRECT" || phase === "GAME_OVER") {
    if (pickedId === gameId) {
      return isCorrect ? "correct" : "incorrect";
    }
    return isCorrect ? "correct" : "opponent-incorrect";
  }

  return "idle";
}

function getFlashType(phase: GameState): "correct" | "incorrect" | null {
  if (phase === "CORRECT") return "correct";
  if (phase === "INCORRECT") return "incorrect";
  return null;
}

function getVsState(phase: GameState): "idle" | "deciding" | "revealed" {
  if (phase === "REVEALING") return "deciding";
  if (phase === "CORRECT" || phase === "INCORRECT" || phase === "GAME_OVER") return "revealed";
  return "idle";
}

function getCorrectId(leftGame: RunGame | null, rightGame: RunGame | null): string | null {
  if (!leftGame || !rightGame) return null;
  return leftGame.snapshotScore >= rightGame.snapshotScore ? leftGame.id : rightGame.id;
}

export default function GamePage() {
  const game = useGame();
  const { submitRun, setRunParams, resetSubmission } = useBeaconSubmit();
  usePreloadImages(game.currentRound, game.challengerQueue, game.games);

  const submittedForRunRef = useRef<string | null>(null);

  // Keep beacon params in sync
  useEffect(() => {
    if (game.runId && game.signedRunToken && game.startedAt) {
      setRunParams({
        runId: game.runId,
        signedRunToken: game.signedRunToken,
        selections: game.selections,
        endedReason: "abandoned",
        startedAt: game.startedAt
      });
    }
  }, [game.runId, game.signedRunToken, game.selections, game.startedAt, setRunParams]);

  // Submit on game over
  useEffect(() => {
    if (game.phase === "GAME_OVER" && game.runId && submittedForRunRef.current !== game.runId) {
      submittedForRunRef.current = game.runId;

      // streak matches selections length → all correct
      const allCorrect = game.streak === game.selections.length;
      let endedReason: "wrong_guess" | "max_rounds" | "abandoned";
      if (!allCorrect) {
        endedReason = "wrong_guess";
      } else if (game.streak >= MAX_ROUNDS) {
        endedReason = "max_rounds";
      } else {
        endedReason = "abandoned";
      }

      submitRun(endedReason);
    }
  }, [game.phase, game.runId, game.streak, game.selections.length, submitRun]);

  const handlePlayAgain = () => {
    submittedForRunRef.current = null;
    resetSubmission();
    game.playAgain();
  };

  // Loading state
  if (game.phase === "LOADING") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {game.error ? (
          <div className="text-center">
            <p className="text-wrong">{game.error}</p>
            <button
              type="button"
              onClick={handlePlayAgain}
              className="mt-4 rounded-full bg-neon-cyan/20 px-6 py-2 text-neon-cyan"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-neon-cyan/30 border-t-neon-cyan" />
        )}
      </div>
    );
  }

  const lastSelection = game.selections[game.selections.length - 1] ?? null;
  const pickedId = lastSelection?.pickedGameId ?? null;
  const correctId = getCorrectId(game.leftGame, game.rightGame);
  const showScores =
    game.phase === "CORRECT" ||
    game.phase === "INCORRECT" ||
    game.phase === "GAME_OVER" ||
    game.phase === "TRANSITIONING";

  return (
    <div className="min-h-screen">
      <GameHeader
        streak={game.streak}
        previousStreak={game.previousStreak}
        highScore={game.highScore}
        isNewHighScore={game.isNewHighScore}
      />

      {/* Game area */}
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 px-4 pt-14 pb-8 md:flex-row md:gap-6 md:pt-16">
        {game.leftGame && (
          <div className="w-full max-w-xs md:max-w-[440px] lg:max-w-[520px]">
            <GameCard
              game={game.leftGame}
              position="left"
              state={getCardState(game.phase, pickedId, game.leftGame.id, correctId)}
              onSelect={() => game.selectGame(game.leftGame!.id)}
              disabled={game.phase !== "AWAITING_CHOICE"}
              showScore={showScores}
            />
          </div>
        )}

        <VsBanner state={getVsState(game.phase)} />

        {game.rightGame && (
          <div className="w-full max-w-xs md:max-w-[440px] lg:max-w-[520px]">
            <GameCard
              game={game.rightGame}
              position="right"
              state={getCardState(game.phase, pickedId, game.rightGame.id, correctId)}
              onSelect={() => game.selectGame(game.rightGame!.id)}
              disabled={game.phase !== "AWAITING_CHOICE"}
              showScore={showScores}
            />
          </div>
        )}
      </div>

      <ScreenFlash type={getFlashType(game.phase)} />

      {game.phase === "GAME_OVER" && (
        <GameOverModal
          streak={game.streak}
          highScore={game.highScore}
          isNewHighScore={game.isNewHighScore}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
