import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { env } from "../lib/env.ts";
import type { RunPair } from "../lib/types.ts";

const RUN_TOKEN_ISSUER = "rankthegames";
const RUN_TOKEN_AUDIENCE = "game-client";
// Runs are prefetched and may sit idle; replay protection comes from the unique runId index.
const RUN_TOKEN_LIFETIME_SECONDS = 2 * 60 * 60;

export type RunTokenPayload = {
  runId: string;
  snapshotVersion: string;
  roundPairs: RunPair[];
  snapshotScores: Record<string, number>;
};

const nonEmptyString = z.string().trim().min(1);

// Non-strict object: tokens issued before the payload was slimmed carry extra fields that are stripped.
const runTokenPayloadSchema = z.object({
  runId: nonEmptyString,
  snapshotVersion: nonEmptyString,
  roundPairs: z.array(
    z.object({
      round: z.number().int().positive(),
      leftGameId: nonEmptyString,
      rightGameId: nonEmptyString,
      bucket: nonEmptyString
    })
  ),
  snapshotScores: z.record(nonEmptyString, z.number())
});

const signingKey = new TextEncoder().encode(env.RUN_TOKEN_SECRET);

export async function issueRunToken(
  payload: RunTokenPayload
): Promise<{ signedRunToken: string; expiresAt: string }> {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAtSeconds + RUN_TOKEN_LIFETIME_SECONDS;

  const signedRunToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(RUN_TOKEN_ISSUER)
    .setAudience(RUN_TOKEN_AUDIENCE)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(expiresAtSeconds)
    .sign(signingKey);

  return {
    signedRunToken,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
  };
}

export async function verifyRunToken(token: string): Promise<RunTokenPayload> {
  const { payload } = await jwtVerify(token, signingKey, {
    issuer: RUN_TOKEN_ISSUER,
    audience: RUN_TOKEN_AUDIENCE
  });

  return runTokenPayloadSchema.parse(payload);
}
