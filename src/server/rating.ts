export type RatingDelta = {
  winnerDelta: number;
  loserDelta: number;
  expectedWinnerId: string | null;
  wasUpset: boolean;
};

export type AppliedScoreDelta = {
  winnerPostScore: number;
  loserPostScore: number;
  loserDelta: number;
};

export type RatingInput = {
  leftGameId: string;
  leftScore: number;
  rightGameId: string;
  rightScore: number;
  pickedGameId: string;
  leftTotalMatches?: number;
  rightTotalMatches?: number;
};

export const RATING_CONSTANTS = {
  K_EXPECTED: 4,
  S_EXPECTED: 80,
  K_UPSET: 24,
  S_UPSET: 200,
  MIN_DELTA: 1,
  MAX_DELTA: 24,
  MIN_SCORE: 1,
  CONFIDENCE_MAX: 2.0,
  CONFIDENCE_HALFLIFE: 15,
} as const;

export function getRatingDelta(input: RatingInput): RatingDelta {
  const { leftGameId, leftScore, rightGameId, rightScore, pickedGameId } = input;

  if (pickedGameId !== leftGameId && pickedGameId !== rightGameId) {
    throw new RangeError("Picked game must match one of the round game ids.");
  }

  const gap = Math.abs(leftScore - rightScore);
  const isTie = leftScore === rightScore;
  const expectedWinnerId = isTie ? null : leftScore > rightScore ? leftGameId : rightGameId;
  const loserId = pickedGameId === leftGameId ? rightGameId : leftGameId;
  const loserScore = loserId === leftGameId ? leftScore : rightScore;
  const wasUpset = !isTie && pickedGameId !== expectedWinnerId;

  let rawDelta: number;

  if (wasUpset) {
    rawDelta = RATING_CONSTANTS.K_UPSET * (1 - 1 / (1 + gap / RATING_CONSTANTS.S_UPSET));
  } else {
    rawDelta = RATING_CONSTANTS.K_EXPECTED / (1 + gap / RATING_CONSTANTS.S_EXPECTED);
  }

  const confidenceMultiplier = getConfidenceMultiplier(
    input.leftTotalMatches,
    input.rightTotalMatches
  );

  const winnerDelta = Math.max(
    RATING_CONSTANTS.MIN_DELTA,
    Math.min(RATING_CONSTANTS.MAX_DELTA, Math.round(rawDelta * confidenceMultiplier))
  );
  const loserDelta = Math.max(-winnerDelta, RATING_CONSTANTS.MIN_SCORE - loserScore);

  return {
    winnerDelta,
    loserDelta,
    expectedWinnerId,
    wasUpset
  };
}

export function getConfidenceMultiplier(
  leftTotalMatches?: number,
  rightTotalMatches?: number
): number {
  const lm = leftTotalMatches ?? 0;
  const rm = rightTotalMatches ?? 0;
  const avgMatches = (lm + rm) / 2;

  const decay = Math.exp(-avgMatches * Math.LN2 / RATING_CONSTANTS.CONFIDENCE_HALFLIFE);
  return 1 + (RATING_CONSTANTS.CONFIDENCE_MAX - 1) * decay;
}

export function applyRatingDelta(
  winnerScore: number,
  loserScore: number,
  delta: Pick<RatingDelta, "winnerDelta" | "loserDelta">
): AppliedScoreDelta {
  const loserDelta = Math.max(delta.loserDelta, RATING_CONSTANTS.MIN_SCORE - loserScore);

  return {
    winnerPostScore: winnerScore + delta.winnerDelta,
    loserPostScore: Math.max(RATING_CONSTANTS.MIN_SCORE, loserScore + loserDelta),
    loserDelta
  };
}
