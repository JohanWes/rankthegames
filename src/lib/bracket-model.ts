import {
  ADVANCEMENT_ROUNDS,
  getTournamentStage,
  getTournamentStageTitle,
  isCorrectPick,
  MAX_TOURNAMENT_ROUNDS,
  OPENING_BRACKET_ROUNDS,
  type TournamentStage
} from "@/lib/bracket";
import type { RunGame, RunPair, RunSelection } from "@/lib/types";

export type BracketSide = "left" | "right" | "center";
export type BracketMatchStatus = "upcoming" | "live" | "done";

export type BracketMatch = {
  round: number;
  side: BracketSide;
  /** null while the feeding match is still undecided. */
  topGameId: string | null;
  bottomGameId: string | null;
  pickedGameId: string | null;
  /** null until the match has been played. */
  isCorrect: boolean | null;
  status: BracketMatchStatus;
};

export type BracketStage = {
  id: TournamentStage;
  title: string;
  shortTitle: string;
  matches: BracketMatch[];
};

export type BracketModel = {
  matches: Record<number, BracketMatch>;
  stages: BracketStage[];
  championId: string | null;
  currentStageId: TournamentStage;
};

const STAGE_ROUNDS: { id: TournamentStage; shortTitle: string; rounds: number[] }[] = [
  { id: "round-of-16", shortTitle: "R16", rounds: [1, 2, 3, 4, 5, 6, 7, 8] },
  { id: "quarterfinal", shortTitle: "QF", rounds: [9, 10, 11, 12] },
  { id: "semifinal", shortTitle: "SF", rounds: [13, 14] },
  { id: "final", shortTitle: "Final", rounds: [15] }
];

const LEFT_ROUNDS = new Set([1, 2, 3, 4, 9, 10, 13]);

export function getMatchSide(round: number): BracketSide {
  if (round === MAX_TOURNAMENT_ROUNDS) return "center";
  return LEFT_ROUNDS.has(round) ? "left" : "right";
}

/** A match's pick moves on to the next round only when it was correct. */
export function getAdvancingGameId(match: BracketMatch | undefined): string | null {
  return match?.status === "done" && match.isCorrect ? match.pickedGameId : null;
}

export function buildBracketModel(
  openingPairs: RunPair[],
  selections: RunSelection[],
  currentRound: number,
  games: Record<string, RunGame>
): BracketModel {
  const matches: Record<number, BracketMatch> = {};

  for (let round = 1; round <= MAX_TOURNAMENT_ROUNDS; round++) {
    let topGameId: string | null = null;
    let bottomGameId: string | null = null;

    if (round <= OPENING_BRACKET_ROUNDS) {
      const pair = openingPairs.find((candidate) => candidate.round === round);
      topGameId = pair?.leftGameId ?? null;
      bottomGameId = pair?.rightGameId ?? null;
    } else {
      const [sourceA, sourceB] = ADVANCEMENT_ROUNDS[round];
      topGameId = getAdvancingGameId(matches[sourceA]);
      bottomGameId = getAdvancingGameId(matches[sourceB]);
    }

    const selection = selections.find((candidate) => candidate.round === round) ?? null;
    const topGame = topGameId ? games[topGameId] : undefined;
    const bottomGame = bottomGameId ? games[bottomGameId] : undefined;

    let isCorrect: boolean | null = null;
    if (selection && topGame && bottomGame) {
      isCorrect = isCorrectPick(topGame, bottomGame, selection.pickedGameId);
    }

    matches[round] = {
      round,
      side: getMatchSide(round),
      topGameId,
      bottomGameId,
      pickedGameId: selection?.pickedGameId ?? null,
      isCorrect,
      status: selection ? "done" : round === currentRound ? "live" : "upcoming"
    };
  }

  const stages = STAGE_ROUNDS.map(({ id, shortTitle, rounds }) => ({
    id,
    title: getTournamentStageTitle(rounds[0]),
    shortTitle,
    matches: rounds.map((round) => matches[round])
  }));

  const clampedRound = Math.min(Math.max(currentRound, 1), MAX_TOURNAMENT_ROUNDS);

  return {
    matches,
    stages,
    championId: getAdvancingGameId(matches[MAX_TOURNAMENT_ROUNDS]),
    currentStageId: getTournamentStage(clampedRound)
  };
}
