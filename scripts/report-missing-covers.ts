import { getDb } from "../src/lib/mongodb.ts";
import { getCollections } from "../src/server/collections.ts";
import { parseCliArgs, writeOutputFile } from "./_shared.ts";

type MissingCoverRow = {
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
  const format = args.values.format === "csv" ? "csv" : "json";
  const outputPath =
    args.values.output ?? `reports/missing-covers.${format === "csv" ? "csv" : "json"}`;
  const db = await getDb();
  const collections = getCollections(db);
  const missingCovers = await collections.games
    .find({ "cover.status": { $ne: "ready" } })
    .sort({ seedRank: 1 })
    .toArray();

  const rows: MissingCoverRow[] = missingCovers.map((game) => ({
    title: game.name,
    seedRank: game.seedRank,
    year: game.year ?? null,
    status: game.cover.status,
    confidence: game.cover.confidence,
    igdbImageId: game.cover.igdbImageId,
    steamAppId: game.cover.steamAppId
  }));

  const contents =
    format === "csv" ? renderCsv(rows) : `${JSON.stringify(rows, null, 2)}\n`;
  const absolutePath = await writeOutputFile(outputPath, contents);

  console.log(
    JSON.stringify(
      {
        count: rows.length,
        format,
        outputPath: absolutePath
      },
      null,
      2
    )
  );
}

function renderCsv(rows: MissingCoverRow[]) {
  const header = ["title", "seedRank", "year", "status", "confidence", "igdbImageId", "steamAppId"];
  const lines = rows.map((row) =>
    [
      row.title,
      row.seedRank.toString(),
      row.year?.toString() ?? "",
      row.status,
      row.confidence ?? "",
      row.igdbImageId ?? "",
      row.steamAppId?.toString() ?? ""
    ]
      .map(escapeCsvValue)
      .join(",")
  );

  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function escapeCsvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
