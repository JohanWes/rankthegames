import pLimit from "p-limit";
import { env } from "../src/lib/env.ts";
import { normalizeTitle } from "./_shared.ts";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";
const STEAM_EXTERNAL_GAME_CATEGORY = 1;

type IgdbCover = {
  image_id?: string | null;
};

type IgdbExternalGame = {
  category?: number | null;
  uid?: string | null;
};

type IgdbGameResult = {
  name: string;
  first_release_date?: number | null;
  cover?: IgdbCover | null;
  external_games?: IgdbExternalGame[] | null;
};

export type IgdbConfidence = "high" | "medium" | "low";

export type IgdbMatchResult = {
  confidence: IgdbConfidence;
  matchedName: string;
  year: number | null;
  imageId: string | null;
  steamAppId: number | null;
};

export function igdbCoverUrl(imageId: string) {
  return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg`;
}

export function igdbThumbUrl(imageId: string) {
  return `https://images.igdb.com/igdb/image/upload/t_thumb/${imageId}.jpg`;
}

export function steamCoverUrl(appId: number) {
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`;
}

export async function fetchTwitchAccessToken() {
  const clientId = env.TWITCH_CLIENT_ID?.trim() || env.IGDB_CLIENT_ID;
  const clientSecret = env.TWITCH_CLIENT_SECRET?.trim() || env.IGDB_CLIENT_SECRET;
  const response = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials"
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Twitch OAuth token: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { access_token?: string };

  if (!payload.access_token) {
    throw new Error("Twitch OAuth token response did not include access_token.");
  }

  return payload.access_token;
}

export async function searchIgdbGame(
  accessToken: string,
  title: string,
  yearHint: number | null
) {
  const escapedTitle = title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const body = [
    'fields name,first_release_date,cover.image_id,external_games.uid,external_games.category;',
    `search "${escapedTitle}";`,
    "where version_parent = null;",
    "limit 10;"
  ].join(" ");

  const response = await fetch(IGDB_GAMES_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${accessToken}`
    },
    body
  });

  if (!response.ok) {
    throw new Error(`IGDB search failed for "${title}": ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as IgdbGameResult[];
  return pickBestIgdbMatch(payload, title, yearHint);
}

export function createIgdbRateLimitedSearcher(accessToken: string) {
  const limit = pLimit(4);
  let nextSlotAt = Date.now();

  return async (title: string, yearHint: number | null) =>
    limit(async () => {
      const scheduledAt = nextSlotAt;
      nextSlotAt += 250;
      const waitMs = scheduledAt - Date.now();

      if (waitMs > 0) {
        await sleep(waitMs);
      }

      return searchIgdbGame(accessToken, title, yearHint);
    });
}

function pickBestIgdbMatch(
  candidates: IgdbGameResult[],
  title: string,
  yearHint: number | null
): IgdbMatchResult | null {
  const normalizedTitle = normalizeTitle(title);
  const scoredCandidates = candidates
    .map((candidate) => {
      const matchedName = candidate.name?.trim() ?? "";
      const candidateNormalizedTitle = normalizeTitle(matchedName);
      const year = candidate.first_release_date
        ? new Date(candidate.first_release_date * 1000).getUTCFullYear()
        : null;
      const imageId = candidate.cover?.image_id ?? null;
      const steamAppId = extractSteamAppId(candidate.external_games ?? []);
      const exactNormalizedMatch = candidateNormalizedTitle === normalizedTitle;
      const yearNearMatch =
        yearHint !== null && year !== null ? Math.abs(yearHint - year) <= 1 : false;
      const hasCover = Boolean(imageId);
      const confidence: IgdbConfidence = exactNormalizedMatch && yearNearMatch && hasCover
        ? "high"
        : exactNormalizedMatch && hasCover
          ? "medium"
          : "low";

      const score =
        (exactNormalizedMatch ? 100 : 0) +
        (yearNearMatch ? 15 : 0) +
        (hasCover ? 8 : 0) +
        (steamAppId ? 3 : 0);

      return {
        score,
        confidence,
        matchedName,
        year,
        imageId,
        steamAppId
      };
    })
    .sort((left, right) => right.score - left.score);

  return scoredCandidates[0] ?? null;
}

function extractSteamAppId(externalGames: IgdbExternalGame[]) {
  for (const externalGame of externalGames) {
    if (externalGame.category !== STEAM_EXTERNAL_GAME_CATEGORY || !externalGame.uid) {
      continue;
    }

    const parsed = Number.parseInt(externalGame.uid, 10);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
