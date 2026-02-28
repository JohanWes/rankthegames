"use client";

import { useRef, useEffect, useCallback } from "react";
import type { CompleteRunRequest, RunSelection } from "@/lib/types";

type SubmitParams = {
  runId: string;
  signedRunToken: string;
  selections: RunSelection[];
  endedReason: CompleteRunRequest["endedReason"];
  startedAt: number;
};

export function useBeaconSubmit() {
  const submittedRef = useRef(false);
  const paramsRef = useRef<SubmitParams | null>(null);

  /** Update the latest run params so beacon listeners can use them. */
  const setRunParams = useCallback((params: SubmitParams | null) => {
    paramsRef.current = params;
  }, []);

  /** Normal fetch-based submission (game over / max rounds). */
  const submitRun = useCallback(
    async (endedReason: CompleteRunRequest["endedReason"]) => {
      if (submittedRef.current || !paramsRef.current) return;
      submittedRef.current = true;

      const params = paramsRef.current;
      const body: CompleteRunRequest = {
        runId: params.runId,
        signedRunToken: params.signedRunToken,
        selections: params.selections,
        endedReason,
        clientRunDurationMs: Date.now() - params.startedAt
      };

      try {
        await fetch("/api/runs/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      } catch {
        // Best effort — fire-and-forget
      }
    },
    []
  );

  /** Reset submission guard for a new run. */
  const resetSubmission = useCallback(() => {
    submittedRef.current = false;
    paramsRef.current = null;
  }, []);

  // Beacon-based submission for tab close / navigation away
  useEffect(() => {
    const sendBeacon = () => {
      if (submittedRef.current || !paramsRef.current) return;
      submittedRef.current = true;

      const params = paramsRef.current;
      const body: CompleteRunRequest = {
        runId: params.runId,
        signedRunToken: params.signedRunToken,
        selections: params.selections,
        endedReason: "abandoned",
        clientRunDurationMs: Date.now() - params.startedAt
      };

      const blob = new Blob([JSON.stringify(body)], {
        type: "application/json"
      });
      navigator.sendBeacon("/api/runs/complete", blob);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendBeacon();
      }
    };

    const handleBeforeUnload = () => {
      sendBeacon();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return { submitRun, setRunParams, resetSubmission };
}
