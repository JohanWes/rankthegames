import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: nonEmptyString,
  MONGODB_DB_NAME: nonEmptyString,
  RUN_TOKEN_SECRET: z.string().min(32),
  IP_HASH_SALT: z.string().min(32),
  TWITCH_CLIENT_ID: z.string().trim().optional(),
  TWITCH_CLIENT_SECRET: z.string().trim().optional(),
  IGDB_CLIENT_ID: nonEmptyString,
  IGDB_CLIENT_SECRET: nonEmptyString
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsedEnv.data;
export type Env = typeof env;
