import { randomUUID } from "node:crypto";
import { getGamesCollection } from "./collections.ts";

const LADDER_SNAPSHOT_TTL_MS = 180_000;
export const MAX_RUN_ROUNDS = 20;
const SELECTION_POOL_SIZE = 20;
const FAMILIAR_SEED_RANK_MAX = 500;
const DEEP_CUT_SEED_RANK_MIN = 650;
const DISCOVERY_APPEARANCE_ROUNDS = new Set([5, 8, 11, 14, 16]);
const MAX_DEEP_CUT_VS_DEEP_CUT_ROUNDS = 1;
const OPENING_BUCKET_LABEL = "cluster:opening";

export const RUN_BAND_MODEL = "balanced_fixed_pairs.v1";

export type ScoreBasedParams = {
  coreScoreRadius: number;
  maxCoreScoreRadius: number;
  radiusExpansionStep: number;
  startingPairMinGap: number;
  startingPairMaxGap: number;
  startingPairPreferredGap: number;
};

const TIER_BREAKPOINTS: Array<{ score: number; params: ScoreBasedParams }> = [
  {
    score: 400,
    params: {
      coreScoreRadius: 150,
      maxCoreScoreRadius: 250,
      radiusExpansionStep: 30,
      startingPairMinGap: 80,
      startingPairMaxGap: 300,
      startingPairPreferredGap: 175
    }
  },
  {
    score: 700,
    params: {
      coreScoreRadius: 80,
      maxCoreScoreRadius: 140,
      radiusExpansionStep: 20,
      startingPairMinGap: 60,
      startingPairMaxGap: 150,
      startingPairPreferredGap: 100
    }
  },
  {
    score: 900,
    params: {
      coreScoreRadius: 30,
      maxCoreScoreRadius: 100,
      radiusExpansionStep: 15,
      startingPairMinGap: 10,
      startingPairMaxGap: 40,
      startingPairPreferredGap: 25
    }
  }
];

export function getScoreBasedParams(anchorScore: number): ScoreBasedParams {
  const first = TIER_BREAKPOINTS[0];
  const last = TIER_BREAKPOINTS[TIER_BREAKPOINTS.length - 1];

  if (anchorScore <= first.score) return { ...first.params };
  if (anchorScore >= last.score) return { ...last.params };

  let lowerTier = first;
  let upperTier = last;

  for (let i = 0; i < TIER_BREAKPOINTS.length - 1; i++) {
    if (anchorScore >= TIER_BREAKPOINTS[i].score && anchorScore <= TIER_BREAKPOINTS[i + 1].score) {
      lowerTier = TIER_BREAKPOINTS[i];
      upperTier = TIER_BREAKPOINTS[i + 1];
      break;
    }
  }

  const t = (anchorScore - lowerTier.score) / (upperTier.score - lowerTier.score);

  const interpolate = (low: number, high: number) => Math.round(low + (high - low) * t);

  return {
    coreScoreRadius: interpolate(lowerTier.params.coreScoreRadius, upperTier.params.coreScoreRadius),
    maxCoreScoreRadius: interpolate(lowerTier.params.maxCoreScoreRadius, upperTier.params.maxCoreScoreRadius),
    radiusExpansionStep: interpolate(lowerTier.params.radiusExpansionStep, upperTier.params.radiusExpansionStep),
    startingPairMinGap: interpolate(lowerTier.params.startingPairMinGap, upperTier.params.startingPairMinGap),
    startingPairMaxGap: interpolate(lowerTier.params.startingPairMaxGap, upperTier.params.startingPairMaxGap),
    startingPairPreferredGap: interpolate(lowerTier.params.startingPairPreferredGap, upperTier.params.startingPairPreferredGap)
  };
}

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
  roundPairs: RunRoundPair[];
  games: Record<string, RunGamePayload>;
  snapshotScores: Record<string, number>;
  gameIds: string[];
};

export type RunRoundPair = {
  round: number;
  leftGameId: string;
  rightGameId: string;
  bucket: string;
};

export type LadderSnapshotMetrics = {
  cacheStatus: "hit" | "miss" | "shared";
  dbFetchMs: number;
  totalMs: number;
  gameCount: number;
};

export type CreateRunDefinitionMetrics = {
  snapshot: LadderSnapshotMetrics;
  buildRunMs: number;
  totalMs: number;
};

type LadderSnapshotBuildResult = {
  snapshot: LadderSnapshot;
  dbFetchMs: number;
  gameCount: number;
};

let cachedLadderSnapshot: LadderSnapshot | null = null;
let ladderSnapshotPromise: Promise<LadderSnapshotBuildResult> | null = null;

export async function createRunDefinition(): Promise<BuiltRunDefinition> {
  const { runDefinition } = await createRunDefinitionWithMetrics();
  return runDefinition;
}

export async function createRunDefinitionWithMetrics(): Promise<{
  runDefinition: BuiltRunDefinition;
  metrics: CreateRunDefinitionMetrics;
}> {
  const startedAt = performance.now();
  const { snapshot, metrics: snapshotMetrics } = await getLadderSnapshotWithMetrics();
  const buildStartedAt = performance.now();
  const runDefinition = buildRunDefinition(snapshot);
  const buildRunMs = Math.round(performance.now() - buildStartedAt);

  return {
    runDefinition,
    metrics: {
      snapshot: snapshotMetrics,
      buildRunMs,
      totalMs: Math.round(performance.now() - startedAt)
    }
  };
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
  const { snapshot } = await getLadderSnapshotWithMetrics(now);
  return snapshot;
}

async function getLadderSnapshotWithMetrics(now = Date.now()): Promise<{
  snapshot: LadderSnapshot;
  metrics: LadderSnapshotMetrics;
}> {
  const startedAt = performance.now();

  if (cachedLadderSnapshot && cachedLadderSnapshot.expiresAt > now) {
    return {
      snapshot: cachedLadderSnapshot,
      metrics: {
        cacheStatus: "hit",
        dbFetchMs: 0,
        totalMs: Math.round(performance.now() - startedAt),
        gameCount: cachedLadderSnapshot.games.length
      }
    };
  }

  const cacheStatus = ladderSnapshotPromise ? "shared" : "miss";

  if (!ladderSnapshotPromise) {
    ladderSnapshotPromise = buildLadderSnapshot(now).finally(() => {
      ladderSnapshotPromise = null;
    });
  }

  const result = await ladderSnapshotPromise;

  if (!cachedLadderSnapshot || cachedLadderSnapshot.expiresAt <= now) {
    cachedLadderSnapshot = result.snapshot;
  }

  return {
    snapshot: result.snapshot,
    metrics: {
      cacheStatus,
      dbFetchMs: result.dbFetchMs,
      totalMs: Math.round(performance.now() - startedAt),
      gameCount: result.gameCount
    }
  };
}

async function buildLadderSnapshot(nowMs: number): Promise<LadderSnapshotBuildResult> {
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
    const dbFetchStartedAt = performance.now();
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
    const dbFetchMs = Math.round(performance.now() - dbFetchStartedAt);

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
      snapshot: {
        snapshotVersion: builtAt.toISOString(),
        builtAt,
        expiresAt: nowMs + LADDER_SNAPSHOT_TTL_MS,
        games: snapshotGames
      },
      dbFetchMs,
      gameCount: snapshotGames.length
    };
  } catch (error) {
    console.error("Failed to load games for ladder snapshot.", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

export function buildRunDefinition(snapshot: LadderSnapshot): BuiltRunDefinition {
  if (snapshot.games.length < 2) {
    throw new Error("At least two games are required to build a run.");
  }

  const usedGameIds = new Set<string>();
  let deepCutVsDeepCutRounds = 0;
  const roundPairs: RunRoundPair[] = [];

  for (let round = 1; round <= MAX_RUN_ROUNDS; round += 1) {
    const pair = pickRoundPair({
      round,
      games: snapshot.games,
      usedGameIds,
      allowDeepCutVsDeepCut: deepCutVsDeepCutRounds < MAX_DEEP_CUT_VS_DEEP_CUT_ROUNDS
    });

    if (isDeepCut(pair.left) && isDeepCut(pair.right)) {
      deepCutVsDeepCutRounds += 1;
    }

    usedGameIds.add(pair.left.id);
    usedGameIds.add(pair.right.id);

    const arrangedPair = arrangePairSides(pair.left, pair.right);
    roundPairs.push({
      round,
      leftGameId: arrangedPair.left.id,
      rightGameId: arrangedPair.right.id,
      bucket: pair.bucket
    });
  }

  const issuedGameIds = Array.from(
    new Set(roundPairs.flatMap((pair) => [pair.leftGameId, pair.rightGameId]))
  );
  const initialPair = roundPairs[0];
  const challengerQueue = roundPairs.slice(1).map((pair) => ({
    round: pair.round,
    gameId: pair.rightGameId,
    bucket: pair.bucket
  }));

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
      leftGameId: initialPair.leftGameId,
      rightGameId: initialPair.rightGameId
    },
    challengerQueue,
    roundPairs,
    games,
    snapshotScores,
    gameIds: issuedGameIds
  };
}

type RoundPairSelection = {
  left: LadderSnapshotGame;
  right: LadderSnapshotGame;
  bucket: string;
};

type PickRoundPairInput = {
  round: number;
  games: LadderSnapshotGame[];
  usedGameIds: Set<string>;
  allowDeepCutVsDeepCut: boolean;
};

function pickRoundPair({
  round,
  games,
  usedGameIds,
  allowDeepCutVsDeepCut
}: PickRoundPairInput): RoundPairSelection {
  if (round === MAX_RUN_ROUNDS) {
    return pickFinalBossPair(games, usedGameIds);
  }

  if (DISCOVERY_APPEARANCE_ROUNDS.has(round)) {
    return pickDiscoveryPair(games, usedGameIds, allowDeepCutVsDeepCut);
  }

  if (round >= 18) {
    return pickPlannedPair({
      bucket: "elite:setup",
      primaryCandidates: games.filter(isEliteGame),
      secondaryCandidates: games.filter(isRecognizable),
      games,
      usedGameIds,
      targetGap: 75,
      maxGap: 150,
      allowDeepCutVsDeepCut: false
    });
  }

  if (round >= 12) {
    return pickPlannedPair({
      bucket: "core:hard",
      primaryCandidates: games.filter(isRecognizable),
      secondaryCandidates: games.filter(isRecognizable),
      games,
      usedGameIds,
      targetGap: 60,
      maxGap: 125,
      allowDeepCutVsDeepCut: false
    });
  }

  if (round >= 6) {
    return pickPlannedPair({
      bucket: "core:balanced",
      primaryCandidates: games.filter(isKnownGame),
      secondaryCandidates: games.filter(isKnownGame),
      games,
      usedGameIds,
      targetGap: 90,
      maxGap: 150,
      allowDeepCutVsDeepCut: false
    });
  }

  return pickPlannedPair({
    bucket: "warmup:recognizable",
    primaryCandidates: games.filter(isFamiliarGame),
    secondaryCandidates: games.filter(isFamiliarGame),
    games,
    usedGameIds,
    targetGap: 120,
    maxGap: 220,
    allowDeepCutVsDeepCut: false
  });
}

function pickDiscoveryPair(
  games: LadderSnapshotGame[],
  usedGameIds: Set<string>,
  allowDeepCutVsDeepCut: boolean
) {
  return pickPlannedPair({
    bucket: "discovery:anchored",
    primaryCandidates: games.filter(isDeepCut),
    secondaryCandidates: games.filter(isRecognizable),
    games,
    usedGameIds,
    targetGap: 100,
    maxGap: 180,
    allowDeepCutVsDeepCut
  });
}

function pickFinalBossPair(games: LadderSnapshotGame[], usedGameIds: Set<string>) {
  const topGameCount = Math.max(1, Math.ceil(games.length * 0.01));
  const topOnePercentGames = games.slice(0, topGameCount);

  return pickPlannedPair({
    bucket: "final:top-1-percent",
    primaryCandidates: topOnePercentGames,
    secondaryCandidates: games.filter((game) => isRecognizable(game) && !topOnePercentGames.includes(game)),
    games,
    usedGameIds,
    targetGap: 80,
    maxGap: 180,
    allowDeepCutVsDeepCut: false,
    allowUsedPrimary: true
  });
}

function pickPlannedPair({
  bucket,
  primaryCandidates,
  secondaryCandidates,
  games,
  usedGameIds,
  targetGap,
  maxGap,
  allowDeepCutVsDeepCut,
  allowUsedPrimary = false
}: {
  bucket: string;
  primaryCandidates: LadderSnapshotGame[];
  secondaryCandidates: LadderSnapshotGame[];
  games: LadderSnapshotGame[];
  usedGameIds: Set<string>;
  targetGap: number;
  maxGap: number;
  allowDeepCutVsDeepCut: boolean;
  allowUsedPrimary?: boolean;
}): RoundPairSelection {
  const fallbackPrimary = primaryCandidates.length > 0 ? primaryCandidates : games;
  const fallbackSecondary = secondaryCandidates.length > 0 ? secondaryCandidates : games;
  const pair =
    findPair(fallbackPrimary, fallbackSecondary, {
      usedGameIds,
      targetGap,
      maxGap,
      allowDeepCutVsDeepCut,
      allowUsedPrimary,
      allowUsedAny: false
    }) ??
    findPair(fallbackPrimary, fallbackSecondary, {
      usedGameIds,
      targetGap,
      maxGap: maxGap * 2,
      allowDeepCutVsDeepCut,
      allowUsedPrimary,
      allowUsedAny: false
    }) ??
    findPair(fallbackPrimary, fallbackSecondary, {
      usedGameIds,
      targetGap,
      maxGap: Infinity,
      allowDeepCutVsDeepCut: true,
      allowUsedPrimary,
      allowUsedAny: false
    }) ??
    findPair(fallbackPrimary, fallbackSecondary, {
      usedGameIds,
      targetGap,
      maxGap: Infinity,
      allowDeepCutVsDeepCut: true,
      allowUsedPrimary: true,
      allowUsedAny: true
    });

  if (!pair) {
    throw new Error("Unable to build a scheduled matchup pair from the current ladder snapshot.");
  }

  return {
    ...pair,
    bucket
  };
}

function findPair(
  primaryCandidates: LadderSnapshotGame[],
  secondaryCandidates: LadderSnapshotGame[],
  options: {
    usedGameIds: Set<string>;
    targetGap: number;
    maxGap: number;
    allowDeepCutVsDeepCut: boolean;
    allowUsedPrimary: boolean;
    allowUsedAny: boolean;
  }
) {
  const primaryPool = limitCandidatePool(primaryCandidates, options.usedGameIds, options.allowUsedPrimary);
  const secondaryPool = limitCandidatePool(secondaryCandidates, options.usedGameIds, options.allowUsedAny);
  const candidates: Array<{
    left: LadderSnapshotGame;
    right: LadderSnapshotGame;
    score: number;
  }> = [];

  for (const primary of primaryPool) {
    for (const secondary of secondaryPool) {
      if (primary.id === secondary.id) continue;
      if (!options.allowUsedAny && options.usedGameIds.has(secondary.id)) continue;
      if (!options.allowUsedPrimary && options.usedGameIds.has(primary.id)) continue;
      if (!options.allowDeepCutVsDeepCut && isDeepCut(primary) && isDeepCut(secondary)) continue;

      const gap = Math.abs(primary.snapshotScore - secondary.snapshotScore);
      if (gap > options.maxGap) continue;

      candidates.push({
        left: primary,
        right: secondary,
        score:
          Math.abs(gap - options.targetGap) +
          getExposureScore(primary) +
          getExposureScore(secondary)
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    if (left.score !== right.score) return left.score - right.score;
    return Math.random() - 0.5;
  });

  const selectionPool = candidates.slice(0, Math.min(SELECTION_POOL_SIZE, candidates.length));
  const selected = sample(selectionPool);

  return {
    left: selected.left,
    right: selected.right
  };
}

function limitCandidatePool(
  candidates: LadderSnapshotGame[],
  usedGameIds: Set<string>,
  allowUsed: boolean
) {
  const eligible = allowUsed ? candidates : candidates.filter((game) => !usedGameIds.has(game.id));
  const prioritized = [...eligible].sort((left, right) => {
    if (left.totalAppearances !== right.totalAppearances) {
      return left.totalAppearances - right.totalAppearances;
    }

    if (left.seedRank !== right.seedRank) {
      return left.seedRank - right.seedRank;
    }

    return Math.random() - 0.5;
  });

  return prioritized.slice(0, Math.max(SELECTION_POOL_SIZE * 3, MAX_RUN_ROUNDS * 2));
}

function arrangePairSides(left: LadderSnapshotGame, right: LadderSnapshotGame) {
  return Math.random() < 0.5
    ? { left, right }
    : { left: right, right: left };
}

function isFamiliarGame(game: LadderSnapshotGame) {
  return game.seedRank <= 250;
}

function isKnownGame(game: LadderSnapshotGame) {
  return game.seedRank <= FAMILIAR_SEED_RANK_MAX;
}

function isRecognizable(game: LadderSnapshotGame) {
  return game.seedRank <= FAMILIAR_SEED_RANK_MAX || game.percentileFromBottom >= 85;
}

function isDeepCut(game: LadderSnapshotGame) {
  return game.seedRank >= DEEP_CUT_SEED_RANK_MIN;
}

function isEliteGame(game: LadderSnapshotGame) {
  return game.percentileFromBottom >= 90;
}

function getExposureScore(game: LadderSnapshotGame) {
  return Math.min(game.totalAppearances, 50) / 10;
}

function sample<T>(values: readonly T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function getPercentileFromBottom(index: number, totalGames: number) {
  return Number((((totalGames - index) / totalGames) * 100).toFixed(3));
}
