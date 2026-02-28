import { getDb } from "../src/lib/mongodb.ts";
import { getCollections } from "../src/server/collections.ts";
import { steamCoverUrl } from "./_igdb.ts";
import { parseCliArgs, parseLimit } from "./_shared.ts";

async function main() {
  const args = parseCliArgs();
  const limit = parseLimit(args.values.limit) ?? 1_000;
  const db = await getDb();
  const collections = getCollections(db);

  const candidates = await collections.games
    .find({
      "cover.status": { $ne: "ready" },
      "cover.steamAppId": { $type: "number" }
    })
    .sort({ seedRank: 1 })
    .limit(limit)
    .toArray();

  console.log(`Loaded ${candidates.length} Steam fallback candidates.`);

  let updated = 0;
  let skipped = 0;
  const startedAt = Date.now();

  for (const [index, game] of candidates.entries()) {
    const steamAppId = game.cover.steamAppId;

    if (!steamAppId) {
      skipped += 1;
      console.log(
        `[${index + 1}/${candidates.length}] skipped :: ${game.name} | updated=${updated} skipped=${skipped} elapsed=${Math.round((Date.now() - startedAt) / 1000)}s`
      );
      continue;
    }

    const imageUrl = steamCoverUrl(steamAppId);
    const response = await fetch(imageUrl, { method: "HEAD" });

    if (!response.ok) {
      skipped += 1;
      console.log(
        `[${index + 1}/${candidates.length}] missing :: ${game.name} | updated=${updated} skipped=${skipped} elapsed=${Math.round((Date.now() - startedAt) / 1000)}s`
      );
      continue;
    }

    const now = new Date();
    await collections.games.updateOne(
      { _id: game._id },
      {
        $set: {
          cover: {
            status: "ready",
            source: "steam",
            imageUrl,
            thumbUrl: imageUrl,
            igdbImageId: game.cover.igdbImageId ?? null,
            steamAppId,
            confidence: game.cover.confidence ?? null,
            updatedAt: now
          },
          updatedAt: now
        }
      }
    );
    updated += 1;
    console.log(
      `[${index + 1}/${candidates.length}] ready :: ${game.name} | updated=${updated} skipped=${skipped} elapsed=${Math.round((Date.now() - startedAt) / 1000)}s`
    );
  }

  console.log(
    JSON.stringify(
      {
        attempted: candidates.length,
        updated,
        skipped
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
