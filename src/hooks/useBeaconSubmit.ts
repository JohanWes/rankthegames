"use client";

import { useRef, useEffect, useCallback } from "react";
import type { CompleteRunRequest } from "@/lib/types";

const COMPLETE_URL = "/api/runs/complete";

export function useBeaconSubmit() {
  const submittedRef = useRef(false);
  const paramsRef = useRef<CompleteRunRequest | null>(null);

  /** Update the latest run params so the beacon can use them. */
  const setRunParams = useCallback((params: CompleteRunRequest | null) => {
    paramsRef.current = params;
  }, []);

  /** Returns the body to submit once per run, or null if already submitted. */
  const claimSubmission = useCallback((): string | null => {
    if (submittedRef.current || !paramsRef.current) return null;
    submittedRef.current = true;
    return JSON.stringify(paramsRef.current);
  }, []);

  /** Normal fetch-based submission (game over / tournament complete). */
  const submitRun = useCallback(async () => {
    const body = claimSubmission();
    if (!body) return;

    try {
      await fetch(COMPLETE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      });
    } catch {
      // Best effort — fire-and-forget
    }
  }, [claimSubmission]);

  /** Reset submission guard for a new run. */
  const resetSubmission = useCallback(() => {
    submittedRef.current = false;
    paramsRef.current = null;
  }, []);

  // Beacon the partial run when the page is torn down (tab close, reload,
  // external navigation) or this hook unmounts (in-app navigation).
  useEffect(() => {
    const sendBeacon = () => {
      const body = claimSubmission();
      if (!body) return;
      navigator.sendBeacon(COMPLETE_URL, new Blob([body], { type: "application/json" }));
    };

    window.addEventListener("pagehide", sendBeacon);
    return () => {
      window.removeEventListener("pagehide", sendBeacon);
      sendBeacon();
    };
  }, [claimSubmission]);

  return { submitRun, setRunParams, resetSubmission };
}
