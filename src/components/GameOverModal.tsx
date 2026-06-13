"use client";

import Link from "next/link";

type GameOverModalProps = {
  streak: number;
  highScore: number;
  isNewHighScore: boolean;
  lostMatch?: {
    leftName: string;
    leftScore: number;
    rightName: string;
    rightScore: number;
  } | null;
  onPlayAgain: () => void;
};

export function GameOverModal({
  streak,
  highScore,
  isNewHighScore,
  lostMatch = null,
  onPlayAgain
}: GameOverModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay">
      <div className="glass mx-4 w-full max-w-md rounded-3xl p-8 text-center">
        {/* Title */}
        <h2 className="font-display text-5xl font-bold text-wrong">
          GAME OVER
        </h2>

        {/* Streak */}
        <div className="mt-6">
          <p className="text-sm uppercase tracking-widest text-text-secondary">
            Streak
          </p>
          <p className="font-display text-7xl font-bold text-text-primary">
            {streak}
          </p>
        </div>

        {/* New high score */}
        {isNewHighScore && (
          <div className="mt-4">
            <span className="inline-block rounded-full bg-gold/20 px-4 py-1.5 font-display text-lg font-bold uppercase tracking-wider text-gold">
              NEW HIGH SCORE!
            </span>
          </div>
        )}

        {/* High score */}
        <p className="mt-4 text-text-secondary">
          Best: <span className="font-semibold text-text-primary">{highScore}</span>
        </p>

        {lostMatch && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
              Revealed MMR
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="truncate text-text-secondary">{lostMatch.leftName}</span>
                <span className="font-display text-xl font-bold text-text-primary">
                  {lostMatch.leftScore}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="truncate text-text-secondary">{lostMatch.rightName}</span>
                <span className="font-display text-xl font-bold text-text-primary">
                  {lostMatch.rightScore}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Play again */}
        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-8 w-full rounded-full border border-accent/60 bg-accent/10 px-8 py-3 font-display text-xl font-bold text-accent transition-all hover:bg-accent/20 hover:border-accent"
        >
          PLAY AGAIN
        </button>

        {/* Leaderboard link */}
        <Link
          href="/leaderboard"
          className="mt-4 inline-block text-sm text-text-secondary underline underline-offset-4 transition-colors hover:text-accent"
        >
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}
