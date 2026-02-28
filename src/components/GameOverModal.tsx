"use client";

import Link from "next/link";

type GameOverModalProps = {
  streak: number;
  highScore: number;
  isNewHighScore: boolean;
  onPlayAgain: () => void;
};

export function GameOverModal({
  streak,
  highScore,
  isNewHighScore,
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

        {/* Play again */}
        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-8 w-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple px-8 py-3 font-display text-xl font-bold text-bg-deep transition-transform hover:scale-105 active:scale-95"
        >
          PLAY AGAIN
        </button>

        {/* Leaderboard link */}
        <Link
          href="/leaderboard"
          className="mt-4 inline-block text-sm text-text-secondary underline underline-offset-4 transition-colors hover:text-neon-cyan"
        >
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}
