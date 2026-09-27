import { describe, expect, it } from "vitest";

import { buildBracketModel } from "@/lib/bracket-model";
import type { RunSelection } from "@/lib/types";
import { createMockRunResponse } from "@/test/helpers/mock-data";

const at = "2024-01-01T00:00:00.000Z";

function pick(round: number, pickedGameId: string): RunSelection {
  return { round, pickedGameId, completedAt: at };
}

/** Correct picks for the mock run: the lower-numbered game always has the higher score. */
function perfectRun(): RunSelection[] {
  return [
    pick(1, "g1"), pick(2, "g3"), pick(3, "g5"), pick(4, "g7"),
    pick(5, "g9"), pick(6, "g11"), pick(7, "g13"), pick(8, "g15"),
    pick(9, "g1"), pick(10, "g5"), pick(11, "g9"), pick(12, "g13"),
    pick(13, "g1"), pick(14, "g9"),
    pick(15, "g1")
  ];
}

describe("buildBracketModel", () => {
  const run = createMockRunResponse();

  it("groups 15 matches into four stages with mirrored sides", () => {
    const model = buildBracketModel(run.roundPairs, [], 1, run.games);

    expect(Object.keys(model.matches)).toHaveLength(15);
    expect(model.stages.map((stage) => [stage.id, stage.matches.length])).toEqual([
      ["round-of-16", 8],
      ["quarterfinal", 4],
      ["semifinal", 2],
      ["final", 1]
    ]);
    expect(model.stages.map((stage) => stage.title)).toEqual([
      "Round of 16",
      "Quarter Finals",
      "Semi Finals",
      "Finals"
    ]);

    const sideOf = (round: number) => model.matches[round].side;
    expect([1, 2, 3, 4, 9, 10, 13].map(sideOf)).toEqual(Array(7).fill("left"));
    expect([5, 6, 7, 8, 11, 12, 14].map(sideOf)).toEqual(Array(7).fill("right"));
    expect(sideOf(15)).toBe("center");
  });

  it("fills opening matches from the round pairs and leaves later ones TBD", () => {
    const model = buildBracketModel(run.roundPairs, [], 1, run.games);

    expect(model.matches[1]).toMatchObject({ topGameId: "g1", bottomGameId: "g2" });
    expect(model.matches[8]).toMatchObject({ topGameId: "g15", bottomGameId: "g16" });
    expect(model.matches[9]).toMatchObject({ topGameId: null, bottomGameId: null });
    expect(model.championId).toBeNull();
  });

  it("derives live, done and upcoming statuses", () => {
    const model = buildBracketModel(run.roundPairs, [pick(1, "g1"), pick(2, "g3")], 3, run.games);

    expect(model.matches[1].status).toBe("done");
    expect(model.matches[2].status).toBe("done");
    expect(model.matches[3].status).toBe("live");
    expect(model.matches[4].status).toBe("upcoming");
    expect(model.matches[9].status).toBe("upcoming");
    expect(model.currentStageId).toBe("round-of-16");
  });

  it("advances winners into later rounds, filling one side at a time", () => {
    const partial = buildBracketModel(run.roundPairs, [pick(1, "g1")], 2, run.games);
    expect(partial.matches[1]).toMatchObject({ pickedGameId: "g1", isCorrect: true });
    expect(partial.matches[9]).toMatchObject({ topGameId: "g1", bottomGameId: null });

    const full = buildBracketModel(run.roundPairs, [pick(1, "g1"), pick(2, "g3")], 3, run.games);
    expect(full.matches[9]).toMatchObject({ topGameId: "g1", bottomGameId: "g3" });
  });

  it("does not advance a wrong pick", () => {
    const model = buildBracketModel(run.roundPairs, [pick(1, "g1"), pick(2, "g4")], 2, run.games);

    expect(model.matches[2]).toMatchObject({
      status: "done",
      pickedGameId: "g4",
      isCorrect: false
    });
    expect(model.matches[9]).toMatchObject({ topGameId: "g1", bottomGameId: null });
  });

  it("counts ties as correct", () => {
    const games = {
      ...run.games,
      g2: { ...run.games.g2, snapshotScore: run.games.g1.snapshotScore }
    };
    const model = buildBracketModel(run.roundPairs, [pick(1, "g2")], 2, games);

    expect(model.matches[1].isCorrect).toBe(true);
    expect(model.matches[9].topGameId).toBe("g2");
  });

  it("crowns the champion after a correct final", () => {
    const model = buildBracketModel(run.roundPairs, perfectRun(), 15, run.games);

    expect(model.matches[15]).toMatchObject({
      topGameId: "g1",
      bottomGameId: "g9",
      status: "done",
      isCorrect: true
    });
    expect(model.championId).toBe("g1");
    expect(model.currentStageId).toBe("final");
  });

  it("has no champion when the final is lost", () => {
    const selections = [...perfectRun().slice(0, 14), pick(15, "g9")];
    const model = buildBracketModel(run.roundPairs, selections, 15, run.games);

    expect(model.matches[15].isCorrect).toBe(false);
    expect(model.championId).toBeNull();
  });
});
