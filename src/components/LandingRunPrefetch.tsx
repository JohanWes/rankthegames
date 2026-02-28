"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { warmRunPrefetch } from "@/lib/run-prefetch";

export function LandingRunPrefetch() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/game");
    void warmRunPrefetch().catch(() => {
      // Ignore warmup failures and let the game page retry on demand.
    });
  }, [router]);

  return null;
}
