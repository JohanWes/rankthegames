import { issueRunToken } from "@/server/run-token.ts";
import { RateLimitExceededError } from "@/server/rate-limit.ts";
import { createRunDefinitionWithMetrics } from "@/server/run-builder.ts";
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
  const requestStartedAt = performance.now();
  let stage = "rate_limit";
  let rateLimitMs = 0;

  try {
    const rateLimitStartedAt = performance.now();
    const rateLimit = await enforceRequestRateLimit(request, "/api/runs");
    rateLimitMs = Math.round(performance.now() - rateLimitStartedAt);
    applyRateLimitHeaders(headers, rateLimit);

    stage = "build_run";
    const { runDefinition, metrics } = await createRunDefinitionWithMetrics();
    stage = "issue_token";
    const tokenStartedAt = performance.now();
    const token = await issueRunToken({
      runId: runDefinition.runId,
      snapshotVersion: runDefinition.snapshotVersion,
      initialPair: runDefinition.initialPair,
      challengerQueue: runDefinition.challengerQueue,
      snapshotScores: runDefinition.snapshotScores,
      gameIds: runDefinition.gameIds
    });
    const tokenIssueMs = Math.round(performance.now() - tokenStartedAt);

    console.info("Created run.", {
      rateLimitMs,
      snapshotCacheStatus: metrics.snapshot.cacheStatus,
      snapshotDbFetchMs: metrics.snapshot.dbFetchMs,
      snapshotMs: metrics.snapshot.totalMs,
      snapshotGameCount: metrics.snapshot.gameCount,
      runBuildMs: metrics.buildRunMs,
      tokenIssueMs,
      totalMs: Math.round(performance.now() - requestStartedAt)
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
