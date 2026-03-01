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

const MIN_SCORE = 1;

export function getRatingDelta(
  leftGameId: string,
  leftScore: number,
  rightGameId: string,
  rightScore: number,
  pickedGameId: string
): RatingDelta {
  if (pickedGameId !== leftGameId && pickedGameId !== rightGameId) {
    throw new RangeError("Picked game must match one of the round game ids.");
  }

  const gap = Math.abs(leftScore - rightScore);
  const isTie = leftScore === rightScore;
  const expectedWinnerId = isTie ? null : leftScore > rightScore ? leftGameId : rightGameId;
  const loserId = pickedGameId === leftGameId ? rightGameId : leftGameId;
  const loserScore = loserId === leftGameId ? leftScore : rightScore;
  const wasUpset = !isTie && gap >= 100 && pickedGameId !== expectedWinnerId;

  let winnerDelta = 3;
  let loserDelta = -3;

  if (gap >= 100 && gap < 300) {
    winnerDelta = wasUpset ? 8 : 2;
    loserDelta = wasUpset ? -8 : -2;
  } else if (gap >= 300 && gap < 500) {
    winnerDelta = wasUpset ? 15 : 1;
    loserDelta = wasUpset ? -15 : -1;
  } else if (gap >= 500) {
    winnerDelta = wasUpset ? 20 : 1;
    loserDelta = wasUpset ? -20 : -1;
  }

  loserDelta = Math.max(loserDelta, MIN_SCORE - loserScore);

  return {
    winnerDelta,
    loserDelta,
    expectedWinnerId,
    wasUpset
  };
}

export function applyRatingDelta(
  winnerScore: number,
  loserScore: number,
  delta: Pick<RatingDelta, "winnerDelta" | "loserDelta">
): AppliedScoreDelta {
  const loserDelta = Math.max(delta.loserDelta, MIN_SCORE - loserScore);

  return {
    winnerPostScore: winnerScore + delta.winnerDelta,
    loserPostScore: Math.max(MIN_SCORE, loserScore + loserDelta),
    loserDelta
  };
}
