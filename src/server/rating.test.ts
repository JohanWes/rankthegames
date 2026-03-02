import { describe, expect, it } from "vitest";
import {
  getRatingDelta,
  getConfidenceMultiplier,
  applyRatingDelta,
  RATING_CONSTANTS
} from "./rating.ts";

const LEFT_ID = "left-game";
const RIGHT_ID = "right-game";

function expectedWin(gap: number, opts?: { leftMatches?: number; rightMatches?: number }) {
  return getRatingDelta({
    leftGameId: LEFT_ID,
    leftScore: 500 + gap,
    rightGameId: RIGHT_ID,
    rightScore: 500,
    pickedGameId: LEFT_ID,
    leftTotalMatches: opts?.leftMatches,
    rightTotalMatches: opts?.rightMatches,
  });
}

function upset(gap: number, opts?: { leftMatches?: number; rightMatches?: number }) {
  return getRatingDelta({
    leftGameId: LEFT_ID,
    leftScore: 500 + gap,
    rightGameId: RIGHT_ID,
    rightScore: 500,
    pickedGameId: RIGHT_ID,
    leftTotalMatches: opts?.leftMatches,
    rightTotalMatches: opts?.rightMatches,
  });
}

describe("getRatingDelta - smooth curve", () => {
  describe("expected wins (higher-rated game picked)", () => {
    it.each([
      { gap: 0, expectedDelta: 4, label: "tie" },
      { gap: 50, expectedDelta: 2, label: "small gap" },
      { gap: 100, expectedDelta: 2, label: "medium gap" },
      { gap: 200, expectedDelta: 1, label: "large gap" },
      { gap: 500, expectedDelta: 1, label: "huge gap" },
      { gap: 1000, expectedDelta: 1, label: "extreme gap" },
    ])("gap=$gap ($label) → winnerDelta=$expectedDelta", ({ gap, expectedDelta }) => {
      const result = expectedWin(gap, { leftMatches: 200, rightMatches: 200 });
      expect(result.winnerDelta).toBe(expectedDelta);
      expect(result.wasUpset).toBe(false);
    });
  });

  describe("upsets (lower-rated game picked)", () => {
    it.each([
      { gap: 50, expectedDelta: 5, label: "small gap upset" },
      { gap: 100, expectedDelta: 8, label: "small upset" },
      { gap: 200, expectedDelta: 12, label: "medium upset" },
      { gap: 300, expectedDelta: 14, label: "large upset" },
      { gap: 500, expectedDelta: 17, label: "huge upset" },
      { gap: 1000, expectedDelta: 20, label: "extreme upset" },
    ])("gap=$gap ($label) → winnerDelta=$expectedDelta", ({ gap, expectedDelta }) => {
      const result = upset(gap, { leftMatches: 200, rightMatches: 200 });
      expect(result.winnerDelta).toBe(expectedDelta);
    });
  });

  it("returns symmetric deltas for tied scores", () => {
    const result = getRatingDelta({
      leftGameId: LEFT_ID,
      leftScore: 500,
      rightGameId: RIGHT_ID,
      rightScore: 500,
      pickedGameId: LEFT_ID,
      leftTotalMatches: 200,
      rightTotalMatches: 200,
    });

    expect(result.expectedWinnerId).toBeNull();
    expect(result.wasUpset).toBe(false);
    expect(result.winnerDelta).toBe(-result.loserDelta);
  });

  it("never returns a delta below MIN_DELTA", () => {
    const result = expectedWin(10_000, { leftMatches: 200, rightMatches: 200 });
    expect(result.winnerDelta).toBeGreaterThanOrEqual(RATING_CONSTANTS.MIN_DELTA);
  });

  it("never returns a delta above MAX_DELTA", () => {
    const result = upset(100_000, { leftMatches: 0, rightMatches: 0 });
    expect(result.winnerDelta).toBeLessThanOrEqual(RATING_CONSTANTS.MAX_DELTA);
  });

  it("clamps loser delta to MIN_SCORE floor", () => {
    const result = getRatingDelta({
      leftGameId: LEFT_ID,
      leftScore: 500,
      rightGameId: RIGHT_ID,
      rightScore: 1,
      pickedGameId: LEFT_ID,
      leftTotalMatches: 200,
      rightTotalMatches: 200,
    });

    expect(result.loserDelta).toBe(0);
  });

  it("throws when pickedGameId does not match either game", () => {
    expect(() =>
      getRatingDelta({
        leftGameId: LEFT_ID,
        leftScore: 500,
        rightGameId: RIGHT_ID,
        rightScore: 500,
        pickedGameId: "unknown",
      })
    ).toThrow(RangeError);
  });

  it("identifies the expected winner correctly", () => {
    const result = expectedWin(100, { leftMatches: 200, rightMatches: 200 });
    expect(result.expectedWinnerId).toBe(LEFT_ID);
  });

  it("marks upset correctly when lower-rated game wins", () => {
    const result = upset(100, { leftMatches: 200, rightMatches: 200 });
    expect(result.wasUpset).toBe(true);
  });

  it("does not mark as upset when gap is zero", () => {
    const result = upset(0, { leftMatches: 200, rightMatches: 200 });
    expect(result.wasUpset).toBe(false);
  });

  it("produces integer deltas", () => {
    for (const gap of [0, 10, 37, 99, 100, 150, 250, 400, 600, 999]) {
      const expected = expectedWin(gap, { leftMatches: 200, rightMatches: 200 });
      const upsetResult = upset(gap, { leftMatches: 200, rightMatches: 200 });
      expect(Number.isInteger(expected.winnerDelta)).toBe(true);
      expect(Number.isInteger(upsetResult.winnerDelta)).toBe(true);
    }
  });
});

describe("getConfidenceMultiplier", () => {
  it("returns CONFIDENCE_MAX for games with zero matches", () => {
    expect(getConfidenceMultiplier(0, 0)).toBeCloseTo(RATING_CONSTANTS.CONFIDENCE_MAX, 5);
  });

  it("returns ~1.5 at halflife matches", () => {
    const halflife = RATING_CONSTANTS.CONFIDENCE_HALFLIFE;
    const result = getConfidenceMultiplier(halflife, halflife);
    expect(result).toBeCloseTo(1.5, 1);
  });

  it("returns ~1.0 for games with many matches", () => {
    const result = getConfidenceMultiplier(200, 200);
    expect(result).toBeCloseTo(1.0, 2);
  });

  it("uses average of both games match counts", () => {
    const symmetric = getConfidenceMultiplier(20, 20);
    const asymmetric = getConfidenceMultiplier(0, 40);
    expect(symmetric).toBeCloseTo(asymmetric, 5);
  });

  it("treats undefined totalMatches as 0", () => {
    const withUndefined = getConfidenceMultiplier(undefined, undefined);
    const withZero = getConfidenceMultiplier(0, 0);
    expect(withUndefined).toBe(withZero);
  });
});

describe("getRatingDelta with confidence weighting", () => {
  it("amplifies deltas for new games", () => {
    const newGame = expectedWin(0, { leftMatches: 0, rightMatches: 0 });
    const oldGame = expectedWin(0, { leftMatches: 200, rightMatches: 200 });
    expect(newGame.winnerDelta).toBeGreaterThan(oldGame.winnerDelta);
  });

  it("new game expected-win delta at gap=0 is approximately doubled", () => {
    const newGame = expectedWin(0, { leftMatches: 0, rightMatches: 0 });
    const oldGame = expectedWin(0, { leftMatches: 200, rightMatches: 200 });
    expect(newGame.winnerDelta).toBe(oldGame.winnerDelta * 2);
  });

  it("confidence boost decays with more matches", () => {
    const fresh = expectedWin(0, { leftMatches: 0, rightMatches: 0 });
    const mid = expectedWin(0, { leftMatches: 30, rightMatches: 30 });
    const veteran = expectedWin(0, { leftMatches: 200, rightMatches: 200 });
    expect(fresh.winnerDelta).toBeGreaterThan(mid.winnerDelta);
    expect(mid.winnerDelta).toBeGreaterThanOrEqual(veteran.winnerDelta);
  });
});

describe("applyRatingDelta", () => {
  it("applies winner and loser deltas", () => {
    const result = applyRatingDelta(500, 490, { winnerDelta: 3, loserDelta: -3 });
    expect(result.winnerPostScore).toBe(503);
    expect(result.loserPostScore).toBe(487);
  });

  it("clamps loser score to MIN_SCORE", () => {
    const result = applyRatingDelta(500, 1, { winnerDelta: 3, loserDelta: -3 });
    expect(result.loserPostScore).toBe(RATING_CONSTANTS.MIN_SCORE);
    expect(result.loserDelta).toBe(0);
  });
});
