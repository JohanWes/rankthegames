"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion, useSpring, useTransform } from "framer-motion";
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
  isHigher?: boolean;
  priority?: boolean;
};

const borderColors: Record<GameCardState, string> = {
  idle: "border-white/10",
  selected: "border-accent",
  correct: "border-correct",
  incorrect: "border-wrong",
  "opponent-correct": "border-white/10",
  "opponent-incorrect": "border-white/10",
};

const glowStyles: Record<GameCardState, string> = {
  idle: "",
  selected: "glow-accent-box",
  correct: "neon-glow-green",
  incorrect: "neon-glow-red",
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
    <motion.span className="font-display text-4xl font-bold text-accent md:text-5xl">
      {display}
    </motion.span>
  );
}

// Result icon — checkmark or X
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

// Gamepad SVG for missing cover fallback
function GamepadIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      className="opacity-30"
    >
      <path
        d="M20 18H44C50.627 18 56 23.373 56 30V34C56 40.627 50.627 46 44 46H20C13.373 46 8 40.627 8 34V30C8 23.373 13.373 18 20 18Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="22" cy="32" r="3" fill="currentColor" />
      <circle cx="42" cy="28" r="2.5" fill="currentColor" />
      <circle cx="46" cy="32" r="2.5" fill="currentColor" />
      <circle cx="42" cy="36" r="2.5" fill="currentColor" />
      <circle cx="38" cy="32" r="2.5" fill="currentColor" />
      <rect x="28" y="30" width="8" height="4" rx="2" fill="currentColor" />
    </svg>
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
  isHigher = false,
  priority = false,
}: GameCardProps) {
  const canClick = !disabled && state === "idle" && !!onSelect;
  const showResult = state === "correct" || state === "incorrect";

  return (
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
        relative w-full overflow-hidden rounded-2xl border-2
        aspect-[3/4]
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
          sizes="(max-width: 768px) 50vw, 40vw"
          priority={priority}
          unoptimized
        />
      ) : (
        /* Gradient fallback with gamepad icon */
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4"
          style={{
            background:
              "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(0,240,255,0.1) 100%), #161B22",
          }}
        >
          <GamepadIcon />
          <span className="text-center font-display text-2xl font-semibold text-text-secondary">
            {game.name}
          </span>
        </div>
      )}

      {/* Crown for higher-scored game */}
      {isHigher && showScore && (
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 14, delay: 0.15 }}
          className="absolute top-3 left-3 z-20 text-2xl leading-none"
          aria-label="Higher score"
        >
          <span className="drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
            ♛
          </span>
        </motion.div>
      )}

      {/* Result icon (checkmark / X) */}
      {showResult && <ResultIcon isCorrect={state === "correct"} />}

      {/* Bottom gradient scrim */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16">
        <h3 className="font-display text-2xl leading-tight font-semibold text-text-primary drop-shadow-lg">
          {game.name}
        </h3>
        {game.year != null && (
          <p className="mt-0.5 text-sm text-text-secondary">{game.year}</p>
        )}
      </div>

      {/* Score overlay — bottom-anchored glassmorphism panel */}
      {showScore && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          className="absolute inset-x-0 bottom-0 z-10 p-4"
        >
          <div
            className="glass rounded-xl px-4 py-3 text-center"
            style={{
              background: "rgba(7, 11, 20, 0.75)",
              backdropFilter: "blur(12px) saturate(1.3)",
            }}
          >
            <ScoreDisplay score={game.snapshotScore} />
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-text-secondary">
              Live Score
            </p>
          </div>
        </motion.div>
      )}
    </motion.button>
  );
}
