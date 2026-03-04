import { getDb } from "../src/lib/mongodb.ts";
import { ensureCoreIndexes, getCollections } from "../src/server/collections.ts";

const OBSOLETE_GAME_INDEXES = new Set(["totalMatches_1", "totalAppearances_1"]);

async function main() {
  const db = await getDb();
  const collections = getCollections(db);

  await ensureCoreIndexes(db);

  const gameIndexes = await collections.games.indexes();
  const droppedIndexes: string[] = [];

  for (const index of gameIndexes) {
    const indexName = index.name;

    if (!indexName || !OBSOLETE_GAME_INDEXES.has(indexName)) {
      continue;
    }

    await collections.games.dropIndex(indexName);
    droppedIndexes.push(indexName);
  }

  console.log(
    JSON.stringify(
      {
        database: db.databaseName,
        ensured: true,
        droppedIndexes
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
