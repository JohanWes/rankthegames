import { getDb } from "../src/lib/mongodb.ts";
import { getCollections } from "../src/server/collections.ts";
import { parseCliArgs, writeOutputFile } from "./_shared.ts";

type PrunedGameRow = {
  id: string;
  title: string;
  seedRank: number;
  year: number | null;
  status: string;
  confidence: string | null | undefined;
  igdbImageId: string | null | undefined;
  steamAppId: number | null | undefined;
};

async function main() {
  const args = parseCliArgs();
  const dryRun = args.flags.has("dry-run");
  const outputPath =
    args.values.output ?? "reports/pruned-missing-covers.json";
  const db = await getDb();
  const collections = getCollections(db);

  const gamesToPrune = await collections.games
    .find({ "cover.status": { $ne: "ready" } })
    .sort({ seedRank: 1 })
    .toArray();

  const rows: PrunedGameRow[] = gamesToPrune.map((game) => ({
    id: game._id.toString(),
    title: game.name,
    seedRank: game.seedRank,
    year: game.year ?? null,
    status: game.cover.status,
    confidence: game.cover.confidence,
    igdbImageId: game.cover.igdbImageId,
    steamAppId: game.cover.steamAppId
  }));

  const absoluteOutputPath = await writeOutputFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`);

  let deletedCount = 0;

  if (!dryRun && rows.length > 0) {
    const result = await collections.games.deleteMany({
      _id: { $in: gamesToPrune.map((game) => game._id) }
    });
    deletedCount = result.deletedCount;
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        matched: rows.length,
        deleted: deletedCount,
        outputPath: absoluteOutputPath
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
