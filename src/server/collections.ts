import type { Collection, Db, ObjectId } from "mongodb";
import { getDb } from "../lib/mongodb.ts";

export const COLLECTION_NAMES = {
  games: "games",
  matchEvents: "match_events",
  runSubmissions: "run_submissions",
  rateLimits: "rate_limits"
} as const;

export type CoverStatus = "ready" | "missing" | "pending_review";
export type CoverSource = "igdb" | "steam" | "manual";
export type CoverConfidence = "high" | "medium" | "low";

export type CoverDoc = {
  status: CoverStatus;
  source: CoverSource;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  igdbImageId?: string | null;
  steamAppId?: number | null;
  confidence?: CoverConfidence | null;
  updatedAt?: Date | null;
};

export type GameDoc = {
  _id: ObjectId;
  slug: string;
  normalizedName: string;
  name: string;
  year?: number | null;
  seedRank: number;
  seedScore: number;
  currentScore: number;
  wins: number;
  losses: number;
  totalMatches: number;
  totalAppearances: number;
  lastSeenAt?: Date | null;
  cover: CoverDoc;
  createdAt: Date;
  updatedAt: Date;
};

export type MatchEventDoc = {
  _id: ObjectId;
  runId: string;
  round: number;
  snapshotVersion: string;
  leftGameId: ObjectId;
  rightGameId: ObjectId;
  pickedGameId: ObjectId;
  correctGameId: ObjectId;
  snapshotLeftScore: number;
  snapshotRightScore: number;
  appliedLeftPreScore: number;
  appliedRightPreScore: number;
  appliedLeftPostScore: number;
  appliedRightPostScore: number;
  leftDelta: number;
  rightDelta: number;
  wasCorrect: boolean;
  bucket: string;
  ipHash: string;
  submittedAt: Date;
};

export type RunSubmissionDoc = {
  _id: ObjectId;
  runId: string;
  snapshotVersion: string;
  endedReason: "wrong_guess" | "max_rounds" | "abandoned";
  roundsAccepted: number;
  finalScore: number;
  ipHash: string;
  submittedAt: Date;
};

export type RateLimitDoc = {
  _id: ObjectId;
  key: string;
  route: string;
  windowStart: Date;
  count: number;
  expiresAt: Date;
};

export type AppCollections = {
  games: Collection<GameDoc>;
  matchEvents: Collection<MatchEventDoc>;
  runSubmissions: Collection<RunSubmissionDoc>;
  rateLimits: Collection<RateLimitDoc>;
};

const indexBuildsByDatabase = new Map<string, Promise<void>>();

export function getCollections(db: Db): AppCollections {
  return {
    games: db.collection<GameDoc>(COLLECTION_NAMES.games),
    matchEvents: db.collection<MatchEventDoc>(COLLECTION_NAMES.matchEvents),
    runSubmissions: db.collection<RunSubmissionDoc>(COLLECTION_NAMES.runSubmissions),
    rateLimits: db.collection<RateLimitDoc>(COLLECTION_NAMES.rateLimits)
  };
}

export async function getAppCollections(db?: Db): Promise<AppCollections> {
  return getCollections(db ?? (await getDb()));
}

export async function getGamesCollection(db?: Db) {
  return (await getAppCollections(db)).games;
}

export async function getMatchEventsCollection(db?: Db) {
  return (await getAppCollections(db)).matchEvents;
}

export async function getRunSubmissionsCollection(db?: Db) {
  return (await getAppCollections(db)).runSubmissions;
}

export async function getRateLimitsCollection(db?: Db) {
  return (await getAppCollections(db)).rateLimits;
}

export async function ensureCoreIndexes(db?: Db): Promise<void> {
  const resolvedDb = db ?? (await getDb());
  const existingPromise = indexBuildsByDatabase.get(resolvedDb.databaseName);

  if (existingPromise) {
    await existingPromise;
    return;
  }

  const buildPromise = createCoreIndexes(resolvedDb);
  indexBuildsByDatabase.set(resolvedDb.databaseName, buildPromise);

  try {
    await buildPromise;
  } catch (error) {
    indexBuildsByDatabase.delete(resolvedDb.databaseName);
    throw error;
  }
}

async function createCoreIndexes(db: Db) {
  const collections = getCollections(db);

  await Promise.all([
    collections.games.createIndex({ slug: 1 }, { unique: true }),
    collections.games.createIndex({ currentScore: -1, _id: 1 }),
    collections.games.createIndex({ seedRank: 1 }),
    collections.games.createIndex({ "cover.status": 1 }),
    collections.games.createIndex({ totalMatches: 1 }),
    collections.games.createIndex({ totalAppearances: 1 }),
    collections.matchEvents.createIndex({ runId: 1, round: 1 }, { unique: true }),
    collections.matchEvents.createIndex({ submittedAt: -1 }),
    collections.matchEvents.createIndex({ ipHash: 1, submittedAt: -1 }),
    collections.runSubmissions.createIndex({ runId: 1 }, { unique: true }),
    collections.runSubmissions.createIndex({ submittedAt: -1 }),
    collections.rateLimits.createIndex({ key: 1, route: 1, windowStart: 1 }, { unique: true }),
    collections.rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]);
}
