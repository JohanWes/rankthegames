"use client";

import { getImageProps } from "next/image";
import { preload } from "react-dom";
import type { CreateRunResponse } from "@/lib/types";

/** Must match the `sizes` GameCard passes to <Image> so preloads hit the same srcset candidate. */
export const CARD_IMAGE_SIZES = "(max-width: 768px) 50vw, (max-width: 1280px) 440px, 520px";

/** A warmed run with less than this much token lifetime left is discarded. */
const MIN_REMAINING_MS = 30 * 60_000;

let prefetchedRun: CreateRunResponse | null = null;
let prefetchedRunPromise: Promise<CreateRunResponse> | null = null;

export function preloadCover(url: string) {
  const { props } = getImageProps({ src: url, alt: "", fill: true, sizes: CARD_IMAGE_SIZES });
  preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes });
}

function preloadFirstPair(run: CreateRunResponse) {
  const pair = run.roundPairs.find((p) => p.round === 1);
  if (!pair) return;
  for (const id of [pair.leftGameId, pair.rightGameId]) {
    const url = run.games[id]?.imageUrl;
    if (url) preloadCover(url);
  }
}

async function requestRun(): Promise<CreateRunResponse> {
  const res = await fetch("/api/runs", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Server error (${res.status})`);
  }

  return (await res.json()) as CreateRunResponse;
}

function clearWarmRun() {
  prefetchedRun = null;
  prefetchedRunPromise = null;
}

function dropStaleWarmRun() {
  if (prefetchedRun && Date.parse(prefetchedRun.expiresAt) - Date.now() < MIN_REMAINING_MS) {
    clearWarmRun();
  }
}

export function warmRunPrefetch(): Promise<CreateRunResponse> {
  dropStaleWarmRun();

  if (prefetchedRun) {
    return Promise.resolve(prefetchedRun);
  }

  if (!prefetchedRunPromise) {
    prefetchedRunPromise = requestRun()
      .then((data) => {
        prefetchedRun = data;
        preloadFirstPair(data);
        return data;
      })
      .catch((error) => {
        clearWarmRun();
        throw error;
      });
  }

  return prefetchedRunPromise;
}

/** Synchronously take the warmed run if it has already resolved and is still fresh. */
export function takeWarmRunIfReady(): CreateRunResponse | null {
  dropStaleWarmRun();
  const run = prefetchedRun;
  if (run) clearWarmRun();
  return run;
}

export async function consumeWarmRun(): Promise<CreateRunResponse> {
  const ready = takeWarmRunIfReady();
  if (ready) return ready;

  if (prefetchedRunPromise) {
    try {
      return await prefetchedRunPromise;
    } finally {
      clearWarmRun();
    }
  }

  return requestRun();
}

export function resetRunPrefetchForTests() {
  clearWarmRun();
}
