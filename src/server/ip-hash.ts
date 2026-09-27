import { createHash } from "node:crypto";
import { env } from "../lib/env.ts";

// Vercel sets both headers and does not let clients overwrite them. Do not trust
// headers such as cf-connecting-ip, which Vercel passes through unmodified.
const CLIENT_IP_HEADERS = ["x-real-ip", "x-forwarded-for"];

export function getRequestIpHash(request: Pick<Request, "headers">): string {
  for (const headerName of CLIENT_IP_HEADERS) {
    const ip = request.headers
      .get(headerName)
      ?.split(",")[0]
      .trim()
      .toLowerCase()
      .replace(/^::ffff:/, "");

    if (ip) {
      return createHash("sha256").update(`${env.IP_HASH_SALT}:${ip}`, "utf8").digest("hex");
    }
  }

  return "ip:unknown";
}
