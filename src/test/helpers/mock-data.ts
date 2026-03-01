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
 * Default: 21 games (initial pair + 19 challengers).
 * Left game (g1) has score 600, right game (g2) has score 500.
 * Challengers have descending scores from 490 to 310.
 */
export function createMockRunResponse(
  overrides?: Partial<CreateRunResponse>
): CreateRunResponse {
  const leftGame = createGame({ id: "g1", name: "Game One", snapshotScore: 600, seedRank: 1 });
  const rightGame = createGame({ id: "g2", name: "Game Two", snapshotScore: 500, seedRank: 2 });

  const challengerIds = Array.from({ length: 19 }, (_, i) => `g${i + 3}`);
  const challengers = challengerIds.map((id, i) =>
    createGame({
      id,
      name: `Game ${id.toUpperCase()}`,
      snapshotScore: 490 - i * 10,
      seedRank: i + 3
    })
  );

  const games: Record<string, RunGame> = {
    [leftGame.id]: leftGame,
    [rightGame.id]: rightGame
  };
  for (const c of challengers) {
    games[c.id] = c;
  }

  const challengerQueue = challengerIds.map((id, i) => ({
    round: i + 2,
    gameId: id,
    bucket: `${10 + i * 10}-${20 + i * 10}`
  }));

  return {
    runId: "test-run-001",
    snapshotVersion: "2024-01-01T00:00:00.000Z",
    issuedAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2024-01-01T00:15:00.000Z",
    bandModel: "percentile.v1",
    initialPair: {
      leftGameId: "g1",
      rightGameId: "g2"
    },
    challengerQueue,
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
