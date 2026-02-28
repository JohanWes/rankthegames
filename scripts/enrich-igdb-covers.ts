import { getDb } from "../src/lib/mongodb.ts";
import { getCollections } from "../src/server/collections.ts";
import {
  createIgdbRateLimitedSearcher,
  fetchTwitchAccessToken,
  igdbCoverUrl,
  igdbThumbUrl
} from "./_igdb.ts";
import { parseCliArgs, parseLimit } from "./_shared.ts";

async function main() {
  const args = parseCliArgs();
  const limit = parseLimit(args.values.limit);
  console.log("Fetching Twitch OAuth token...");
  const accessToken = await fetchTwitchAccessToken();
  console.log("Twitch OAuth token acquired.");
  const searchIgdb = createIgdbRateLimitedSearcher(accessToken);
  const db = await getDb();
  const collections = getCollections(db);
  const queryLimit = limit ?? 1_000;

  const unresolvedGames = await collections.games
    .find({ "cover.status": { $ne: "ready" } })
    .sort({ seedRank: 1 })
    .limit(queryLimit)
    .toArray();

  console.log(
    `Loaded ${unresolvedGames.length} unresolved games for IGDB enrichment${limit ? ` (limit=${limit})` : ""}.`
  );

  let readyCount = 0;
  let pendingReviewCount = 0;
  let noMatchCount = 0;
  const startedAt = Date.now();

  for (const [index, game] of unresolvedGames.entries()) {
    try {
      const match = await searchIgdb(game.name, game.year ?? null);
      const now = new Date();

      if (match?.imageId && (match.confidence === "high" || match.confidence === "medium")) {
        await collections.games.updateOne(
          { _id: game._id },
          {
            $set: {
              year: match.year ?? game.year ?? null,
              cover: {
                status: "ready",
                source: "igdb",
                imageUrl: igdbCoverUrl(match.imageId),
                thumbUrl: igdbThumbUrl(match.imageId),
                igdbImageId: match.imageId,
                steamAppId: match.steamAppId ?? game.cover.steamAppId ?? null,
                confidence: match.confidence,
                updatedAt: now
              },
              updatedAt: now
            }
          }
        );
        readyCount += 1;
        logProgress({
          current: index + 1,
          total: unresolvedGames.length,
          gameName: game.name,
          outcome: "ready",
          readyCount,
          pendingReviewCount,
          noMatchCount,
          startedAt
        });
        continue;
      }

      await collections.games.updateOne(
        { _id: game._id },
        {
          $set: {
            cover: {
              status: "pending_review",
              source: "manual",
              imageUrl: null,
              thumbUrl: null,
              igdbImageId: match?.imageId ?? null,
              steamAppId: match?.steamAppId ?? game.cover.steamAppId ?? null,
              confidence: match?.confidence ?? null,
              updatedAt: now
            },
            updatedAt: now
          }
        }
      );

      if (match) {
        pendingReviewCount += 1;
      } else {
        noMatchCount += 1;
      }

      logProgress({
        current: index + 1,
        total: unresolvedGames.length,
        gameName: game.name,
        outcome: match ? "pending_review" : "no_match",
        readyCount,
        pendingReviewCount,
        noMatchCount,
        startedAt
      });
    } catch (error) {
      console.error(`Failed IGDB enrichment for "${game.name}":`, error);
      logProgress({
        current: index + 1,
        total: unresolvedGames.length,
        gameName: game.name,
        outcome: "error",
        readyCount,
        pendingReviewCount,
        noMatchCount,
        startedAt
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        attempted: unresolvedGames.length,
        readyCount,
        pendingReviewCount,
        noMatchCount
      },
      null,
      2
    )
  );
}

function logProgress({
  current,
  total,
  gameName,
  outcome,
  readyCount,
  pendingReviewCount,
  noMatchCount,
  startedAt
}: {
  current: number;
  total: number;
  gameName: string;
  outcome: string;
  readyCount: number;
  pendingReviewCount: number;
  noMatchCount: number;
  startedAt: number;
}) {
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[${current}/${total}] ${outcome} :: ${gameName} | ready=${readyCount} pending=${pendingReviewCount} noMatch=${noMatchCount} elapsed=${elapsedSeconds}s`
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
