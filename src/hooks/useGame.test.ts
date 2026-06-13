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

async function playCurrentCorrectRound(result: { current: ReturnType<typeof useGame> }) {
  const leftGame = result.current.leftGame;
  const rightGame = result.current.rightGame;

  if (!leftGame || !rightGame) {
    throw new Error("Cannot play a round without two games.");
  }

  const pickedGameId =
    leftGame.snapshotScore >= rightGame.snapshotScore ? leftGame.id : rightGame.id;

  act(() => result.current.selectGame(pickedGameId));
  await act(async () => await vi.advanceTimersByTimeAsync(900));
  await act(async () => await vi.advanceTimersByTimeAsync(1100));
  await act(async () => await vi.advanceTimersByTimeAsync(500));

  if (result.current.phase === "ROUND_INTRO") {
    await act(async () => await vi.advanceTimersByTimeAsync(1200));
  }
}

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

    // Opening bracket round 2 is the next issued opening pair.
    expect(result.current.leftGame?.id).toBe("g3");
    expect(result.current.rightGame?.id).toBe("g4");
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

    // Round 2: g3 (580) vs g4 (570). Pick g3 (correct)
    expect(result.current.leftGame?.id).toBe("g3");
    act(() => result.current.selectGame("g3"));
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

  it("goes to TOURNAMENT_COMPLETE after completing all 15 bracket rounds correctly", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    for (let round = 1; round <= 15; round++) {
      await playCurrentCorrectRound(result);
    }

    expect(result.current.phase).toBe("TOURNAMENT_COMPLETE");
    expect(result.current.streak).toBe(15);
  });

  it("continueAfterReset preserves streak and loads new run", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    for (let round = 1; round <= 15; round++) {
      await playCurrentCorrectRound(result);
    }

    expect(result.current.phase).toBe("TOURNAMENT_COMPLETE");
    expect(result.current.streak).toBe(15);

    // Continue after reset with a new run
    const newRun = createMockRunResponse({ runId: "test-run-002" });
    mockFetchSuccess(newRun);

    await act(async () => {
      result.current.continueAfterReset();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.phase).toBe("AWAITING_CHOICE");
    expect(result.current.streak).toBe(15); // Streak preserved
    expect(result.current.currentRound).toBe(1); // Round reset
    expect(result.current.runId).toBe("test-run-002");
  });

  it("advances to the next issued fixed pair instead of carrying the picked game", async () => {
    const fixedRun = createMockRunResponse({
      roundPairs: [
        { round: 1, leftGameId: "g1", rightGameId: "g2", bucket: "warmup:recognizable" },
        { round: 2, leftGameId: "g3", rightGameId: "g4", bucket: "core:balanced" },
        { round: 3, leftGameId: "g1", rightGameId: "g5", bucket: "core:balanced" }
      ]
    });
    fixedRun.games.g3.snapshotScore = 490;
    fixedRun.games.g4.snapshotScore = 460;
    mockFetchSuccess(fixedRun);
    const { result } = renderHook(() => useGame());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Round 1: pick g1 (left, correct). Round 2 should use the issued g3 vs g4 pair.
    act(() => result.current.selectGame("g1"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    await act(async () => await vi.advanceTimersByTimeAsync(500));
    expect(result.current.leftGame?.id).toBe("g3");
    expect(result.current.rightGame?.id).toBe("g4");

    // Round 2: pick g3 correctly. Round 3 is issued as g1 vs g5, not g3 vs g5.
    act(() => result.current.selectGame("g3"));
    await act(async () => await vi.advanceTimersByTimeAsync(900));
    await act(async () => await vi.advanceTimersByTimeAsync(1100));
    await act(async () => await vi.advanceTimersByTimeAsync(500));
    expect(result.current.leftGame?.id).toBe("g1");
    expect(result.current.rightGame?.id).toBe("g5");
  });
});
