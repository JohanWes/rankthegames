import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBeaconSubmit } from "./useBeaconSubmit";

const baseParams = {
  runId: "run-123",
  signedRunToken: "token-abc",
  selections: [
    { round: 1, pickedGameId: "g1", completedAt: "2024-01-01T00:00:01.000Z" }
  ]
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
      await result.current.submitRun();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/runs/complete",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true
      })
    );

    const callBody = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(callBody.runId).toBe("run-123");
    expect(callBody.signedRunToken).toBe("token-abc");
    expect(callBody.selections).toHaveLength(1);
    expect(callBody).not.toHaveProperty("endedReason");
  });

  it("does not double-submit", async () => {
    const { result } = renderHook(() => useBeaconSubmit());

    act(() => {
      result.current.setRunParams(baseParams);
    });

    await act(async () => {
      await result.current.submitRun();
    });
    await act(async () => {
      await result.current.submitRun();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("resetSubmission allows re-submission", async () => {
    const { result } = renderHook(() => useBeaconSubmit());

    act(() => {
      result.current.setRunParams(baseParams);
    });

    await act(async () => {
      await result.current.submitRun();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.resetSubmission();
      result.current.setRunParams({ ...baseParams, runId: "run-456" });
    });

    await act(async () => {
      await result.current.submitRun();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("beacons the partial run on pagehide and does not resubmit", async () => {
    const { result } = renderHook(() => useBeaconSubmit());

    act(() => {
      result.current.setRunParams(baseParams);
    });

    window.dispatchEvent(new Event("pagehide"));
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.submitRun();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("beacons an unsubmitted run on unmount", () => {
    const { result, unmount } = renderHook(() => useBeaconSubmit());

    act(() => {
      result.current.setRunParams(baseParams);
    });

    unmount();
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  });
});
