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
  getRoundBucketLabel,
  getScoreBasedParams,
  MAX_RUN_ROUNDS,
  RUN_BAND_MODEL,
  type LadderSnapshot
} from "./run-builder.ts";

function createSnapshot(): LadderSnapshot {
  const scores = [
    1080, 1050, 1020, 990, 960, 930, 900, 870, 840, 810,
    780, 760, 740, 720, 700, 680, 660, 640, 620, 600,
    580, 560, 540, 520, 500, 480, 460, 440, 420, 400
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
    1000, 995, 990, 985, 980, 975, 970, 965, 960, 955,
    950, 945, 940, 935, 930, 925, 920, 915, 910, 905
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

function parseCoreBucket(bucket: string) {
  const match = /^cluster:(\d+)-(\d+)$/.exec(bucket);

  if (!match) {
    throw new Error(`Expected a core cluster bucket, received ${bucket}.`);
  }

  return {
    minScore: Number(match[1]),
    maxScore: Number(match[2])
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

  it("builds runs around one score cluster with at most two controlled outliers", () => {
    vi.spyOn(Math, "random").mockImplementation(() => 0);

    const run = buildRunDefinition(createSnapshot());
    const firstCoreChallenger = run.challengerQueue.find((entry) => entry.bucket.startsWith("cluster:"));

    expect(run.bandModel).toBe(RUN_BAND_MODEL);
    expect(run.gameIds).toHaveLength(MAX_RUN_ROUNDS + 1);
    expect(new Set(run.gameIds).size).toBe(MAX_RUN_ROUNDS + 1);
    expect(firstCoreChallenger).toBeDefined();

    const coreWindow = parseCoreBucket(firstCoreChallenger!.bucket);
    const scores = run.gameIds.map((gameId) => run.games[gameId].snapshotScore);
    const coreScores = scores.filter(
      (score) => score >= coreWindow.minScore && score <= coreWindow.maxScore
    );
    const outlierBuckets = run.challengerQueue.filter((entry) => entry.bucket.startsWith("outlier:"));

    expect(coreScores.length).toBeGreaterThanOrEqual(9);
    expect(outlierBuckets.length).toBeLessThanOrEqual(2);

    for (const outlier of outlierBuckets) {
      const gap = Number(outlier.bucket.replace("outlier:", ""));
      expect(Math.abs(gap)).toBeGreaterThanOrEqual(125);
      expect(Math.abs(gap)).toBeLessThanOrEqual(400);
    }
  });

  it("keeps the opening pair within score-based gap bounds", () => {
    vi.spyOn(Math, "random").mockImplementation(() => 0);

    const run = buildRunDefinition(createSnapshot());
    const leftScore = run.games[run.initialPair.leftGameId].snapshotScore;
    const rightScore = run.games[run.initialPair.rightGameId].snapshotScore;
    const gap = Math.abs(leftScore - rightScore);

    expect(gap).toBeLessThanOrEqual(300);
    expect(getRoundBucketLabel(1, run.challengerQueue)).toBe("cluster:opening");
    expect(getRoundBucketLabel(2, run.challengerQueue)).toBe(run.challengerQueue[0].bucket);
  });

  it("produces tight gaps for high-tier game clusters", () => {
    vi.spyOn(Math, "random").mockImplementation(() => 0);

    const run = buildRunDefinition(createHighTierSnapshot());
    const leftScore = run.games[run.initialPair.leftGameId].snapshotScore;
    const rightScore = run.games[run.initialPair.rightGameId].snapshotScore;
    const gap = Math.abs(leftScore - rightScore);

    expect(gap).toBeLessThanOrEqual(40);
    expect(gap).toBeGreaterThanOrEqual(10);
  });
});
