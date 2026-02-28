"use client";

import type { CreateRunResponse } from "@/lib/types";

let prefetchedRun: CreateRunResponse | null = null;
let prefetchedRunPromise: Promise<CreateRunResponse> | null = null;

async function requestRun(): Promise<CreateRunResponse> {
  const res = await fetch("/api/runs", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Server error (${res.status})`);
  }

  return (await res.json()) as CreateRunResponse;
}

export function warmRunPrefetch(): Promise<CreateRunResponse> {
  if (prefetchedRun) {
    return Promise.resolve(prefetchedRun);
  }

  if (!prefetchedRunPromise) {
    prefetchedRunPromise = requestRun()
      .then((data) => {
        prefetchedRun = data;
        return data;
      })
      .catch((error) => {
        prefetchedRun = null;
        prefetchedRunPromise = null;
        throw error;
      });
  }

  return prefetchedRunPromise;
}

export async function consumeWarmRun(): Promise<CreateRunResponse> {
  if (prefetchedRun) {
    const data = prefetchedRun;
    prefetchedRun = null;
    prefetchedRunPromise = null;
    return data;
  }

  if (prefetchedRunPromise) {
    try {
      return await prefetchedRunPromise;
    } finally {
      prefetchedRun = null;
      prefetchedRunPromise = null;
    }
  }

  return requestRun();
}

export function resetRunPrefetchForTests() {
  prefetchedRun = null;
  prefetchedRunPromise = null;
}
