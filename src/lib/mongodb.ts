import {
  MongoClient,
  type ClientSession,
  type Db,
  type MongoClientOptions
} from "mongodb";
import { env } from "./env.ts";

const clientOptions: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30_000,
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 5_000
};

declare global {
  // eslint-disable-next-line no-var
  var __thisOrThatMongoClientPromise: Promise<MongoClient> | undefined;
}

function createMongoClientPromise() {
  const client = new MongoClient(env.MONGODB_URI, clientOptions);
  return client.connect();
}

const mongoClientPromise =
  globalThis.__thisOrThatMongoClientPromise ?? createMongoClientPromise();

if (process.env.NODE_ENV !== "production") {
  globalThis.__thisOrThatMongoClientPromise = mongoClientPromise;
}

export async function getMongoClient() {
  return mongoClientPromise;
}

export async function getDb(databaseName = env.MONGODB_DB_NAME): Promise<Db> {
  const client = await getMongoClient();
  return client.db(databaseName);
}

export async function withMongoSession<T>(
  callback: (session: ClientSession, db: Db) => Promise<T>,
  databaseName = env.MONGODB_DB_NAME
): Promise<T> {
  const client = await getMongoClient();
  const session = client.startSession();
  const db = client.db(databaseName);

  try {
    return await callback(session, db);
  } finally {
    await session.endSession();
  }
}
