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
    <header className="fixed inset-x-0 top-0 z-30 h-14 border-b border-line bg-bg-deep/80 backdrop-blur-md md:h-16">
      <div className="mx-auto grid h-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4">
        <Link
          href="/"
          className="justify-self-start font-display text-xl font-semibold uppercase leading-none text-text-primary sm:text-2xl md:text-3xl"
        >
          Rank the <span className="text-accent">games</span>
        </Link>

        <StreakCounter
          streak={streak}
          previousStreak={previousStreak}
          isNewHighScore={isNewHighScore}
        />

        <div className="flex items-center gap-2 justify-self-end">
          <button type="button" onClick={onOpenBracket} className="btn-quiet h-8 px-3 pt-0.5 text-lg">
            Bracket
          </button>

          <div className="hidden h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-sm sm:flex">
            <span className="text-text-secondary">Best</span>
            <span className="tabular font-semibold text-text-primary">{highScore}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
