import { randomUUID } from "node:crypto";
import { OPENING_BRACKET_ROUNDS } from "../lib/bracket.ts";
import type { RunGame, RunPair } from "../lib/types.ts";
import { getGamesCollection } from "./collections.ts";

const LADDER_SNAPSHOT_TTL_MS = 180_000;
const SELECTION_POOL_SIZE = 20;
const CANDIDATE_POOL_SIZE = 60;
const FAMILIAR_SEED_RANK_MAX = 500;
const DEEP_CUT_SEED_RANK_MIN = 650;
const DISCOVERY_APPEARANCE_ROUNDS = new Set([5, 8]);
const MAX_DEEP_CUT_VS_DEEP_CUT_ROUNDS = 1;

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
  expiresAt: number;
  games: LadderSnapshotGame[];
};

export type BuiltRunDefinition = {
  runId: string;
  snapshotVersion: string;
  roundPairs: RunPair[];
  games: Record<string, RunGame>;
};

type SourceGame = {
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
};

let cachedLadderSnapshot: LadderSnapshot | null = null;
let ladderSnapshotRefresh: Promise<LadderSnapshot> | null = null;

export async function createRunDefinition(): Promise<BuiltRunDefinition> {
  return buildRunDefinition(await getLadderSnapshot());
}

async function getLadderSnapshot(): Promise<LadderSnapshot> {
  const now = Date.now();

  if (cachedLadderSnapshot && cachedLadderSnapshot.expiresAt > now) {
    return cachedLadderSnapshot;
  }

  ladderSnapshotRefresh ??= buildLadderSnapshot(now)
    .then((snapshot) => (cachedLadderSnapshot = snapshot))
    .finally(() => {
      ladderSnapshotRefresh = null;
    });

  if (cachedLadderSnapshot) {
    // Stale-while-revalidate: serve the expired snapshot while the refresh runs.
    // The failure is already logged in buildLadderSnapshot; the stale copy stays in use.
    ladderSnapshotRefresh.catch(() => {});
    return cachedLadderSnapshot;
  }

  return ladderSnapshotRefresh;
}

async function buildLadderSnapshot(nowMs: number): Promise<LadderSnapshot> {
  const games = await getGamesCollection();

  try {
    const sourceGames = await games
      .find<SourceGame>(
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
      throw new Error(`At least two games are required to create a run (found ${sourceGames.length}).`);
    }

    return {
      snapshotVersion: new Date(nowMs).toISOString(),
      expiresAt: nowMs + LADDER_SNAPSHOT_TTL_MS,
      games: sourceGames.map((game, index) => ({
        id: game._id.toString(),
        name: game.name,
        year: game.year ?? null,
        seedRank: game.seedRank,
        snapshotScore: game.currentScore,
        totalAppearances: game.totalAppearances,
        imageUrl: game.cover?.imageUrl ?? null,
        thumbUrl: game.cover?.thumbUrl ?? null,
        percentileFromBottom: getPercentileFromBottom(index, sourceGames.length)
      }))
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
  const usedGameIds = new Set<string>();
  let deepCutVsDeepCutRounds = 0;
  const roundPairs: RunPair[] = [];

  for (let round = 1; round <= OPENING_BRACKET_ROUNDS; round += 1) {
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

  const games: Record<string, RunGame> = {};

  for (const game of snapshot.games) {
    if (!usedGameIds.has(game.id)) continue;

    // Count the issue against the cached snapshot so back-to-back runs rotate through fresh games.
    game.totalAppearances += 1;
    games[game.id] = {
      id: game.id,
      name: game.name,
      year: game.year,
      imageUrl: game.imageUrl,
      thumbUrl: game.thumbUrl,
      snapshotScore: game.snapshotScore,
      seedRank: game.seedRank
    };
  }

  return {
    runId: randomUUID(),
    snapshotVersion: snapshot.snapshotVersion,
    roundPairs,
    games
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
  if (DISCOVERY_APPEARANCE_ROUNDS.has(round)) {
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

function pickPlannedPair({
  bucket,
  primaryCandidates,
  secondaryCandidates,
  games,
  usedGameIds,
  targetGap,
  maxGap,
  allowDeepCutVsDeepCut
}: {
  bucket: string;
  primaryCandidates: LadderSnapshotGame[];
  secondaryCandidates: LadderSnapshotGame[];
  games: LadderSnapshotGame[];
  usedGameIds: Set<string>;
  targetGap: number;
  maxGap: number;
  allowDeepCutVsDeepCut: boolean;
}): RoundPairSelection {
  const primary = primaryCandidates.length > 0 ? primaryCandidates : games;
  const secondary = secondaryCandidates.length > 0 ? secondaryCandidates : games;
  const base = { usedGameIds, targetGap, allowUsed: false };
  const pair =
    findPair(primary, secondary, { ...base, maxGap, allowDeepCutVsDeepCut }) ??
    findPair(primary, secondary, { ...base, maxGap: maxGap * 2, allowDeepCutVsDeepCut }) ??
    findPair(primary, secondary, { ...base, maxGap: Infinity, allowDeepCutVsDeepCut: true }) ??
    findPair(primary, secondary, { ...base, maxGap: Infinity, allowDeepCutVsDeepCut: true, allowUsed: true });

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
    allowUsed: boolean;
  }
) {
  const primaryPool = limitCandidatePool(primaryCandidates, options.usedGameIds, options.allowUsed);
  const secondaryPool = limitCandidatePool(secondaryCandidates, options.usedGameIds, options.allowUsed);
  const candidates: Array<{
    left: LadderSnapshotGame;
    right: LadderSnapshotGame;
    score: number;
  }> = [];

  for (const primary of primaryPool) {
    for (const secondary of secondaryPool) {
      if (primary.id === secondary.id) continue;
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

  const selected = sample(candidates.slice(0, SELECTION_POOL_SIZE));

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

  return prioritized.slice(0, CANDIDATE_POOL_SIZE);
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

function getExposureScore(game: LadderSnapshotGame) {
  return Math.min(game.totalAppearances, 50) / 10;
}

function sample<T>(values: readonly T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function getPercentileFromBottom(index: number, totalGames: number) {
  return Number((((totalGames - index) / totalGames) * 100).toFixed(3));
}
