import { getDb } from "../src/lib/mongodb.ts";
import { ensureCoreIndexes, getCollections } from "../src/server/collections.ts";
import { loadSeedEntries, parseCliArgs } from "./_shared.ts";

async function main() {
  const args = parseCliArgs();
  const seedEntries = await loadSeedEntries(args.values.file);
  const db = await getDb();
  const collections = getCollections(db);
  const now = new Date();

  await ensureCoreIndexes(db);

  if (args.flags.has("reset")) {
    await Promise.all([
      collections.matchEvents.deleteMany({}),
      collections.runSubmissions.deleteMany({}),
      collections.rateLimits.deleteMany({}),
      collections.games.deleteMany({})
    ]);
  }

  const result = await collections.games.bulkWrite(
    seedEntries.map((entry) => ({
      updateOne: {
        filter: { slug: entry.slug },
        update: {
          $set: {
            slug: entry.slug,
            normalizedName: entry.normalizedName,
            name: entry.title,
            year: entry.year,
            seedRank: entry.seedRank,
            seedScore: entry.seedScore,
            updatedAt: now
          },
          $setOnInsert: {
            currentScore: entry.seedScore,
            wins: 0,
            losses: 0,
            totalMatches: 0,
            totalAppearances: 0,
            lastSeenAt: null,
            cover: {
              status: "missing",
              source: "manual",
              imageUrl: null,
              thumbUrl: null,
              igdbImageId: null,
              steamAppId: null,
              confidence: null,
              updatedAt: null
            },
            createdAt: now
          }
        },
        upsert: true
      }
    }))
  );

  console.log(
    JSON.stringify(
      {
        imported: seedEntries.length,
        inserted: result.upsertedCount,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        reset: args.flags.has("reset")
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
