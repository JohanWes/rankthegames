import type {
  CreateRunResponse,
  RunGame,
  LeaderboardResponse
} from "@/lib/types";

function createGame(overrides: Partial<RunGame> & { id: string }): RunGame {
  return {
    name: `Game ${overrides.id}`,
    year: 2020,
    imageUrl: `https://images.igdb.com/igdb/image/upload/t_cover_big/${overrides.id}.jpg`,
    thumbUrl: `https://images.igdb.com/igdb/image/upload/t_thumb/${overrides.id}.jpg`,
    snapshotScore: 500,
    seedRank: 1,
    ...overrides
  };
}

/**
 * Create a deterministic mock run response.
 *
 * Default: 16 games in 8 opening bracket pairs.
 * Scores descend from g1 so repeatedly choosing the higher-seeded visible game
 * can complete the bracket.
 */
export function createMockRunResponse(
  overrides?: Partial<CreateRunResponse>
): CreateRunResponse {
  const gameList = Array.from({ length: 16 }, (_, index) =>
    createGame({
      id: `g${index + 1}`,
      name: index === 0 ? "Game One" : index === 1 ? "Game Two" : `Game G${index + 1}`,
      snapshotScore: 600 - index * 10,
      seedRank: index + 1
    })
  );

  const games = Object.fromEntries(gameList.map((game) => [game.id, game]));
  const challengerQueue: CreateRunResponse["challengerQueue"] = [];
  const roundPairs = Array.from({ length: 8 }, (_, index) => ({
    round: index + 1,
    leftGameId: `g${index * 2 + 1}`,
    rightGameId: `g${index * 2 + 2}`,
    bucket: "bracket:opening"
  }));

  return {
    runId: "test-run-001",
    snapshotVersion: "2024-01-01T00:00:00.000Z",
    issuedAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2024-01-01T00:15:00.000Z",
    bandModel: "percentile.v1",
    initialPair: {
      leftGameId: roundPairs[0].leftGameId,
      rightGameId: roundPairs[0].rightGameId
    },
    challengerQueue,
    roundPairs,
    games,
    signedRunToken: "mock-signed-token",
    ...overrides
  };
}

export function createMockLeaderboardResponse(): LeaderboardResponse {
  return {
    items: [
      {
        id: "lb1",
        name: "Top Game",
        year: 2023,
        imageUrl: null,
        thumbUrl: null,
        currentScore: 1200,
        seedRank: 1,
        wins: 50,
        losses: 10,
        totalMatches: 60
      },
      {
        id: "lb2",
        name: "Second Game",
        year: 2022,
        imageUrl: null,
        thumbUrl: null,
        currentScore: 1100,
        seedRank: 2,
        wins: 40,
        losses: 15,
        totalMatches: 55
      },
      {
        id: "lb3",
        name: "Third Game",
        year: 2021,
        imageUrl: null,
        thumbUrl: null,
        currentScore: 1000,
        seedRank: 3,
        wins: 30,
        losses: 20,
        totalMatches: 50
      }
    ],
    generatedAt: "2024-01-01T00:00:00.000Z"
  };
}
