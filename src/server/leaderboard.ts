import { z } from "zod";
import { getGamesCollection, type GameDoc } from "./collections.ts";

export const DEFAULT_LEADERBOARD_LIMIT = 100;
export const MAX_LEADERBOARD_LIMIT = 250;
export const LEADERBOARD_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=120";

export type LeaderboardItem = {
  id: string;
  name: string;
  year: number | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  currentScore: number;
  seedRank: number;
  wins: number;
  losses: number;
  totalMatches: number;
};

export type LeaderboardResponse = {
  items: LeaderboardItem[];
  generatedAt: string;
};

type LeaderboardProjection = Pick<
  GameDoc,
  "_id" | "name" | "year" | "currentScore" | "seedRank" | "wins" | "losses" | "totalMatches" | "cover"
>;

const limitSchema = z.coerce.number().int().min(1).max(MAX_LEADERBOARD_LIMIT).default(DEFAULT_LEADERBOARD_LIMIT);

export class LeaderboardQueryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LeaderboardQueryError";
    this.code = code;
  }
}

export async function getLeaderboard(limit = DEFAULT_LEADERBOARD_LIMIT): Promise<LeaderboardResponse> {
  const games = await getGamesCollection();
  const generatedAt = new Date().toISOString();
  const items = await games
    .find<LeaderboardProjection>(
      {},
      {
        projection: {
          _id: 1,
          name: 1,
          year: 1,
          currentScore: 1,
          seedRank: 1,
          wins: 1,
          losses: 1,
          totalMatches: 1,
          "cover.imageUrl": 1,
          "cover.thumbUrl": 1
        }
      }
    )
    .sort({ currentScore: -1, _id: 1 })
    .limit(limit)
    .toArray();

  return {
    items: items.map((game) => ({
      id: game._id.toString(),
      name: game.name,
      year: game.year ?? null,
      imageUrl: game.cover?.imageUrl ?? null,
      thumbUrl: game.cover?.thumbUrl ?? null,
      currentScore: game.currentScore,
      seedRank: game.seedRank,
      wins: game.wins,
      losses: game.losses,
      totalMatches: game.totalMatches
    })),
    generatedAt
  };
}

export function parseLeaderboardLimit(rawLimit: string | null) {
  const parsed = limitSchema.safeParse(rawLimit ?? undefined);

  if (!parsed.success) {
    throw new LeaderboardQueryError(
      "invalid_limit",
      `limit must be an integer between 1 and ${MAX_LEADERBOARD_LIMIT}.`
    );
  }

  return parsed.data;
}
