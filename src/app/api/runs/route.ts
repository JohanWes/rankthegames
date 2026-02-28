import { issueRunToken } from "@/server/run-token.ts";
import { RateLimitExceededError } from "@/server/rate-limit.ts";
import { createRunDefinition } from "@/server/run-builder.ts";
import {
  applyRateLimitHeaders,
  createErrorResponse,
  createJsonResponse,
  createNoStoreHeaders,
  enforceRequestRateLimit
} from "@/server/api-response.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = createNoStoreHeaders();
  let stage = "rate_limit";

  try {
    const rateLimit = await enforceRequestRateLimit(request, "/api/runs");
    applyRateLimitHeaders(headers, rateLimit);

    stage = "build_run";
    const runDefinition = await createRunDefinition();
    stage = "issue_token";
    const token = await issueRunToken({
      runId: runDefinition.runId,
      snapshotVersion: runDefinition.snapshotVersion,
      initialPair: runDefinition.initialPair,
      challengerQueue: runDefinition.challengerQueue,
      snapshotScores: runDefinition.snapshotScores,
      gameIds: runDefinition.gameIds
    });

    return createJsonResponse(
      {
        runId: runDefinition.runId,
        snapshotVersion: runDefinition.snapshotVersion,
        issuedAt: token.issuedAt,
        expiresAt: token.expiresAt,
        bandModel: runDefinition.bandModel,
        initialPair: runDefinition.initialPair,
        challengerQueue: runDefinition.challengerQueue,
        games: runDefinition.games,
        signedRunToken: token.signedRunToken
      },
      {
        status: 201,
        headers
      }
    );
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      const rateLimitedHeaders = createNoStoreHeaders(headers);
      rateLimitedHeaders.set("Retry-After", String(Math.ceil(error.retryAfterMs / 1000)));

      return createErrorResponse(
        429,
        "rate_limited",
        "Too many runs requested. Try again shortly.",
        rateLimitedHeaders
      );
    }

    console.error("Failed to create run.", {
      stage,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return createErrorResponse(
      500,
      "internal_error",
      "Unable to create a run right now.",
      headers
    );
  }
}
