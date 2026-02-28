"use client";

import Image from "next/image";
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
  idle: "border-white/10",
  selected: "border-neon-cyan",
  correct: "border-correct",
  incorrect: "border-wrong",
  "opponent-correct": "border-white/10",
  "opponent-incorrect": "border-white/10"
};

const glowStyles: Record<GameCardState, string> = {
  idle: "",
  selected: "",
  correct: "neon-glow-green",
  incorrect: "neon-glow-red",
  "opponent-correct": "",
  "opponent-incorrect": ""
};

export function GameCard({
  game,
  state,
  onSelect,
  disabled = false,
  showScore = false,
  position
}: GameCardProps) {
  const canClick = !disabled && state === "idle" && !!onSelect;

  return (
    <button
      type="button"
      onClick={canClick ? onSelect : undefined}
      disabled={!canClick}
      aria-label={`Select ${game.name}`}
      data-position={position}
      className={`
        relative w-full overflow-hidden rounded-2xl border-2 transition-all duration-300
        aspect-[3/4]
        ${borderColors[state]}
        ${glowStyles[state]}
        ${canClick ? "cursor-pointer hover:border-neon-cyan/60 hover:scale-[1.02] active:scale-[0.98]" : "cursor-default"}
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
          sizes="(max-width: 768px) 50vw, 33vw"
          priority={position === "left"}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated p-4">
          <span className="text-center font-display text-2xl font-semibold text-text-secondary">
            {game.name}
          </span>
        </div>
      )}

      {/* Bottom gradient scrim */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16">
        <h3 className="font-display text-2xl leading-tight font-semibold text-text-primary drop-shadow-lg">
          {game.name}
        </h3>
        {game.year != null && (
          <p className="mt-0.5 text-sm text-text-secondary">{game.year}</p>
        )}
      </div>

      {/* Score overlay */}
      {showScore && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center">
            <p className="font-display text-5xl font-bold text-neon-cyan">
              {Math.round(game.snapshotScore)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-text-secondary">
              Score
            </p>
          </div>
        </div>
      )}
    </button>
  );
}
