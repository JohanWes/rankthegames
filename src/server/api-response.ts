import { getRequestIpHash } from "./ip-hash.ts";
import { enforceRateLimit, type RateLimitResult } from "./rate-limit.ts";

type JsonResponseInit = {
  status?: number;
  headers?: HeadersInit;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export async function enforceRequestRateLimit(request: Request, route: string) {
  return enforceRateLimit({
    route,
    key: getRequestIpHash(request) ?? "ip:unknown"
  });
}

export function createJsonResponse(body: unknown, init: JsonResponseInit = {}) {
  const headers = createNoStoreHeaders(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers
  });
}

export function createErrorResponse(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit
) {
  return createJsonResponse(
    {
      error: {
        code,
        message
      }
    } satisfies ApiErrorBody,
    {
      status,
      headers
    }
  );
}

export function createCachedJsonResponse(body: unknown, cacheControl: string, init: JsonResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", cacheControl);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers
  });
}

export function createNoStoreHeaders(headers?: HeadersInit) {
  const resolvedHeaders = new Headers(headers);
  resolvedHeaders.set("Cache-Control", "no-store");
  return resolvedHeaders;
}

export function applyRateLimitHeaders(headers: Headers, rateLimit: RateLimitResult) {
  headers.set("X-RateLimit-Limit", String(rateLimit.limit));
  headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(rateLimit.resetAt.getTime() / 1000))
  );

  if (rateLimit.retryAfterMs > 0) {
    headers.set("Retry-After", String(Math.ceil(rateLimit.retryAfterMs / 1000)));
  }

  return headers;
}
