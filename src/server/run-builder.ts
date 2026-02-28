import { randomUUID } from "node:crypto";
import { getGamesCollection } from "./collections.ts";

const LADDER_SNAPSHOT_TTL_MS = 30_000;
export const MAX_RUN_ROUNDS = 10;
const SELECTION_POOL_SIZE = 20;
const STARTING_PAIR_MAX_SCORE_GAP = 150;
const EXPANSION_STEP_PERCENTILE = 5;
const MAX_BUCKET_EXPANSIONS = 3;

export const RUN_BAND_MODEL = "percentile.v1";

type BucketWindow = {
  minPercentile: number;
  maxPercentile: number;
};

type BucketDefinition = {
  round: number;
  target: BucketWindow;
};

export type LadderSnapshotGame = {
  id: string;
  name: string;
  year: number | null;
  seedRank: number;
  snapshotScore: number;
  totalAppearances: number;
  imageUrl: string | null;
  thumbUrl: string | null;
  percentileFromBottom: number;
};

export type LadderSnapshot = {
  snapshotVersion: string;
  builtAt: Date;
  expiresAt: number;
  games: LadderSnapshotGame[];
};

export type RunGamePayload = {
  id: string;
  name: string;
  year: number | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  snapshotScore: number;
  seedRank: number;
};

export type BuiltRunDefinition = {
  runId: string;
  snapshotVersion: string;
  bandModel: typeof RUN_BAND_MODEL;
  initialPair: {
    leftGameId: string;
    rightGameId: string;
  };
  challengerQueue: Array<{
    round: number;
    gameId: string;
    bucket: string;
  }>;
  games: Record<string, RunGamePayload>;
  snapshotScores: Record<string, number>;
  gameIds: string[];
};

const RUN_BUCKETS: BucketDefinition[] = [
  { round: 1, target: { minPercentile: 8, maxPercentile: 15 } },
  { round: 2, target: { minPercentile: 13, maxPercentile: 23 } },
  { round: 3, target: { minPercentile: 20, maxPercentile: 30 } },
  { round: 4, target: { minPercentile: 27, maxPercentile: 38 } },
  { round: 5, target: { minPercentile: 35, maxPercentile: 48 } },
  { round: 6, target: { minPercentile: 45, maxPercentile: 58 } },
  { round: 7, target: { minPercentile: 55, maxPercentile: 70 } },
  { round: 8, target: { minPercentile: 65, maxPercentile: 80 } },
  { round: 9, target: { minPercentile: 78, maxPercentile: 90 } },
  { round: 10, target: { minPercentile: 88, maxPercentile: 100 } }
];

const RUN_BUCKET_LABELS = RUN_BUCKETS.map((bucket) => formatBucketWindow(bucket.target));

let cachedLadderSnapshot: LadderSnapshot | null = null;
let ladderSnapshotPromise: Promise<LadderSnapshot> | null = null;

export async function createRunDefinition(): Promise<BuiltRunDefinition> {
  const snapshot = await getLadderSnapshot();
  return buildRunDefinition(snapshot);
}

export function getRoundBucketLabel(round: number, challengerQueue?: Array<{ round: number; bucket: string }>) {
  if (round === 1) {
    return RUN_BUCKET_LABELS[0];
  }

  const challenger = challengerQueue?.find((entry) => entry.round === round);

  if (!challenger) {
    throw new RangeError(`No issued challenger bucket was found for round ${round}.`);
  }

  return challenger.bucket;
}

export async function getLadderSnapshot(now = Date.now()): Promise<LadderSnapshot> {
  if (cachedLadderSnapshot && cachedLadderSnapshot.expiresAt > now) {
    return cachedLadderSnapshot;
  }

  if (!ladderSnapshotPromise) {
    ladderSnapshotPromise = buildLadderSnapshot(now).finally(() => {
      ladderSnapshotPromise = null;
    });
  }

  const snapshot = await ladderSnapshotPromise;

  if (!cachedLadderSnapshot || cachedLadderSnapshot.expiresAt <= now) {
    cachedLadderSnapshot = snapshot;
  }

  return snapshot;
}

async function buildLadderSnapshot(nowMs: number): Promise<LadderSnapshot> {
  const games = await getGamesCollection();
  const builtAt = new Date(nowMs);
  const sourceGames = await games
    .find<{
      _id: { toString(): string };
      name: string;
      year?: number | null;
      seedRank: number;
      currentScore: number;
      totalAppearances: number;
      cover?: {
        imageUrl?: string | null;
        thumbUrl?: string | null;
      };
    }>(
      {},
      {
        projection: {
          _id: 1,
          name: 1,
          year: 1,
          seedRank: 1,
          currentScore: 1,
          totalAppearances: 1,
          "cover.imageUrl": 1,
          "cover.thumbUrl": 1
        }
      }
    )
    .sort({ currentScore: -1, _id: 1 })
    .toArray();

  if (sourceGames.length < 2) {
    throw new Error("At least two games are required to create a run.");
  }

  const snapshotGames = sourceGames.map((game, index) => ({
    id: game._id.toString(),
    name: game.name,
    year: game.year ?? null,
    seedRank: game.seedRank,
    snapshotScore: game.currentScore,
    totalAppearances: game.totalAppearances,
    imageUrl: game.cover?.imageUrl ?? null,
    thumbUrl: game.cover?.thumbUrl ?? null,
    percentileFromBottom: getPercentileFromBottom(index, sourceGames.length)
  }));

  return {
    snapshotVersion: builtAt.toISOString(),
    builtAt,
    expiresAt: nowMs + LADDER_SNAPSHOT_TTL_MS,
    games: snapshotGames
  };
}

function buildRunDefinition(snapshot: LadderSnapshot): BuiltRunDefinition {
  if (snapshot.games.length < MAX_RUN_ROUNDS + 1) {
    throw new Error("Not enough games are available to build a full run.");
  }

  const usedGameIds = new Set<string>();
  const issuedGameIds: string[] = [];
  const initialRange = resolveCandidateRange(snapshot.games, RUN_BUCKETS[0].target, usedGameIds, 2);
  const initialPair = pickStartingPair(initialRange.candidates);

  usedGameIds.add(initialPair.left.id);
  usedGameIds.add(initialPair.right.id);
  issuedGameIds.push(initialPair.left.id, initialPair.right.id);

  const challengerQueue = RUN_BUCKETS.slice(1).map((bucketDefinition) => {
    const resolvedRange = resolveCandidateRange(
      snapshot.games,
      bucketDefinition.target,
      usedGameIds,
      1
    );
    const challenger = pickCandidate(resolvedRange.candidates);

    usedGameIds.add(challenger.id);
    issuedGameIds.push(challenger.id);

    return {
      round: bucketDefinition.round,
      gameId: challenger.id,
      bucket: formatBucketWindow(resolvedRange.window)
    };
  });

  const games = Object.fromEntries(
    issuedGameIds.map((gameId) => {
      const game = snapshot.games.find((candidate) => candidate.id === gameId);

      if (!game) {
        throw new Error(`Issued game ${gameId} is missing from the ladder snapshot.`);
      }

      return [
        gameId,
        {
          id: game.id,
          name: game.name,
          year: game.year,
          imageUrl: game.imageUrl,
          thumbUrl: game.thumbUrl,
          snapshotScore: game.snapshotScore,
          seedRank: game.seedRank
        } satisfies RunGamePayload
      ];
    })
  );

  const snapshotScores = Object.fromEntries(
    issuedGameIds.map((gameId) => [gameId, games[gameId].snapshotScore])
  );

  return {
    runId: randomUUID(),
    snapshotVersion: snapshot.snapshotVersion,
    bandModel: RUN_BAND_MODEL,
    initialPair: {
      leftGameId: initialPair.left.id,
      rightGameId: initialPair.right.id
    },
    challengerQueue,
    games,
    snapshotScores,
    gameIds: issuedGameIds
  };
}

function resolveCandidateRange(
  games: LadderSnapshotGame[],
  target: BucketWindow,
  usedGameIds: Set<string>,
  minimumCount: number
) {
  for (let expansion = 0; expansion <= MAX_BUCKET_EXPANSIONS; expansion += 1) {
    const window = widenBucketWindow(target, expansion * EXPANSION_STEP_PERCENTILE);
    const candidates = getEligibleCandidates(games, window, usedGameIds);

    if (candidates.length >= minimumCount) {
      return { window, candidates };
    }
  }

  const fallback = findNearestNeighboringWindow(games, target, usedGameIds, minimumCount);

  if (!fallback) {
    throw new Error(`Unable to find enough games for bucket ${formatBucketWindow(target)}.`);
  }

  return fallback;
}

function findNearestNeighboringWindow(
  games: LadderSnapshotGame[],
  target: BucketWindow,
  usedGameIds: Set<string>,
  minimumCount: number
) {
  for (let offset = EXPANSION_STEP_PERCENTILE; offset <= 100; offset += EXPANSION_STEP_PERCENTILE) {
    const candidateWindows = [
      shiftBucketWindow(target, -offset),
      shiftBucketWindow(target, offset)
    ].filter((window): window is BucketWindow => window !== null);

    for (const window of candidateWindows) {
      const candidates = getEligibleCandidates(games, window, usedGameIds);

      if (candidates.length >= minimumCount) {
        return { window, candidates };
      }
    }
  }

  return null;
}

function getEligibleCandidates(
  games: LadderSnapshotGame[],
  window: BucketWindow,
  usedGameIds: Set<string>
) {
  return games.filter(
    (game) =>
      game.percentileFromBottom >= window.minPercentile &&
      game.percentileFromBottom <= window.maxPercentile &&
      !usedGameIds.has(game.id)
  );
}

function pickStartingPair(candidates: LadderSnapshotGame[]) {
  const prioritizedPool = prioritizeCandidates(candidates).slice(0, SELECTION_POOL_SIZE);

  if (prioritizedPool.length < 2) {
    throw new Error("Not enough eligible games were available to choose an opening pair.");
  }

  const compatiblePairs: Array<[LadderSnapshotGame, LadderSnapshotGame]> = [];

  for (let leftIndex = 0; leftIndex < prioritizedPool.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < prioritizedPool.length; rightIndex += 1) {
      const left = prioritizedPool[leftIndex];
      const right = prioritizedPool[rightIndex];

      if (Math.abs(left.snapshotScore - right.snapshotScore) <= STARTING_PAIR_MAX_SCORE_GAP) {
        compatiblePairs.push([left, right]);
      }
    }
  }

  const [first, second] = compatiblePairs.length > 0 ? sample(compatiblePairs) : sampleAllPairs(prioritizedPool);

  return Math.random() < 0.5
    ? { left: first, right: second }
    : { left: second, right: first };
}

function sampleAllPairs(pool: LadderSnapshotGame[]) {
  const pairCount = (pool.length * (pool.length - 1)) / 2;
  const targetPairIndex = Math.floor(Math.random() * pairCount);
  let currentPairIndex = 0;

  for (let leftIndex = 0; leftIndex < pool.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < pool.length; rightIndex += 1) {
      if (currentPairIndex === targetPairIndex) {
        return [pool[leftIndex], pool[rightIndex]] as const;
      }

      currentPairIndex += 1;
    }
  }

  throw new Error("Unable to sample a starting pair.");
}

function pickCandidate(candidates: LadderSnapshotGame[]) {
  const prioritizedPool = prioritizeCandidates(candidates).slice(0, SELECTION_POOL_SIZE);

  if (prioritizedPool.length === 0) {
    throw new Error("No eligible candidates were available for this round.");
  }

  return sample(prioritizedPool);
}

function prioritizeCandidates(candidates: LadderSnapshotGame[]) {
  return [...candidates].sort((left, right) => {
    if (left.totalAppearances !== right.totalAppearances) {
      return left.totalAppearances - right.totalAppearances;
    }

    if (left.snapshotScore !== right.snapshotScore) {
      return left.snapshotScore - right.snapshotScore;
    }

    return left.id.localeCompare(right.id);
  });
}

function sample<T>(values: readonly T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function getPercentileFromBottom(index: number, totalGames: number) {
  return Number((((totalGames - index) / totalGames) * 100).toFixed(3));
}

function widenBucketWindow(window: BucketWindow, delta: number): BucketWindow {
  return {
    minPercentile: Math.max(0, window.minPercentile - delta),
    maxPercentile: Math.min(100, window.maxPercentile + delta)
  };
}

function shiftBucketWindow(window: BucketWindow, delta: number): BucketWindow | null {
  const width = window.maxPercentile - window.minPercentile;
  const shiftedMin = window.minPercentile + delta;
  const shiftedMax = window.maxPercentile + delta;

  if (shiftedMax <= 0 || shiftedMin >= 100) {
    return null;
  }

  const minPercentile = Math.max(0, shiftedMin);
  const maxPercentile = Math.min(100, shiftedMax);

  if (maxPercentile - minPercentile < width / 2) {
    return null;
  }

  return { minPercentile, maxPercentile };
}

function formatBucketWindow(window: BucketWindow) {
  return `${formatPercentile(window.minPercentile)}-${formatPercentile(window.maxPercentile)}`;
}

function formatPercentile(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}
