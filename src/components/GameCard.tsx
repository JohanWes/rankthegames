"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion, useSpring, useTransform } from "framer-motion";
import { CoverPlaceholder } from "@/components/CoverPlaceholder";
import { CARD_IMAGE_SIZES } from "@/lib/run-prefetch";
import type { RunGame } from "@/lib/types";

export type GameCardState =
  | "idle"
  | "selected"
  | "correct"
  | "incorrect"
  | "opponent-correct"
  | "opponent-incorrect";

type GameCardProps = {
  game: RunGame;
  state: GameCardState;
  onSelect?: () => void;
  disabled?: boolean;
  showScore?: boolean;
  position: "left" | "right";
};

const borderColors: Record<GameCardState, string> = {
  idle: "border-line",
  selected: "border-accent",
  correct: "border-correct",
  incorrect: "border-wrong",
  "opponent-correct": "border-line",
  "opponent-incorrect": "border-line",
};

const glowStyles: Record<GameCardState, string> = {
  idle: "",
  selected: "result-glow-selected",
  correct: "result-glow-correct",
  incorrect: "result-glow-incorrect",
  "opponent-correct": "",
  "opponent-incorrect": "",
};

// Spring-animated score display
function ScoreDisplay({ score }: { score: number }) {
  const springValue = useSpring(0, { stiffness: 200, damping: 12 });
  const display = useTransform(springValue, (v) => Math.round(v));

  useEffect(() => {
    springValue.set(score);
  }, [score, springValue]);

  return (
    <motion.span className="tabular block font-display text-5xl leading-none font-semibold text-text-primary md:text-6xl">
      {display}
    </motion.span>
  );
}

function ResultIcon({ isCorrect }: { isCorrect: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.05 }}
      className={`absolute top-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full ${
        isCorrect ? "bg-correct" : "bg-wrong"
      }`}
    >
      {isCorrect ? (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M4 10.5L8 14.5L16 6.5"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M5.5 5.5L14.5 14.5M14.5 5.5L5.5 14.5"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      )}
    </motion.div>
  );
}

// Get framer-motion animate props based on card state
function getAnimateProps(state: GameCardState) {
  switch (state) {
    case "correct":
      return { scale: 1.03, y: -8, opacity: 1 };
    case "opponent-incorrect":
      return { scale: 1, y: 0, opacity: 0.7 };
    default:
      return { scale: 1, y: 0, opacity: 1 };
  }
}

export function GameCard({
  game,
  state,
  onSelect,
  disabled = false,
  showScore = false,
  position,
}: GameCardProps) {
  const canClick = !disabled && state === "idle" && !!onSelect;
  const showResult = state === "correct" || state === "incorrect";

  return (
    <div>
      <motion.button
        type="button"
        onClick={canClick ? onSelect : undefined}
        disabled={!canClick}
        aria-label={`Select ${game.name}`}
        data-position={position}
        animate={getAnimateProps(state)}
        whileHover={canClick ? { scale: 1.02, y: -4 } : undefined}
        whileTap={canClick ? { scale: 0.96 } : undefined}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className={`
          relative w-full overflow-hidden rounded-xl border-2
          aspect-[3/4] focus-visible:outline-offset-4
          ${borderColors[state]}
          ${glowStyles[state]}
          ${canClick ? "cursor-pointer" : "cursor-default"}
          bg-bg-elevated
        `}
      >
        {/* Cover image */}
        {game.imageUrl ? (
          <Image
            src={game.imageUrl}
            alt={game.name}
            fill
            className="object-cover"
            sizes={CARD_IMAGE_SIZES}
            priority
          />
        ) : (
          <CoverPlaceholder name={game.name} iconSize={64} />
        )}

        {showResult && <ResultIcon isCorrect={state === "correct"} />}

        {/* Title sits on the cover at md+ (below the card on mobile); the rating joins it on reveal */}
        <div
          className={[
            "absolute inset-x-0 bottom-0 items-end justify-between gap-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-5 pt-20 pb-4 text-left",
            showScore ? "flex" : "hidden md:flex"
          ].join(" ")}
        >
          <div className="hidden min-w-0 md:block">
            <h3 className="font-display text-3xl leading-[0.95] font-medium text-text-primary text-balance">
              {game.name}
            </h3>
            {game.year != null && (
              <p className="mt-1 text-sm font-medium text-white/60">{game.year}</p>
            )}
          </div>

          {showScore && (
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
              className="ml-auto shrink-0 text-right"
            >
              <p className="text-xs font-medium text-white/60">Rating</p>
              <ScoreDisplay score={game.snapshotScore} />
            </motion.div>
          )}
        </div>
      </motion.button>

      <div className="mt-2 min-h-[4.25rem] px-1 md:hidden">
        <h3 className="line-clamp-2 font-display text-2xl leading-none font-medium text-text-primary">
          {game.name}
        </h3>
        {game.year != null && (
          <p className="mt-0.5 text-sm text-text-secondary">{game.year}</p>
        )}
      </div>
    </div>
  );
}
