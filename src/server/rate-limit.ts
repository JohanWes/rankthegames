import { MongoServerError } from "mongodb";
import { ensureCoreIndexes, getAppCollections } from "./collections.ts";

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

export const RATE_LIMIT_POLICIES = {
  "/api/runs": {
    limit: 30,
    windowMs: 60_000
  },
  "/api/runs/complete": {
    limit: 15,
    windowMs: 60_000
  }
} as const satisfies Record<string, RateLimitPolicy>;

export type EnforceRateLimitInput = {
  route: string;
  key: string;
  now?: Date;
};

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterMs: number;
};

export class RateLimitExceededError extends Error {
  readonly route: string;
  readonly retryAfterMs: number;

  constructor(route: string, retryAfterMs: number) {
    super(`Rate limit exceeded for ${route}.`);
    this.name = "RateLimitExceededError";
    this.route = route;
    this.retryAfterMs = retryAfterMs;
  }
}

export async function enforceRateLimit(
  input: EnforceRateLimitInput
): Promise<RateLimitResult> {
  const policy = RATE_LIMIT_POLICIES[input.route as keyof typeof RATE_LIMIT_POLICIES];

  if (!policy) {
    throw new Error(`No rate limit policy configured for route: ${input.route}`);
  }

  const collections = await getAppCollections();
  await ensureCoreIndexes();

  const result = await consumeRateLimitRecord(
    {
      ...input,
      ...policy,
      now: input.now ?? new Date()
    },
    collections.rateLimits
  );

  if (!result.allowed) {
    throw new RateLimitExceededError(input.route, result.retryAfterMs);
  }

  return result;
}

async function consumeRateLimitRecord(
  config: EnforceRateLimitInput &
    RateLimitPolicy & {
      now: Date;
    },
  collection: Awaited<ReturnType<typeof getAppCollections>>["rateLimits"],
  attempt = 0
): Promise<RateLimitResult> {
  const windowStart = getWindowStart(config.now, config.windowMs);
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  try {
    const document = await collection.findOneAndUpdate(
      {
        key: config.key,
        route: config.route,
        windowStart
      },
      {
        $setOnInsert: {
          key: config.key,
          route: config.route,
          windowStart,
          expiresAt: resetAt
        },
        $inc: {
          count: 1
        }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    if (!document) {
      throw new Error("Rate limit document was not returned by MongoDB.");
    }

    const remaining = Math.max(0, config.limit - document.count);
    const retryAfterMs = document.count > config.limit ? Math.max(0, resetAt.getTime() - config.now.getTime()) : 0;

    return {
      allowed: document.count <= config.limit,
      count: document.count,
      limit: config.limit,
      remaining,
      resetAt,
      retryAfterMs
    };
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000 && attempt < 1) {
      return consumeRateLimitRecord(config, collection, attempt + 1);
    }

    throw error;
  }
}

function getWindowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}
