"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/hooks/useGame";
import { useBeaconSubmit } from "@/hooks/useBeaconSubmit";
import { getTournamentStageTitle } from "@/lib/bracket";
import { warmRunPrefetch } from "@/lib/run-prefetch";
import { BracketOverlay } from "@/components/BracketOverlay";
import { GameCard, type GameCardState } from "@/components/GameCard";
import { VsBanner } from "@/components/VsBanner";
import { MobileCarousel } from "@/components/MobileCarousel";
import { GameHeader } from "@/components/GameHeader";
import { GameOverModal } from "@/components/GameOverModal";
import { ResetPopup } from "@/components/ResetPopup";
import { ScreenFlash } from "@/components/ScreenFlash";
import type { RunGame, GameState } from "@/lib/types";

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
  const [isBracketOpen, setIsBracketOpen] = useState(false);

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

  // Submit on game over or reset (completed run)
  useEffect(() => {
    const shouldSubmit = game.phase === "GAME_OVER" || game.phase === "TOURNAMENT_COMPLETE";
    if (shouldSubmit && game.runId && submittedForRunRef.current !== game.runId) {
      submittedForRunRef.current = game.runId;

      if (game.phase === "TOURNAMENT_COMPLETE") {
        submitRun("max_rounds");
      } else {
        // streak matches selections length → all correct
        const allCorrect = game.streak === game.selections.length;
        let endedReason: "wrong_guess" | "max_rounds" | "abandoned";
        if (!allCorrect) {
          endedReason = "wrong_guess";
        } else {
          endedReason = "abandoned";
        }
        submitRun(endedReason);
      }
    }
  }, [game.phase, game.runId, game.streak, game.selections.length, submitRun]);

  // Prefetch next run while player is on a terminal screen
  useEffect(() => {
    if (game.phase === "GAME_OVER" || game.phase === "TOURNAMENT_COMPLETE") {
      void warmRunPrefetch().catch(() => {});
    }
  }, [game.phase]);

  const handlePlayAgain = () => {
    submittedForRunRef.current = null;
    resetSubmission();
    game.playAgain();
  };

  const handleResetContinue = () => {
    resetSubmission();
    game.continueAfterReset();
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
              className="mt-4 rounded-full bg-accent/20 px-6 py-2 text-accent"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
        )}
      </div>
    );
  }

  const lastSelection = game.selections[game.selections.length - 1] ?? null;
  const pickedId = lastSelection?.pickedGameId ?? null;
  const correctId = getCorrectId(game.leftGame, game.rightGame);
  const showScores =
    game.phase === "INCORRECT" ||
    game.phase === "GAME_OVER";
  const championId =
    game.phase === "TOURNAMENT_COMPLETE"
      ? game.selections[game.selections.length - 1]?.pickedGameId
      : null;
  const champion = championId ? game.games[championId] ?? null : null;

  return (
    <div className="min-h-screen">
      <GameHeader
        streak={game.streak}
        previousStreak={game.previousStreak}
        highScore={game.highScore}
        isNewHighScore={game.isNewHighScore}
        onOpenBracket={() => setIsBracketOpen(true)}
      />

      <BracketOverlay
        open={isBracketOpen}
        onClose={() => setIsBracketOpen(false)}
        games={game.games}
        openingPairs={game.roundPairs}
        selections={game.selections}
        currentRound={game.currentRound}
      />

      {/* Game area */}
      <div className="relative flex min-h-screen flex-col items-center justify-center px-0 pt-14 pb-8 md:flex-row md:gap-6 md:px-4 md:pt-16">
        {game.leftGame && game.rightGame && (
          <MobileCarousel
            locked={game.phase !== "AWAITING_CHOICE"}
            scrollToIndex={
              game.phase === "TRANSITIONING"
                ? 0
                : game.phase === "REVEALING" && pickedId
                  ? pickedId === game.leftGame.id
                    ? 0
                    : 1
                  : undefined
            }
          >
            <div className="w-full max-w-xs md:max-w-[440px] lg:max-w-[520px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={game.leftGame.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <GameCard
                    game={game.leftGame}
                    position="left"
                    state={getCardState(game.phase, pickedId, game.leftGame.id, correctId)}
                    onSelect={() => game.selectGame(game.leftGame!.id)}
                    disabled={game.phase !== "AWAITING_CHOICE"}
                    showScore={showScores}
                    priority={game.currentRound === 1}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="w-full max-w-xs md:max-w-[440px] lg:max-w-[520px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={game.rightGame.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <GameCard
                    game={game.rightGame}
                    position="right"
                    state={getCardState(game.phase, pickedId, game.rightGame.id, correctId)}
                    onSelect={() => game.selectGame(game.rightGame!.id)}
                    disabled={game.phase !== "AWAITING_CHOICE"}
                    showScore={showScores}
                    priority={game.currentRound === 1}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </MobileCarousel>
        )}

        <VsBanner state={getVsState(game.phase)} />
      </div>

      <ScreenFlash type={getFlashType(game.phase)} />

      <AnimatePresence>
        {game.phase === "ROUND_INTRO" && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center"
              initial={{ scale: 0.9, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 1.04, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-accent">
                Tournament
              </p>
              <h2 className="mt-2 font-display text-6xl font-bold text-text-primary glow-accent-text sm:text-8xl">
                {getTournamentStageTitle(game.currentRound)}
              </h2>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ResetPopup
        visible={game.phase === "TOURNAMENT_COMPLETE"}
        streak={game.streak}
        championName={champion?.name ?? "Champion"}
        onComplete={handleResetContinue}
      />

      {game.phase === "GAME_OVER" && (
        <GameOverModal
          streak={game.streak}
          highScore={game.highScore}
          isNewHighScore={game.isNewHighScore}
          lostMatch={
            game.leftGame && game.rightGame
              ? {
                  leftName: game.leftGame.name,
                  leftScore: game.leftGame.snapshotScore,
                  rightName: game.rightGame.name,
                  rightScore: game.rightGame.snapshotScore
                }
              : null
          }
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
