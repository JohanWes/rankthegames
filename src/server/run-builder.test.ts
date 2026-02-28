import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRunDefinition,
  getRoundBucketLabel,
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
      expect(Math.abs(gap)).toBeGreaterThanOrEqual(200);
      expect(Math.abs(gap)).toBeLessThanOrEqual(400);
    }
  });

  it("keeps the opening pair close and exposes round bucket labels for persistence", () => {
    vi.spyOn(Math, "random").mockImplementation(() => 0);

    const run = buildRunDefinition(createSnapshot());
    const leftScore = run.games[run.initialPair.leftGameId].snapshotScore;
    const rightScore = run.games[run.initialPair.rightGameId].snapshotScore;

    expect(Math.abs(leftScore - rightScore)).toBeLessThanOrEqual(125);
    expect(getRoundBucketLabel(1, run.challengerQueue)).toBe("cluster:opening");
    expect(getRoundBucketLabel(2, run.challengerQueue)).toBe(run.challengerQueue[0].bucket);
  });
});
