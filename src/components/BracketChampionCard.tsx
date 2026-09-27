"use client";

import Image from "next/image";

import { getCoverUrl } from "@/components/BracketMatchCard";
import type { RunGame } from "@/lib/types";

type BracketChampionCardProps = {
  champion: RunGame | null;
};

function TrophyIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 4h10v4a5 5 0 0 1-10 0V4Z M7 6H4v1a3 3 0 0 0 3 3 M17 6h3v1a3 3 0 0 1-3 3 M12 13v4 M8 20h8 M9.5 17h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BracketChampionCard({ champion }: BracketChampionCardProps) {
  const coverUrl = getCoverUrl(champion);

  return (
    <div
      role="group"
      aria-label={champion ? `Champion: ${champion.name}` : "Champion to be decided"}
      className="flex w-full flex-col items-center text-center"
    >
      <div
        className={[
          "mb-2 flex items-center gap-1.5 font-display text-base uppercase leading-none tracking-[0.2em]",
          champion ? "text-gold" : "text-text-muted"
        ].join(" ")}
      >
        <TrophyIcon className="h-4 w-4" />
        Champion
      </div>

      <div
        className={[
          "relative h-[124px] w-[93px] overflow-hidden rounded-lg border-2",
          champion
            ? "border-gold shadow-[0_0_0_4px_rgba(251,191,36,0.12),0_0_36px_rgba(251,191,36,0.35)]"
            : "border-dashed border-white/15 bg-bg-elevated/40"
        ].join(" ")}
      >
        {champion && coverUrl ? (
          <Image src={coverUrl} alt="" fill sizes="220px" draggable={false} className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <TrophyIcon className="h-9 w-9 text-white/12" />
          </div>
        )}
      </div>

      <p
        className={[
          "mt-2 w-full truncate font-display text-xl leading-none",
          champion ? "text-text-primary" : "text-text-muted"
        ].join(" ")}
        title={champion?.name}
      >
        {champion?.name ?? "To be decided"}
      </p>
    </div>
  );
}
