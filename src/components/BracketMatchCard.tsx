"use client";

import Image from "next/image";

import type { BracketMatch } from "@/lib/bracket-model";
import type { RunGame } from "@/lib/types";

type SlotResult = "tbd" | "pending" | "winner" | "loser" | "wrong-pick" | "missed";

type BracketMatchCardProps = {
  match: BracketMatch;
  games: Record<string, RunGame>;
  revealScores?: boolean;
  isRunOver?: boolean;
};

export function getCoverUrl(game: RunGame | null | undefined) {
  return game?.imageUrl ?? game?.thumbUrl ?? null;
}

function getSlotResult(match: BracketMatch, game: RunGame | undefined): SlotResult {
  if (!game) return "tbd";
  if (match.status !== "done" || match.isCorrect === null) return "pending";

  const isPicked = match.pickedGameId === game.id;
  if (match.isCorrect) return isPicked ? "winner" : "loser";
  return isPicked ? "wrong-pick" : "missed";
}

function ResultBadge({ isCorrect }: { isCorrect: boolean }) {
  return (
    <span
      className={[
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        isCorrect ? "bg-correct" : "bg-wrong"
      ].join(" ")}
      aria-hidden="true"
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        {isCorrect ? (
          <path d="M2.5 6.5L5 9L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M3 3L9 9M9 3L3 9" stroke="white" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}

const rowStyles: Record<SlotResult, string> = {
  tbd: "",
  pending: "",
  winner: "bg-correct/[0.07]",
  loser: "opacity-40",
  "wrong-pick": "bg-wrong/[0.1]",
  missed: ""
};

function MatchSlot({
  game,
  result,
  revealScores
}: {
  game: RunGame | undefined;
  result: SlotResult;
  revealScores: boolean;
}) {
  if (!game) {
    return (
      <div className="flex h-12 items-center gap-2.5 px-2">
        <div className="h-10 w-[30px] shrink-0 rounded-[4px] border border-dashed border-white/15" />
        <span className="font-display text-base uppercase tracking-[0.12em] text-text-muted">TBD</span>
      </div>
    );
  }

  const coverUrl = getCoverUrl(game);
  const hasBar = result === "winner" || result === "wrong-pick";

  return (
    <div className={["relative flex h-12 items-center gap-2.5 px-2", rowStyles[result]].join(" ")}>
      {hasBar && (
        <span
          className={[
            "absolute inset-y-1.5 left-0 w-[3px] rounded-r-full",
            result === "winner" ? "bg-correct" : "bg-wrong"
          ].join(" ")}
          aria-hidden="true"
        />
      )}

      <div
        className={[
          "relative h-10 w-[30px] shrink-0 overflow-hidden rounded-[4px] bg-bg-base ring-1 ring-white/10",
          result === "loser" ? "grayscale" : ""
        ].join(" ")}
      >
        {coverUrl && (
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="96px"
            draggable={false}
            className="object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={[
            "truncate font-display text-[17px] leading-tight",
            result === "pending" || result === "winner" ? "text-text-primary" : "text-text-primary/85"
          ].join(" ")}
          title={game.name}
        >
          {game.name}
        </p>
        <p className="truncate text-[11px] leading-none text-text-secondary">
          {game.year ?? "—"}
          {result === "wrong-pick" && <span className="font-semibold text-wrong"> · Your pick</span>}
        </p>
      </div>

      {revealScores && (
        <span
          className={[
            "shrink-0 font-display text-lg leading-none tabular-nums",
            result === "winner" || result === "missed" ? "text-accent" : "text-text-secondary"
          ].join(" ")}
        >
          {game.snapshotScore}
        </span>
      )}

      {(result === "winner" || result === "missed") && <ResultBadge isCorrect />}
      {result === "wrong-pick" && <ResultBadge isCorrect={false} />}
    </div>
  );
}

export function BracketMatchCard({
  match,
  games,
  revealScores = false,
  isRunOver = false
}: BracketMatchCardProps) {
  const topGame = match.topGameId ? games[match.topGameId] : undefined;
  const bottomGame = match.bottomGameId ? games[match.bottomGameId] : undefined;
  const isLive = match.status === "live";
  const isDimmed = match.status === "upcoming" && (isRunOver || (!topGame && !bottomGame));

  return (
    <div
      role="group"
      aria-label={`Round ${match.round}: ${topGame?.name ?? "TBD"} vs ${bottomGame?.name ?? "TBD"}`}
      className={[
        "relative w-full rounded-lg border bg-bg-elevated/95 shadow-[0_12px_28px_rgba(0,0,0,0.35)]",
        isLive
          ? "border-accent shadow-[0_0_0_3px_rgba(245,158,11,0.16),0_0_28px_rgba(245,158,11,0.3)]"
          : match.isCorrect === false
            ? "border-wrong/60"
            : "border-white/10",
        isDimmed ? "opacity-55" : ""
      ].join(" ")}
    >
      {isLive && (
        <span className="absolute -top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-full bg-accent px-2 py-[3px] text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-bg-deep">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bg-deep" aria-hidden="true" />
          Now playing
        </span>
      )}

      <div className="overflow-hidden rounded-[7px]">
        <MatchSlot game={topGame} result={getSlotResult(match, topGame)} revealScores={revealScores} />
        <div className="h-px bg-white/[0.07]" />
        <MatchSlot game={bottomGame} result={getSlotResult(match, bottomGame)} revealScores={revealScores} />
      </div>
    </div>
  );
}
