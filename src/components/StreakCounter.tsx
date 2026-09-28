"use client";

type StreakCounterProps = {
  streak: number;
  previousStreak: number;
  isNewHighScore: boolean;
};

export function StreakCounter({
  streak,
  previousStreak,
  isNewHighScore
}: StreakCounterProps) {
  const tierClass =
    streak === 0
      ? "text-text-muted"
      : streak < 5
        ? "text-text-primary"
        : streak < 10
          ? "text-accent"
          : "text-accent font-bold";

  return (
    <div className="relative flex items-baseline gap-2" aria-label={`Streak ${streak}`}>
      <span className={`tabular font-display text-4xl font-semibold leading-none ${tierClass}`}>
        {streak}
      </span>
      <span className="text-xs font-medium text-text-secondary" aria-hidden="true">
        streak
      </span>
      {isNewHighScore && streak > previousStreak && (
        <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gold px-1.5 py-0.5 text-[11px] font-semibold leading-none text-bg-deep">
          New best
        </span>
      )}
    </div>
  );
}
