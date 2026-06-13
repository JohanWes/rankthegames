import type { RunPair, RunSelection } from "@/lib/types";

export const OPENING_BRACKET_ROUNDS = 8;
export const MAX_TOURNAMENT_ROUNDS = 15;

export type TournamentStage = "round-of-16" | "quarterfinal" | "semifinal" | "final";

const ADVANCEMENT_ROUNDS: Record<number, [number, number]> = {
  9: [1, 2],
  10: [3, 4],
  11: [5, 6],
  12: [7, 8],
  13: [9, 10],
  14: [11, 12],
  15: [13, 14]
};

export function getTournamentStage(round: number): TournamentStage {
  if (round >= 15) return "final";
  if (round >= 13) return "semifinal";
  if (round >= 9) return "quarterfinal";
  return "round-of-16";
}

export function getTournamentStageTitle(round: number) {
  const stage = getTournamentStage(round);

  switch (stage) {
    case "quarterfinal":
      return "Quarter Finals";
    case "semifinal":
      return "Semi Finals";
    case "final":
      return "Finals";
    default:
      return "Round of 16";
  }
}

export function getTournamentBucket(round: number) {
  const stage = getTournamentStage(round);

  switch (stage) {
    case "quarterfinal":
      return "bracket:quarterfinal";
    case "semifinal":
      return "bracket:semifinal";
    case "final":
      return "bracket:final";
    default:
      return "bracket:opening";
  }
}

export function shouldShowStageIntro(round: number) {
  return round === 9 || round === 13 || round === 15;
}

export function getBracketRoundPair(
  round: number,
  openingPairs: RunPair[],
  selections: RunSelection[]
): RunPair | null {
  if (round < 1 || round > MAX_TOURNAMENT_ROUNDS) {
    return null;
  }

  if (round <= OPENING_BRACKET_ROUNDS) {
    return openingPairs.find((pair) => pair.round === round) ?? null;
  }

  const sourceRounds = ADVANCEMENT_ROUNDS[round];
  if (!sourceRounds) {
    return null;
  }

  const leftWinner = selections.find((selection) => selection.round === sourceRounds[0]);
  const rightWinner = selections.find((selection) => selection.round === sourceRounds[1]);

  if (!leftWinner || !rightWinner) {
    return null;
  }

  return {
    round,
    leftGameId: leftWinner.pickedGameId,
    rightGameId: rightWinner.pickedGameId,
    bucket: getTournamentBucket(round)
  };
}
