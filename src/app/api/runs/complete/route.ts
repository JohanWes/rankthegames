import { ZodError } from "zod";
import { RateLimitExceededError } from "@/server/rate-limit.ts";
import {
  completeRunRequestSchema,
  completeRunSubmission,
  DuplicateRunSubmissionError,
  RunCompletionValidationError,
  RunTokenValidationError
} from "@/server/run-completion.ts";
import {
  applyRateLimitHeaders,
  createErrorResponse,
  createJsonResponse,
  createNoStoreHeaders,
  enforceRequestRateLimit
} from "@/server/api-response.ts";
import { getRequestIpHash } from "@/server/ip-hash.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = createNoStoreHeaders();

  try {
    const body = await parseRequestBody(request);
    const rateLimit = await enforceRequestRateLimit(request, "/api/runs/complete");
    applyRateLimitHeaders(headers, rateLimit);

    const response = await completeRunSubmission(body, getRequestIpHash(request) ?? "ip:unknown");

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
