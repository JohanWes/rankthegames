import { createHash } from "node:crypto";
import { env } from "../lib/env.ts";

type RequestLike = Pick<Request, "headers">;

export function extractClientIp(request: RequestLike): string | null {
  const prioritizedHeaders = ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"];

  for (const headerName of prioritizedHeaders) {
    const rawValue = request.headers.get(headerName);

    if (!rawValue) {
      continue;
    }

    const [firstValue] = rawValue.split(",");
    const normalized = normalizeIp(firstValue);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function normalizeIp(ip: string | null | undefined): string {
  if (!ip) {
    return "";
  }

  return ip.trim().toLowerCase().replace(/^::ffff:/, "");
}

export function hashIp(ip: string): string {
  const normalizedIp = normalizeIp(ip);

  if (!normalizedIp) {
    throw new Error("IP address is required for hashing.");
  }

  return createHash("sha256")
    .update(`${env.IP_HASH_SALT}:${normalizedIp}`, "utf8")
    .digest("hex");
}

export function getRequestIpHash(request: RequestLike): string | null {
  const ip = extractClientIp(request);
  return ip ? hashIp(ip) : null;
}
