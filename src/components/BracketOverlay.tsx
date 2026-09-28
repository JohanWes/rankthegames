"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";

import { BracketRoundTabs } from "@/components/BracketRoundTabs";
import { BracketTree } from "@/components/BracketTree";
import { MAX_TOURNAMENT_ROUNDS } from "@/lib/bracket";
import { buildBracketModel, type BracketMatch, type BracketModel } from "@/lib/bracket-model";
import type { RunGame, RunPair, RunSelection } from "@/lib/types";

/**
 * Any onUpdate handler keeps framer-motion off the native WAAPI path. There, the
 * exit fade cancels its browser animation a frame before the final opacity is
 * written, flashing the closed dialog back at full opacity.
 */
const forceFrameloopAnimation = () => {};

type BracketOverlayProps = {
  open: boolean;
  onClose: () => void;
  games: Record<string, RunGame>;
  openingPairs: RunPair[];
  selections: RunSelection[];
  currentRound: number;
  /** Show rating scores; only safe once the run is over. */
  revealScores?: boolean;
};

function getSegmentClass(match: BracketMatch) {
  if (match.status === "done") return match.isCorrect === false ? "bg-wrong" : "bg-correct";
  if (match.status === "live") return "bg-accent";
  return "bg-line-strong";
}

function ProgressStrip({ model }: { model: BracketModel }) {
  return (
    <div className="flex w-full items-center gap-1.5" aria-hidden="true">
      {model.stages.map((stage) => (
        <div key={stage.id} className="flex gap-[3px]" style={{ flexGrow: stage.matches.length }}>
          {stage.matches.map((match) => (
            <span
              key={match.round}
              className={`h-1.5 flex-1 rounded-full transition-colors ${getSegmentClass(match)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function getSubtitle(model: BracketModel, currentRound: number, games: Record<string, RunGame>) {
  const lostMatch = Object.values(model.matches).find((match) => match.isCorrect === false);
  if (lostMatch) {
    const stage = model.stages.find((candidate) => candidate.matches.includes(lostMatch));
    return `Out in round ${lostMatch.round} · ${stage?.title ?? ""}`;
  }

  if (model.championId) {
    return `Bracket complete · ${games[model.championId]?.name ?? "Champion"} wins`;
  }

  const round = Math.min(Math.max(currentRound, 1), MAX_TOURNAMENT_ROUNDS);
  const stage = model.stages.find((candidate) => candidate.id === model.currentStageId);
  return `Round ${round} of ${MAX_TOURNAMENT_ROUNDS} · ${stage?.title ?? ""}`;
}

export function BracketOverlay({
  open,
  onClose,
  games,
  openingPairs,
  selections,
  currentRound,
  revealScores = false
}: BracketOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const model = useMemo(
    () => buildBracketModel(openingPairs, selections, currentRound, games),
    [openingPairs, selections, currentRound, games]
  );

  const isRunOver =
    model.championId !== null ||
    Object.values(model.matches).some((match) => match.isCorrect === false);

  // Escape closes; focus moves into the dialog and returns to the opener afterwards.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bracket-title"
            className="fixed inset-0 z-50 flex flex-col bg-bg-deep/95 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onUpdate={forceFrameloopAnimation}
          >
            <header className="shrink-0 border-b border-line px-4 pt-3 pb-3 md:px-8 md:pt-5">
              <div className="mx-auto flex max-w-6xl items-center gap-4">
                <div className="min-w-0 flex-1">
                  <h2
                    id="bracket-title"
                    className="font-display text-4xl font-semibold uppercase leading-none text-text-primary md:text-5xl"
                  >
                    Bracket
                  </h2>
                  <p className="mt-1 truncate text-sm font-medium text-text-secondary">
                    {getSubtitle(model, currentRound, games)}
                  </p>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close bracket"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-bg-elevated text-text-secondary transition-colors hover:border-white/30 hover:text-text-primary"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="mx-auto mt-3 max-w-6xl">
                <ProgressStrip model={model} />
              </div>
            </header>

            <div className="hidden min-h-0 flex-1 lg:block">
              <BracketTree
                model={model}
                games={games}
                revealScores={revealScores}
                isRunOver={isRunOver}
              />
            </div>

            <div className="min-h-0 flex-1 lg:hidden">
              <BracketRoundTabs
                model={model}
                games={games}
                revealScores={revealScores}
                isRunOver={isRunOver}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
