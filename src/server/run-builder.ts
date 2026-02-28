import { randomUUID } from "node:crypto";
import { getGamesCollection } from "./collections.ts";

const LADDER_SNAPSHOT_TTL_MS = 30_000;
export const MAX_RUN_ROUNDS = 10;
const SELECTION_POOL_SIZE = 20;
const STARTING_PAIR_MAX_SCORE_GAP = 125;
const CORE_SCORE_RADIUS = 100;
const CORE_RADIUS_EXPANSION_STEP = 25;
const MAX_CORE_SCORE_RADIUS = 175;
const OUTLIER_MIN_SCORE_GAP = 200;
const OUTLIER_MAX_SCORE_GAP = 400;
const MAX_OUTLIERS_PER_RUN = 2;
const ANCHOR_MIN_PERCENTILE = 15;
const ANCHOR_MAX_PERCENTILE = 85;
const OPENING_BUCKET_LABEL = "cluster:opening";

export const RUN_BAND_MODEL = "score_cluster.v1";

type ScoreWindow = {
  minScore: number;
  maxScore: number;
};

type ClusterPlan = {
  anchorGame: LadderSnapshotGame;
  anchorScore: number;
  coreWindow: ScoreWindow;
  coreCandidates: LadderSnapshotGame[];
  outlierCandidates: LadderSnapshotGame[];
  desiredOutlierCount: number;
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

let cachedLadderSnapshot: LadderSnapshot | null = null;
let ladderSnapshotPromise: Promise<LadderSnapshot> | null = null;

export async function createRunDefinition(): Promise<BuiltRunDefinition> {
  const snapshot = await getLadderSnapshot();
  return buildRunDefinition(snapshot);
}

export function getRoundBucketLabel(round: number, challengerQueue?: Array<{ round: number; bucket: string }>) {
  if (round === 1) {
    return OPENING_BUCKET_LABEL;
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
  let sourceGames: Array<{
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
  }>;

  try {
    sourceGames = await games
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
  } catch (error) {
    console.error("Failed to load games for ladder snapshot.", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }

  if (sourceGames.length < 2) {
    console.error("Insufficient games available to create a run.", {
      gameCount: sourceGames.length
    });
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

export function buildRunDefinition(snapshot: LadderSnapshot): BuiltRunDefinition {
  if (snapshot.games.length < MAX_RUN_ROUNDS + 1) {
    throw new Error("Not enough games are available to build a full run.");
  }

  const usedGameIds = new Set<string>();
  const issuedGameIds: string[] = [];
  const clusterPlan = buildClusterPlan(snapshot.games);
  const initialPair = pickStartingPair(clusterPlan.coreCandidates);

  usedGameIds.add(initialPair.left.id);
  usedGameIds.add(initialPair.right.id);
  issuedGameIds.push(initialPair.left.id, initialPair.right.id);

  const outlierSelections = pickOutlierCandidates(clusterPlan, usedGameIds);
  for (const outlier of outlierSelections) {
    usedGameIds.add(outlier.id);
  }

  const coreChallengerCount = MAX_RUN_ROUNDS - 1 - outlierSelections.length;
  const coreChallengers = pickDistinctCandidates(
    prioritizeCoreCandidates(clusterPlan.coreCandidates, clusterPlan.anchorScore).filter(
      (candidate) => !usedGameIds.has(candidate.id)
    ),
    coreChallengerCount
  );

  for (const challenger of coreChallengers) {
    usedGameIds.add(challenger.id);
  }

  const challengerEntries = arrangeChallengers(
    coreChallengers,
    outlierSelections,
    clusterPlan.coreWindow,
    clusterPlan.anchorScore
  );

  const challengerQueue = challengerEntries.map((entry, index) => {
    issuedGameIds.push(entry.game.id);

    return {
      round: index + 2,
      gameId: entry.game.id,
      bucket: entry.bucket
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

function buildClusterPlan(games: LadderSnapshotGame[]): ClusterPlan {
  const totalGamesNeeded = MAX_RUN_ROUNDS + 1;
  const anchorCandidates = getAnchorCandidates(games);

  for (
    let scoreRadius = CORE_SCORE_RADIUS;
    scoreRadius <= MAX_CORE_SCORE_RADIUS;
    scoreRadius += CORE_RADIUS_EXPANSION_STEP
  ) {
    const viablePlans = anchorCandidates
      .map((anchorGame) => {
        const coreWindow = {
          minScore: Math.max(1, anchorGame.snapshotScore - scoreRadius),
          maxScore: anchorGame.snapshotScore + scoreRadius
        };
        const coreCandidates = games.filter((game) =>
          isScoreInWindow(game.snapshotScore, coreWindow)
        );
        const outlierCandidates = games.filter((game) =>
          isOutlierCandidate(game, anchorGame.snapshotScore, coreWindow)
        );
        const desiredOutlierCount = determineOutlierCount(
          coreCandidates.length,
          outlierCandidates.length,
          totalGamesNeeded
        );

        if (coreCandidates.length < totalGamesNeeded - desiredOutlierCount) {
          return null;
        }

        return {
          anchorGame,
          anchorScore: anchorGame.snapshotScore,
          coreWindow,
          coreCandidates,
          outlierCandidates,
          desiredOutlierCount
        } satisfies ClusterPlan;
      })
      .filter((plan): plan is ClusterPlan => plan !== null)
      .sort((left, right) => {
        if (left.desiredOutlierCount !== right.desiredOutlierCount) {
          return right.desiredOutlierCount - left.desiredOutlierCount;
        }

        if (left.anchorGame.totalAppearances !== right.anchorGame.totalAppearances) {
          return left.anchorGame.totalAppearances - right.anchorGame.totalAppearances;
        }

        const leftCentrality = Math.abs(left.anchorGame.percentileFromBottom - 50);
        const rightCentrality = Math.abs(right.anchorGame.percentileFromBottom - 50);

        if (leftCentrality !== rightCentrality) {
          return leftCentrality - rightCentrality;
        }

        return left.anchorGame.id.localeCompare(right.anchorGame.id);
      });

    if (viablePlans.length > 0) {
      return sample(viablePlans.slice(0, Math.min(SELECTION_POOL_SIZE, viablePlans.length)));
    }
  }

  throw new Error("Unable to build a clustered run pool from the current ladder snapshot.");
}

function getAnchorCandidates(games: LadderSnapshotGame[]) {
  const prioritized = prioritizeByExposure(games).filter(
    (game) =>
      game.percentileFromBottom >= ANCHOR_MIN_PERCENTILE &&
      game.percentileFromBottom <= ANCHOR_MAX_PERCENTILE
  );

  return prioritized.length > 0 ? prioritized : prioritizeByExposure(games);
}

function determineOutlierCount(coreCount: number, outlierCount: number, totalGamesNeeded: number) {
  for (let desiredCount = MAX_OUTLIERS_PER_RUN; desiredCount >= 0; desiredCount -= 1) {
    if (outlierCount >= desiredCount && coreCount >= totalGamesNeeded - desiredCount) {
      return desiredCount;
    }
  }

  return 0;
}

function isScoreInWindow(score: number, window: ScoreWindow) {
  return score >= window.minScore && score <= window.maxScore;
}

function isOutlierCandidate(game: LadderSnapshotGame, anchorScore: number, coreWindow: ScoreWindow) {
  const scoreGap = Math.abs(game.snapshotScore - anchorScore);

  return (
    !isScoreInWindow(game.snapshotScore, coreWindow) &&
    scoreGap >= OUTLIER_MIN_SCORE_GAP &&
    scoreGap <= OUTLIER_MAX_SCORE_GAP
  );
}

function pickStartingPair(candidates: LadderSnapshotGame[]) {
  const prioritizedPool = prioritizeByExposure(candidates).slice(0, SELECTION_POOL_SIZE);

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

function pickOutlierCandidates(plan: ClusterPlan, usedGameIds: Set<string>) {
  if (plan.desiredOutlierCount === 0) {
    return [] as LadderSnapshotGame[];
  }

  const lowerOutliers = prioritizeOutlierCandidates(
    plan.outlierCandidates.filter(
      (game) => game.snapshotScore < plan.coreWindow.minScore && !usedGameIds.has(game.id)
    ),
    plan.anchorScore
  );
  const higherOutliers = prioritizeOutlierCandidates(
    plan.outlierCandidates.filter(
      (game) => game.snapshotScore > plan.coreWindow.maxScore && !usedGameIds.has(game.id)
    ),
    plan.anchorScore
  );
  const selections: LadderSnapshotGame[] = [];

  if (plan.desiredOutlierCount === 2 && lowerOutliers.length > 0 && higherOutliers.length > 0) {
    selections.push(sample(lowerOutliers.slice(0, Math.min(SELECTION_POOL_SIZE, lowerOutliers.length))));
    selections.push(
      sample(higherOutliers.slice(0, Math.min(SELECTION_POOL_SIZE, higherOutliers.length)))
    );
    return selections;
  }

  const combined = prioritizeOutlierCandidates(
    [...lowerOutliers, ...higherOutliers],
    plan.anchorScore
  );

  return pickDistinctCandidates(combined, plan.desiredOutlierCount);
}

function arrangeChallengers(
  coreChallengers: LadderSnapshotGame[],
  outlierSelections: LadderSnapshotGame[],
  coreWindow: ScoreWindow,
  anchorScore: number
) {
  const entries = coreChallengers.map((game) => ({
    game,
    bucket: formatCoreBucketWindow(coreWindow)
  }));

  if (outlierSelections.length === 0) {
    return entries;
  }

  const insertionIndexes = getOutlierInsertionIndexes(entries.length, outlierSelections.length);

  outlierSelections.forEach((game, index) => {
    const insertionIndex = Math.min(insertionIndexes[index], entries.length);
    entries.splice(insertionIndex, 0, {
      game,
      bucket: formatOutlierBucket(game.snapshotScore, anchorScore)
    });
  });

  return entries;
}

function getOutlierInsertionIndexes(coreCount: number, outlierCount: number) {
  if (outlierCount === 1) {
    return [Math.max(1, Math.floor(coreCount / 2))];
  }

  return [
    Math.max(1, Math.floor(coreCount / 3)),
    Math.max(2, Math.floor((coreCount * 2) / 3) + 1)
  ];
}

function pickDistinctCandidates(candidates: LadderSnapshotGame[], count: number) {
  if (count === 0) {
    return [] as LadderSnapshotGame[];
  }

  const selectionPool = candidates.slice(0, Math.max(count, Math.min(SELECTION_POOL_SIZE, candidates.length)));

  if (selectionPool.length < count) {
    throw new Error("Not enough eligible games were available to fill the run definition.");
  }

  return sampleWithoutReplacement(selectionPool, count);
}

function sampleWithoutReplacement<T>(values: readonly T[], count: number) {
  const pool = [...values];
  const selected: T[] = [];

  while (selected.length < count) {
    const nextIndex = Math.floor(Math.random() * pool.length);
    const [nextValue] = pool.splice(nextIndex, 1);
    selected.push(nextValue);
  }

  return selected;
}

function prioritizeCoreCandidates(candidates: LadderSnapshotGame[], anchorScore: number) {
  return [...candidates].sort((left, right) => {
    if (left.totalAppearances !== right.totalAppearances) {
      return left.totalAppearances - right.totalAppearances;
    }

    const leftDistance = Math.abs(left.snapshotScore - anchorScore);
    const rightDistance = Math.abs(right.snapshotScore - anchorScore);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    if (left.snapshotScore !== right.snapshotScore) {
      return left.snapshotScore - right.snapshotScore;
    }

    return left.id.localeCompare(right.id);
  });
}

function prioritizeOutlierCandidates(candidates: LadderSnapshotGame[], anchorScore: number) {
  return [...candidates].sort((left, right) => {
    if (left.totalAppearances !== right.totalAppearances) {
      return left.totalAppearances - right.totalAppearances;
    }

    const leftGapDistance = Math.abs(
      Math.abs(left.snapshotScore - anchorScore) - getPreferredOutlierGap(anchorScore)
    );
    const rightGapDistance = Math.abs(
      Math.abs(right.snapshotScore - anchorScore) - getPreferredOutlierGap(anchorScore)
    );

    if (leftGapDistance !== rightGapDistance) {
      return leftGapDistance - rightGapDistance;
    }

    return left.id.localeCompare(right.id);
  });
}

function prioritizeByExposure(candidates: LadderSnapshotGame[]) {
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

function getPreferredOutlierGap(_anchorScore: number) {
  return 300;
}

function formatCoreBucketWindow(window: ScoreWindow) {
  return `cluster:${window.minScore}-${window.maxScore}`;
}

function formatOutlierBucket(score: number, anchorScore: number) {
  const delta = score - anchorScore;
  const direction = delta >= 0 ? "+" : "";

  return `outlier:${direction}${delta}`;
}
