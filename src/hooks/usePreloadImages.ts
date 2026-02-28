"use client";

import { useEffect } from "react";
import type { RunGame, RunChallenger } from "@/lib/types";

const PRELOAD_AHEAD = 3;

export function usePreloadImages(
  currentRound: number,
  challengerQueue: RunChallenger[],
  games: Record<string, RunGame>
) {
  useEffect(() => {
    const upcoming = challengerQueue
      .filter((c) => c.round > currentRound && c.round <= currentRound + PRELOAD_AHEAD)
      .map((c) => games[c.gameId]?.imageUrl)
      .filter((url): url is string => url != null);

    for (const url of upcoming) {
      const img = new Image();
      img.src = url;
    }
  }, [currentRound, challengerQueue, games]);
}
