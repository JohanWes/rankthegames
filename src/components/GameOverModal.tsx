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

function MatchupRow({ name, score, isWinner }: { name: string; score: number; isWinner: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className={`truncate ${isWinner ? "font-medium text-text-primary" : "text-text-secondary"}`}>
        {name}
      </span>
      <span
        className={`tabular font-display text-2xl leading-none ${isWinner ? "text-correct" : "text-text-secondary"}`}
      >
        {score}
      </span>
    </div>
  );
}

export function GameOverModal({
  streak,
  highScore,
  isNewHighScore,
  lostMatch = null,
  onPlayAgain
}: GameOverModalProps) {
  const leftWins = lostMatch ? lostMatch.leftScore >= lostMatch.rightScore : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-line bg-bg-elevated p-6 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] sm:p-8">
        <h2 id="game-over-title" className="text-center font-display text-4xl font-medium leading-none text-text-secondary">
          GAME OVER
        </h2>

        <div className="mt-4 text-center">
          <p className="tabular font-display text-8xl font-semibold leading-[0.8] text-text-primary">{streak}</p>
          <p className="mt-2 text-sm font-medium text-text-secondary">
            {streak === 1 ? "correct pick" : "correct picks"}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm">
          {isNewHighScore ? (
            <span className="rounded-md bg-gold px-2 py-1 font-semibold leading-none text-bg-deep">New high score</span>
          ) : (
            <span className="text-text-secondary">
              Best <span className="tabular font-semibold text-text-primary">{highScore}</span>
            </span>
          )}
        </div>

        {lostMatch && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm font-medium text-text-secondary">Final matchup · rating</p>
            <div className="mt-1 divide-y divide-line">
              <MatchupRow name={lostMatch.leftName} score={lostMatch.leftScore} isWinner={leftWins} />
              <MatchupRow name={lostMatch.rightName} score={lostMatch.rightScore} isWinner={!leftWins} />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onPlayAgain}
          autoFocus
          className="btn-primary mt-6 w-full pt-3.5 pb-3 text-2xl"
        >
          PLAY AGAIN
        </button>

        <div className="mt-4 text-center">
          <Link
            href="/leaderboard"
            className="text-sm font-medium text-text-secondary underline decoration-line-strong underline-offset-4 transition-colors hover:text-text-primary hover:decoration-accent"
          >
            View leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
