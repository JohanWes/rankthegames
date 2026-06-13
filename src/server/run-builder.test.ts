import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/env", () => ({
  env: {
    NODE_ENV: "test",
    MONGODB_URI: "mongodb://localhost:27017",
    MONGODB_DB_NAME: "test",
    RUN_TOKEN_SECRET: "test-secret-key-for-testing-only-32chars",
    IP_HASH_SALT: "test-salt-key-for-testing-only-32chars",
    IGDB_CLIENT_ID: "test-igdb-client-id",
    IGDB_CLIENT_SECRET: "test-igdb-client-secret"
  }
}));

import {
  buildRunDefinition,
  getScoreBasedParams,
  MAX_RUN_ROUNDS,
  RUN_BAND_MODEL,
  type LadderSnapshot
} from "./run-builder.ts";
import { OPENING_BRACKET_ROUNDS } from "../lib/bracket.ts";

function createSnapshot(): LadderSnapshot {
  const scores = [
    1080, 1050, 1020, 990, 960, 930, 900, 870, 840, 810,
    780, 760, 740, 720, 700, 680, 660, 640, 620, 600,
    580, 560, 540, 520, 500, 480, 460, 440, 420, 400,
    380, 360, 340, 320, 300, 280, 260, 240, 220, 200
  ];

  return {
    snapshotVersion: "2026-02-28T00:00:00.000Z",
    builtAt: new Date("2026-02-28T00:00:00.000Z"),
    expiresAt: Date.now() + 30_000,
    games: scores.map((score, index) => ({
      id: `g${index + 1}`,
      name: `Game ${index + 1}`,
      year: 2000 + (index % 20),
      seedRank: index + 1,
      snapshotScore: score,
      totalAppearances: 0,
      imageUrl: null,
      thumbUrl: null,
      percentileFromBottom: Number((((scores.length - index) / scores.length) * 100).toFixed(3))
    }))
  };
}

function createHighTierSnapshot(): LadderSnapshot {
  const scores = [
    1000, 997, 994, 991, 988, 985, 982, 979, 976, 973,
    970, 967, 964, 961, 958, 955, 952, 949, 946, 943,
    940, 937, 934, 931, 928, 925, 922, 919, 916, 913
  ];

  return {
    snapshotVersion: "2026-02-28T00:00:00.000Z",
    builtAt: new Date("2026-02-28T00:00:00.000Z"),
    expiresAt: Date.now() + 30_000,
    games: scores.map((score, index) => ({
      id: `h${index + 1}`,
      name: `HighTier ${index + 1}`,
      year: 2020,
      seedRank: index + 1,
      snapshotScore: score,
      totalAppearances: 0,
      imageUrl: null,
      thumbUrl: null,
      percentileFromBottom: Number((((scores.length - index) / scores.length) * 100).toFixed(3))
    }))
  };
}

function createLargeSnapshot(): LadderSnapshot {
  const totalGames = 800;
  const games = Array.from({ length: totalGames }, (_, index) => {
    const seedRank = index + 1;
    return {
      id: `l${seedRank}`,
      name: `Large Game ${seedRank}`,
      year: 2000 + (index % 24),
      seedRank,
      snapshotScore: 1000 - index,
      totalAppearances: seedRank > 650 ? 0 : index % 8,
      imageUrl: null,
      thumbUrl: null,
      percentileFromBottom: Number((((totalGames - index) / totalGames) * 100).toFixed(3))
    };
  });

  return {
    snapshotVersion: "2026-02-28T00:00:00.000Z",
    builtAt: new Date("2026-02-28T00:00:00.000Z"),
    expiresAt: Date.now() + 30_000,
    games
  };
}

describe("getScoreBasedParams", () => {
  it("returns wide gaps for low-rated anchors", () => {
    const params = getScoreBasedParams(400);
    expect(params.coreScoreRadius).toBe(150);
    expect(params.startingPairMinGap).toBe(80);
    expect(params.startingPairMaxGap).toBe(300);
    expect(params.startingPairPreferredGap).toBe(175);
  });

  it("returns mid-tier values at score 700", () => {
    const params = getScoreBasedParams(700);
    expect(params.coreScoreRadius).toBe(80);
    expect(params.startingPairMinGap).toBe(60);
    expect(params.startingPairMaxGap).toBe(150);
    expect(params.startingPairPreferredGap).toBe(100);
  });

  it("returns tight gaps for high-rated anchors", () => {
    const params = getScoreBasedParams(900);
    expect(params.coreScoreRadius).toBe(30);
    expect(params.startingPairMinGap).toBe(10);
    expect(params.startingPairMaxGap).toBe(40);
    expect(params.startingPairPreferredGap).toBe(25);
  });

  it("interpolates between breakpoints", () => {
    const params = getScoreBasedParams(550);
    expect(params.coreScoreRadius).toBe(115);
    expect(params.startingPairPreferredGap).toBe(138);
  });

  it("clamps below minimum score", () => {
    const params = getScoreBasedParams(200);
    expect(params).toEqual(getScoreBasedParams(400));
  });

  it("clamps above maximum score", () => {
    const params = getScoreBasedParams(1100);
    expect(params).toEqual(getScoreBasedParams(900));
  });
});

describe("buildRunDefinition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds an 8-pair opening bracket for a 15-round tournament", () => {
    vi.spyOn(Math, "random").mockImplementation(() => 0);

    const run = buildRunDefinition(createSnapshot());

    expect(run.bandModel).toBe(RUN_BAND_MODEL);
    expect(MAX_RUN_ROUNDS).toBe(15);
    expect(run.roundPairs).toHaveLength(OPENING_BRACKET_ROUNDS);
    expect(run.gameIds).toHaveLength(16);
    expect(run.initialPair).toEqual({
      leftGameId: run.roundPairs[0].leftGameId,
      rightGameId: run.roundPairs[0].rightGameId
    });
    expect(new Set(run.gameIds).size).toBe(run.gameIds.length);

    for (const pair of run.roundPairs) {
      expect(pair.leftGameId).not.toBe(pair.rightGameId);
      expect(run.gameIds).toContain(pair.leftGameId);
      expect(run.gameIds).toContain(pair.rightGameId);
    }
  });

  it("keeps warmup rounds recognizable and reasonably gapped", () => {
    vi.spyOn(Math, "random").mockImplementation(() => 0);

    const snapshot = createLargeSnapshot();
    const run = buildRunDefinition(snapshot);
    const gamesById = new Map(snapshot.games.map((game) => [game.id, game]));

    for (const pair of run.roundPairs.slice(0, 4)) {
      const left = gamesById.get(pair.leftGameId)!;
      const right = gamesById.get(pair.rightGameId)!;
      const gap = Math.abs(left.snapshotScore - right.snapshotScore);

      expect(left.seedRank).toBeLessThanOrEqual(250);
      expect(right.seedRank).toBeLessThanOrEqual(250);
      expect(gap).toBeLessThanOrEqual(220);
    }
  });

  it("caps discovery rounds and anchors deep cuts", () => {
    vi.spyOn(Math, "random").mockImplementation(() => 0);

    const snapshot = createLargeSnapshot();
    const run = buildRunDefinition(snapshot);
    const gamesById = new Map(snapshot.games.map((game) => [game.id, game]));
    const discoveryPairs = run.roundPairs.filter((pair) => pair.bucket === "discovery:anchored");
    const deepCutVsDeepCutPairs = run.roundPairs.filter((pair) => {
      const left = gamesById.get(pair.leftGameId)!;
      const right = gamesById.get(pair.rightGameId)!;
      return left.seedRank >= 650 && right.seedRank >= 650;
    });

    expect(discoveryPairs.length).toBeLessThanOrEqual(5);
    expect(deepCutVsDeepCutPairs.length).toBeLessThanOrEqual(1);

    for (const pair of discoveryPairs) {
      const left = gamesById.get(pair.leftGameId)!;
      const right = gamesById.get(pair.rightGameId)!;
      expect(left.seedRank <= 500 || right.seedRank <= 500).toBe(true);
    }
  });

  it("randomizes fixed pair side placement", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValue(0.75);

    const run = buildRunDefinition(createHighTierSnapshot());
    const hasHigherRatedRight = run.roundPairs.some((pair) => {
      const leftScore = run.games[pair.leftGameId].snapshotScore;
      const rightScore = run.games[pair.rightGameId].snapshotScore;
      return rightScore > leftScore;
    });

    expect(hasHigherRatedRight).toBe(true);
  });
});
