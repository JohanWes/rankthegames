import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGame } from "@/hooks/useGame";
import { createMockRunResponse } from "@/test/helpers/mock-data";
import { resetRunPrefetchForTests } from "@/lib/run-prefetch";

const mockRun = createMockRunResponse();

let fetchCalls: Array<{ url: string; init: RequestInit }> = [];

function setupFetch() {
  fetchCalls = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    fetchCalls.push({ url, init: init ?? {} });

    if (url === "/api/runs") {
      return {
        ok: true,
        json: () => Promise.resolve(mockRun)
      } as Response;
    }

    if (url === "/api/runs/complete") {
      return {
        ok: true,
        json: () =>
          Promise.resolve({
            accepted: true,
            roundsAccepted: 4,
            finalScore: 3,
            ratingVersion: "2024-01-01T00:00:00.000Z"
          })
      } as Response;
    }

    return { ok: false, status: 404, json: () => Promise.resolve({}) } as Response;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetRunPrefetchForTests();
  setupFetch();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetRunPrefetchForTests();
});

describe("End-to-end gameplay flow", () => {
  it("create run → 3 correct picks → 1 wrong pick → GAME_OVER → playAgain", async () => {
    const { result } = renderHook(() => useGame());

    // Wait for initial run fetch
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.phase).toBe("AWAITING_CHOICE");
    expect(result.current.currentRound).toBe(1);

    // Verify run creation was called
    expect(fetchCalls[0].url).toBe("/api/runs");

    // --- Round 1: correct pick (g1 has score 600 >= g2 score 500) ---
    act(() => result.current.selectGame("g1"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    await act(async () => await vi.advanceTimersByTimeAsync(500));
    expect(result.current.phase).toBe("AWAITING_CHOICE");
    expect(result.current.streak).toBe(1);
    expect(result.current.currentRound).toBe(2);
    expect(result.current.leftGame?.id).toBe("g1");
    expect(result.current.rightGame?.id).toBe("g3");

    // --- Round 2: correct pick (g1 score 600 >= g3 score 490) ---
    act(() => result.current.selectGame("g1"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    await act(async () => await vi.advanceTimersByTimeAsync(500));
    expect(result.current.streak).toBe(2);
    expect(result.current.currentRound).toBe(3);
    expect(result.current.rightGame?.id).toBe("g4");

    // --- Round 3: correct pick (g1 score 600 >= g4 score 460) ---
    act(() => result.current.selectGame("g1"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    await act(async () => await vi.advanceTimersByTimeAsync(500));
    expect(result.current.streak).toBe(3);
    expect(result.current.currentRound).toBe(4);
    expect(result.current.rightGame?.id).toBe("g5");

    // --- Round 4: wrong pick (g5 score 450 < g1 score 600) ---
    act(() => result.current.selectGame("g5"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    expect(result.current.phase).toBe("INCORRECT");

    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    expect(result.current.phase).toBe("GAME_OVER");
    expect(result.current.streak).toBe(3);

    // Verify selections shape
    const selections = result.current.selections;
    expect(selections).toHaveLength(4);
    expect(selections[0].round).toBe(1);
    expect(selections[1].round).toBe(2);
    expect(selections[2].round).toBe(3);
    expect(selections[3].round).toBe(4);
    expect(selections[3].pickedGameId).toBe("g5");

    // Verify rounds are contiguous
    for (let i = 0; i < selections.length; i++) {
      expect(selections[i].round).toBe(i + 1);
    }

    // --- Play again ---
    const newRun = createMockRunResponse({ runId: "test-run-new" });
    fetchCalls = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      fetchCalls.push({ url, init: init ?? {} });
      if (url === "/api/runs") {
        return { ok: true, json: () => Promise.resolve(newRun) } as Response;
      }
      return { ok: true, json: () => Promise.resolve({}) } as Response;
    });

    act(() => result.current.playAgain());
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.phase).toBe("AWAITING_CHOICE");
    expect(result.current.streak).toBe(0);
    expect(result.current.currentRound).toBe(1);
    expect(fetchCalls.some((c) => c.url === "/api/runs")).toBe(true);
  });
});
