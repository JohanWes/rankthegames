import {
  getLeaderboard,
  LEADERBOARD_CACHE_CONTROL,
  LeaderboardQueryError,
  parseLeaderboardLimit
} from "@/server/leaderboard.ts";
import { createCachedJsonResponse, createErrorResponse } from "@/server/api-response.ts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLeaderboardLimit(searchParams.get("limit"));
    const response = await getLeaderboard(limit);

    return createCachedJsonResponse(response, LEADERBOARD_CACHE_CONTROL);
  } catch (error) {
    if (error instanceof LeaderboardQueryError) {
      return createErrorResponse(400, error.code, error.message);
    }

    console.error("Failed to fetch leaderboard.", error);

    return createErrorResponse(
      500,
      "internal_error",
      "Unable to load the leaderboard right now."
    );
  }
}
