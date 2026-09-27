import { MongoClient, type ClientSession, type Db } from "mongodb";
import { env } from "./env.ts";

declare global {
  // eslint-disable-next-line no-var
  var __thisOrThatMongoClient: MongoClient | undefined;
}

// No explicit connect(): the driver connects lazily on the first operation and
// retries per operation, so a failed first connect is never cached.
const mongoClient =
  globalThis.__thisOrThatMongoClient ??
  new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__thisOrThatMongoClient = mongoClient;
}

export async function getDb(databaseName = env.MONGODB_DB_NAME): Promise<Db> {
  return mongoClient.db(databaseName);
}

export async function withMongoSession<T>(
  callback: (session: ClientSession, db: Db) => Promise<T>,
  databaseName = env.MONGODB_DB_NAME
): Promise<T> {
  const session = mongoClient.startSession();

  try {
    return await callback(session, mongoClient.db(databaseName));
  } finally {
    await session.endSession();
  }
}
