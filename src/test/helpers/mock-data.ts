import type { CreateRunResponse, RunGame } from "@/lib/types";

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
  const roundPairs = Array.from({ length: 8 }, (_, index) => ({
    round: index + 1,
    leftGameId: `g${index * 2 + 1}`,
    rightGameId: `g${index * 2 + 2}`,
    bucket: "bracket:opening"
  }));

  return {
    runId: "test-run-001",
    expiresAt: "2024-01-01T02:00:00.000Z",
    roundPairs,
    games,
    signedRunToken: "mock-signed-token",
    ...overrides
  };
}
