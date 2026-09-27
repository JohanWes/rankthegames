import { getGamesCollection, type GameDoc } from "./collections.ts";

const DEFAULT_LEADERBOARD_LIMIT = 100;

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
