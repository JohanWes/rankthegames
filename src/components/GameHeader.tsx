"use client";

import Link from "next/link";
import { StreakCounter } from "./StreakCounter";

type GameHeaderProps = {
  streak: number;
  previousStreak: number;
  highScore: number;
  isNewHighScore: boolean;
  onOpenBracket: () => void;
};

export function GameHeader({
  streak,
  previousStreak,
  highScore,
  isNewHighScore,
  onOpenBracket
}: GameHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 glass h-14 md:h-16">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-display text-xl font-bold text-accent glow-accent-text md:text-2xl"
        >
          RankTheGames
        </Link>

        {/* Streak */}
        <StreakCounter
          streak={streak}
          previousStreak={previousStreak}
          isNewHighScore={isNewHighScore}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenBracket}
            className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/20"
          >
            Bracket
          </button>

          {/* High score badge */}
          <div className="rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-text-secondary">
            HI: {highScore}
          </div>
        </div>
      </div>
    </header>
  );
}
