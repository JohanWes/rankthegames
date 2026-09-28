import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CoverPlaceholder } from "@/components/CoverPlaceholder";
import { getLeaderboard, type LeaderboardItem } from "@/server/leaderboard";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Leaderboard · RankTheGames"
};

const PODIUM_COLOR: Record<number, string> = {
  1: "text-gold",
  2: "text-silver",
  3: "text-bronze"
};

const PODIUM_RING: Record<number, string> = {
  1: "ring-gold",
  2: "ring-silver",
  3: "ring-bronze"
};

async function loadItems(): Promise<LeaderboardItem[] | null> {
  try {
    const { items } = await getLeaderboard(100);
    return items;
  } catch (error) {
    console.error("Failed to load leaderboard.", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-y border-line py-16 text-center">
      <p className="font-display text-3xl leading-none text-text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-text-secondary">{body}</p>
      <Link href="/game" className="btn-primary mt-6 px-8 pt-3 pb-2.5 text-2xl">
        Play a run
      </Link>
    </div>
  );
}

export default async function LeaderboardPage() {
  const items = await loadItems();

  return (
    <main className="mx-auto min-h-svh max-w-3xl px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Home
        </Link>
        <Link href="/game" className="btn-primary px-6 pt-2.5 pb-2 text-xl">
          Play
        </Link>
      </div>

      <div className="mt-6 mb-8">
        <h1 className="font-display text-6xl font-semibold uppercase leading-[0.8] text-text-primary sm:text-7xl">
          Leaderboard
        </h1>
        <p className="mt-3 text-text-secondary">Games ranked by player picks. Updates every 30 seconds.</p>
      </div>

      {items === null ? (
        <EmptyState title="Leaderboard unavailable" body="The rankings couldn't be loaded right now. Try again in a moment." />
      ) : items.length === 0 ? (
        <EmptyState title="No rankings yet" body="Every pick moves a game up or down. Play a run to start the table." />
      ) : (
        <>
          <div className="flex items-center gap-4 border-b border-line px-2 pb-2 text-xs font-medium text-text-muted" aria-hidden="true">
            <span className="w-8 text-right">#</span>
            <span className="flex-1">Game</span>
            <span>Rating</span>
          </div>

          <ol className="divide-y divide-line">
            {items.map((item, index) => {
              const rank = index + 1;
              const isPodium = rank <= 3;
              const coverUrl = item.imageUrl ?? item.thumbUrl;

              return (
                <li key={item.id} className="flex items-center gap-4 px-2 py-2.5">
                  <span
                    className={[
                      "tabular w-8 shrink-0 text-right font-display leading-none",
                      isPodium ? `text-3xl font-semibold ${PODIUM_COLOR[rank]}` : "text-2xl text-text-muted"
                    ].join(" ")}
                  >
                    {rank}
                  </span>

                  <div
                    className={[
                      "relative shrink-0 overflow-hidden rounded-md bg-bg-elevated",
                      isPodium ? `h-16 w-12 ring-2 ${PODIUM_RING[rank]}` : "h-12 w-9"
                    ].join(" ")}
                  >
                    {coverUrl ? (
                      <Image src={coverUrl} alt="" fill className="object-cover" sizes="48px" />
                    ) : (
                      <CoverPlaceholder iconSize={20} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        "truncate font-display leading-none text-text-primary",
                        isPodium ? "text-2xl" : "text-xl"
                      ].join(" ")}
                    >
                      {item.name}
                    </p>
                    {item.year != null && <p className="mt-1 text-sm text-text-secondary">{item.year}</p>}
                  </div>

                  <span
                    className={[
                      "tabular font-display leading-none",
                      isPodium ? "text-3xl text-text-primary" : "text-2xl text-text-secondary"
                    ].join(" ")}
                  >
                    {Math.round(item.currentScore)}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </main>
  );
}
