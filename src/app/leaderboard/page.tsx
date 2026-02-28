import Image from "next/image";
import Link from "next/link";
import { getLeaderboard } from "@/server/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 30;

const RANK_ACCENT: Record<number, string> = {
  1: "text-gold",
  2: "text-text-secondary",
  3: "text-[#CD7F32]"
};

export default async function LeaderboardPage() {
  const { items } = await getLeaderboard(100);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-5xl font-bold text-neon-cyan neon-glow-cyan">
          LEADERBOARD
        </h1>
        <div className="flex gap-3">
          <Link
            href="/game"
            className="rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple px-6 py-2 font-display text-lg font-bold text-bg-deep transition-transform hover:scale-105 active:scale-95"
          >
            PLAY
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/10 px-6 py-2 text-sm text-text-secondary transition-colors hover:text-neon-cyan"
          >
            Home
          </Link>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const rank = index + 1;
          const accentClass = RANK_ACCENT[rank] ?? "text-text-muted";

          return (
            <div
              key={item.id}
              className="glass flex items-center gap-4 rounded-xl px-4 py-3"
            >
              {/* Rank */}
              <span
                className={`w-10 text-right font-display text-2xl font-bold ${accentClass}`}
              >
                {rank}
              </span>

              {/* Thumbnail */}
              <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-bg-elevated">
                {item.thumbUrl ? (
                  <Image
                    src={item.thumbUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                    ?
                  </div>
                )}
              </div>

              {/* Name + year */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-semibold text-text-primary">
                  {item.name}
                </p>
                {item.year != null && (
                  <p className="text-xs text-text-secondary">{item.year}</p>
                )}
              </div>

              {/* Score */}
              <span className="font-display text-2xl font-bold text-neon-cyan">
                {Math.round(item.currentScore)}
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
