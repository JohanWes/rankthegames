import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBeaconSubmit } from "./useBeaconSubmit";

const baseParams = {
  runId: "run-123",
  signedRunToken: "token-abc",
  selections: [
    { round: 1, pickedGameId: "g1", completedAt: "2024-01-01T00:00:01.000Z" }
  ],
  endedReason: "abandoned" as const,
  startedAt: Date.now() - 5000
};

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
  Object.defineProperty(navigator, "sendBeacon", {
    value: vi.fn().mockReturnValue(true),
    writable: true,
    configurable: true
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useBeaconSubmit", () => {
  it("submitRun sends correct payload via fetch", async () => {
    const { result } = renderHook(() => useBeaconSubmit());

    act(() => {
      result.current.setRunParams(baseParams);
    });

    await act(async () => {
      await result.current.submitRun("wrong_guess");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/runs/complete",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );

    const callBody = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(callBody.runId).toBe("run-123");
    expect(callBody.signedRunToken).toBe("token-abc");
    expect(callBody.endedReason).toBe("wrong_guess");
    expect(callBody.selections).toHaveLength(1);
    expect(typeof callBody.clientRunDurationMs).toBe("number");
  });

  it("does not double-submit", async () => {
    const { result } = renderHook(() => useBeaconSubmit());

    act(() => {
      result.current.setRunParams(baseParams);
    });

    await act(async () => {
      await result.current.submitRun("wrong_guess");
    });
    await act(async () => {
      await result.current.submitRun("wrong_guess");
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("resetSubmission allows re-submission", async () => {
    const { result } = renderHook(() => useBeaconSubmit());

    act(() => {
      result.current.setRunParams(baseParams);
    });

    await act(async () => {
      await result.current.submitRun("wrong_guess");
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.resetSubmission();
      result.current.setRunParams({ ...baseParams, runId: "run-456" });
    });

    await act(async () => {
      await result.current.submitRun("max_rounds");
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("registers and cleans up visibility listeners", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useBeaconSubmit());

    expect(addSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
  });
});
