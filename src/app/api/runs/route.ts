import type { CreateRunResponse } from "@/lib/types";
import {
  applyRateLimitHeaders,
  createErrorResponse,
  createJsonResponse,
  createNoStoreHeaders
} from "@/server/api-response.ts";
import { getRequestIpHash } from "@/server/ip-hash.ts";
import { enforceRateLimit, RateLimitExceededError } from "@/server/rate-limit.ts";
import { createRunDefinition } from "@/server/run-builder.ts";
import { issueRunToken } from "@/server/run-token.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = createNoStoreHeaders();
  const startedAt = performance.now();

  try {
    // The build is cached CPU work, so it runs alongside the rate-limit check.
    const [rateLimit, run] = await Promise.all([
      enforceRateLimit({ route: "/api/runs", key: getRequestIpHash(request) }),
      createRunDefinition()
    ]);
    applyRateLimitHeaders(headers, rateLimit);

    const token = await issueRunToken({
      runId: run.runId,
      snapshotVersion: run.snapshotVersion,
      roundPairs: run.roundPairs,
      snapshotScores: Object.fromEntries(
        Object.values(run.games).map((game) => [game.id, game.snapshotScore])
      )
    });

    console.info("Created run.", {
      roundCount: run.roundPairs.length,
      totalMs: Math.round(performance.now() - startedAt)
    });

    return createJsonResponse(
      {
        runId: run.runId,
        expiresAt: token.expiresAt,
        roundPairs: run.roundPairs,
        games: run.games,
        signedRunToken: token.signedRunToken
      } satisfies CreateRunResponse,
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
