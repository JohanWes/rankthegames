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
          ? "text-neon-cyan neon-glow-cyan"
          : "bg-gradient-to-r from-neon-cyan to-neon-purple bg-clip-text text-transparent font-bold";

  return (
    <div className="flex items-center gap-2">
      <span className={`font-display text-3xl leading-none ${tierClass}`}>
        {streak}
      </span>
      {isNewHighScore && streak > previousStreak && (
        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-gold">
          NEW BEST!
        </span>
      )}
    </div>
  );
}
