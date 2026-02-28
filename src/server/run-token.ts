import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { env } from "../lib/env.ts";

const RUN_TOKEN_ISSUER = "thisorthatgame";
const RUN_TOKEN_AUDIENCE = "game-client";
const RUN_TOKEN_LIFETIME_SECONDS = 15 * 60;

export type RunPair = {
  leftGameId: string;
  rightGameId: string;
};

export type RunChallenger = {
  round: number;
  gameId: string;
  bucket: string;
};

export type RunTokenPayload = {
  iss: "thisorthatgame";
  aud: "game-client";
  runId: string;
  snapshotVersion: string;
  issuedAt: string;
  expiresAt: string;
  initialPair: RunPair;
  challengerQueue: RunChallenger[];
  snapshotScores: Record<string, number>;
  gameIds: string[];
};

export type IssuedRunToken = {
  signedRunToken: string;
  issuedAt: string;
  expiresAt: string;
};

const runTokenPayloadSchema = z.object({
  iss: z.literal(RUN_TOKEN_ISSUER),
  aud: z.union([z.literal(RUN_TOKEN_AUDIENCE), z.array(z.literal(RUN_TOKEN_AUDIENCE))]),
  runId: z.string().trim().min(1),
  snapshotVersion: z.string().trim().min(1),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  initialPair: z.object({
    leftGameId: z.string().trim().min(1),
    rightGameId: z.string().trim().min(1)
  }),
  challengerQueue: z.array(
    z.object({
      round: z.number().int().positive(),
      gameId: z.string().trim().min(1),
      bucket: z.string().trim().min(1)
    })
  ),
  snapshotScores: z.record(z.string().trim().min(1), z.number()),
  gameIds: z.array(z.string().trim().min(1)).min(2)
});

type IssueRunTokenInput = Omit<RunTokenPayload, "iss" | "aud" | "issuedAt" | "expiresAt"> & {
  issuedAt?: Date;
  expiresInSeconds?: number;
};

const signingKey = new TextEncoder().encode(env.RUN_TOKEN_SECRET);

export async function issueRunToken(input: IssueRunTokenInput): Promise<IssuedRunToken> {
  const issuedAtDate = input.issuedAt ?? new Date();
  const expiresAtDate = new Date(
    issuedAtDate.getTime() + (input.expiresInSeconds ?? RUN_TOKEN_LIFETIME_SECONDS) * 1000
  );
  const issuedAt = issuedAtDate.toISOString();
  const expiresAt = expiresAtDate.toISOString();

  const signedRunToken = await new SignJWT({
    runId: input.runId,
    snapshotVersion: input.snapshotVersion,
    issuedAt,
    expiresAt,
    initialPair: input.initialPair,
    challengerQueue: input.challengerQueue,
    snapshotScores: input.snapshotScores,
    gameIds: input.gameIds
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(RUN_TOKEN_ISSUER)
    .setAudience(RUN_TOKEN_AUDIENCE)
    .setIssuedAt(Math.floor(issuedAtDate.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAtDate.getTime() / 1000))
    .sign(signingKey);

  return {
    signedRunToken,
    issuedAt,
    expiresAt
  };
}

export async function verifyRunToken(token: string): Promise<RunTokenPayload> {
  const { payload } = await jwtVerify(token, signingKey, {
    issuer: RUN_TOKEN_ISSUER,
    audience: RUN_TOKEN_AUDIENCE
  });

  const parsedPayload = runTokenPayloadSchema.parse(payload);

  return {
    ...parsedPayload,
    aud: RUN_TOKEN_AUDIENCE
  };
}

export const runTokenConfig = {
  issuer: RUN_TOKEN_ISSUER,
  audience: RUN_TOKEN_AUDIENCE,
  lifetimeSeconds: RUN_TOKEN_LIFETIME_SECONDS
} as const;
