import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGame } from "./useGame";
import { createMockRunResponse } from "@/test/helpers/mock-data";
import { resetRunPrefetchForTests, warmRunPrefetch } from "@/lib/run-prefetch";

const mockRun = createMockRunResponse();

function mockFetchSuccess(data = mockRun) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data)
  });
}

function mockFetchFailure(status = 500) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ message: "Server error" })
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetRunPrefetchForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetRunPrefetchForTests();
});

describe("useGame", () => {
  it("starts in LOADING state", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useGame());
    expect(result.current.phase).toBe("LOADING");
  });

  it("transitions to AWAITING_CHOICE after successful fetch", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useGame());

    // Wait for fetch to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.phase).toBe("AWAITING_CHOICE");
    expect(result.current.leftGame?.id).toBe("g1");
    expect(result.current.rightGame?.id).toBe("g2");
    expect(result.current.currentRound).toBe(1);
    expect(result.current.streak).toBe(0);
  });

  it("consumes a warmed run instead of issuing a second bootstrap fetch", async () => {
    mockFetchSuccess();

    await warmRunPrefetch();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.phase).toBe("AWAITING_CHOICE");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("correct pick flows through REVEALING → CORRECT → AWAITING_CHOICE with new pair", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.phase).toBe("AWAITING_CHOICE");

    // Pick the correct game (g1 has higher score 600 >= 500)
    act(() => {
      result.current.selectGame("g1");
    });
    expect(result.current.phase).toBe("REVEALING");

    // Advance reveal timer (900ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(result.current.phase).toBe("CORRECT");
    expect(result.current.streak).toBe(1);

    // Advance transition timer (1100ms) → TRANSITIONING
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(result.current.phase).toBe("TRANSITIONING");

    // Advance swap timer (500ms) → AWAITING_CHOICE
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.phase).toBe("AWAITING_CHOICE");
    expect(result.current.currentRound).toBe(2);

    // Winner-stays: picked game (g1) becomes left, challenger (g3) becomes right
    expect(result.current.leftGame?.id).toBe("g1");
    expect(result.current.rightGame?.id).toBe("g3");
  });

  it("incorrect pick flows through REVEALING → INCORRECT → GAME_OVER", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Pick wrong game (g2 has lower score)
    act(() => {
      result.current.selectGame("g2");
    });
    expect(result.current.phase).toBe("REVEALING");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(result.current.phase).toBe("INCORRECT");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(result.current.phase).toBe("GAME_OVER");
    expect(result.current.streak).toBe(0);
  });

  it("streak increments on correct picks", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Round 1: pick g1 (correct)
    act(() => result.current.selectGame("g1"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    expect(result.current.streak).toBe(1);
    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    await act(async () => await vi.advanceTimersByTimeAsync(500));

    // Round 2: g1 (600) vs g3 (490). Pick g1 (correct)
    expect(result.current.leftGame?.id).toBe("g1");
    act(() => result.current.selectGame("g1"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    expect(result.current.streak).toBe(2);
    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    await act(async () => await vi.advanceTimersByTimeAsync(500));

    expect(result.current.currentRound).toBe(3);
  });

  it("persists high score to localStorage", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Make a correct pick
    act(() => result.current.selectGame("g1"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    await act(async () => await vi.advanceTimersByTimeAsync(1100));

    expect(result.current.highScore).toBe(1);
    expect(localStorage.getItem("rankthegames_highscore")).toBe("1");
  });

  it("loads high score from localStorage on new run", async () => {
    localStorage.setItem("rankthegames_highscore", "5");
    mockFetchSuccess();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.highScore).toBe(5);
    expect(result.current.previousStreak).toBe(5);
  });

  it("playAgain resets and fetches new run", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Make a pick and go to game over
    act(() => result.current.selectGame("g2"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    expect(result.current.phase).toBe("GAME_OVER");

    // Play again
    const newRun = createMockRunResponse({ runId: "test-run-002" });
    mockFetchSuccess(newRun);
    act(() => result.current.playAgain());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.phase).toBe("AWAITING_CHOICE");
    expect(result.current.streak).toBe(0);
    expect(result.current.currentRound).toBe(1);
  });

  it("sets error on fetch failure", async () => {
    mockFetchFailure();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.phase).toBe("LOADING");
    expect(result.current.error).toBe("Server error");
  });

  it("winner-stays: picked game becomes leftGame, next challenger becomes rightGame", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Round 1: pick g1 (left, correct). g1 stays left, g3 enters right
    act(() => result.current.selectGame("g1"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    await act(async () => await vi.advanceTimersByTimeAsync(500));
    expect(result.current.leftGame?.id).toBe("g1");
    expect(result.current.rightGame?.id).toBe("g3");

    // Round 2: pick g1 again (600 > 490). g1 stays left, g4 enters right
    act(() => result.current.selectGame("g1"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    await act(async () => await vi.advanceTimersByTimeAsync(500));
    expect(result.current.leftGame?.id).toBe("g1");
    expect(result.current.rightGame?.id).toBe("g4");

    // Round 3: pick challenger g4 instead.
    // g1 score=600, g4 score=460 → g1 is correct. Picking g4 is WRONG.
    act(() => result.current.selectGame("g4"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    expect(result.current.phase).toBe("INCORRECT");
  });
});
