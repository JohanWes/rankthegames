import { ZodError } from "zod";
import {
  applyRateLimitHeaders,
  createErrorResponse,
  createJsonResponse,
  createNoStoreHeaders
} from "@/server/api-response.ts";
import { getRequestIpHash } from "@/server/ip-hash.ts";
import { enforceRateLimit, RateLimitExceededError } from "@/server/rate-limit.ts";
import {
  completeRunRequestSchema,
  completeRunSubmission,
  DuplicateRunSubmissionError,
  RunCompletionValidationError,
  RunTokenValidationError
} from "@/server/run-completion.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = createNoStoreHeaders();
  const startedAt = performance.now();

  try {
    const body = await parseRequestBody(request);
    const ipHash = getRequestIpHash(request);
    const rateLimit = await enforceRateLimit({ route: "/api/runs/complete", key: ipHash });
    applyRateLimitHeaders(headers, rateLimit);

    const response = await completeRunSubmission(body, ipHash);

    console.info("Completed run.", {
      roundsAccepted: response.roundsAccepted,
      totalMs: Math.round(performance.now() - startedAt)
    });

    return createJsonResponse(response, {
      status: 200,
      headers
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      const rateLimitedHeaders = createNoStoreHeaders(headers);
      rateLimitedHeaders.set("Retry-After", String(Math.ceil(error.retryAfterMs / 1000)));

      return createErrorResponse(
        429,
        "rate_limited",
        "Too many run submissions received. Try again shortly.",
        rateLimitedHeaders
      );
    }

    if (error instanceof ZodError || error instanceof RunCompletionValidationError) {
      return createErrorResponse(
        400,
        error instanceof RunCompletionValidationError ? error.code : "invalid_request",
        "Run submission payload is invalid.",
        headers
      );
    }

    if (error instanceof RunTokenValidationError) {
      return createErrorResponse(401, error.code, error.message, headers);
    }

    if (error instanceof DuplicateRunSubmissionError) {
      return createErrorResponse(409, error.code, error.message, headers);
    }

    console.error("Failed to complete run.", error);

    return createErrorResponse(
      500,
      "internal_error",
      "Unable to complete the run right now.",
      headers
    );
  }
}

async function parseRequestBody(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new RunCompletionValidationError("invalid_json", "Request body must be valid JSON.");
  }

  return completeRunRequestSchema.parse(body);
}
