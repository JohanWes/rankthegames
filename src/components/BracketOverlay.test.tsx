import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BracketOverlay } from "./BracketOverlay";
import { createMockRunResponse } from "@/test/helpers/mock-data";
import type { RunSelection } from "@/lib/types";

const at = "2024-01-01T00:00:00.000Z";

function renderOverlay(
  selections: RunSelection[],
  currentRound: number,
  props: { revealScores?: boolean; onClose?: () => void } = {}
) {
  const run = createMockRunResponse();
  const onClose = props.onClose ?? vi.fn();

  render(
    <BracketOverlay
      open
      onClose={onClose}
      games={run.games}
      openingPairs={run.roundPairs}
      selections={selections}
      currentRound={currentRound}
      revealScores={props.revealScores}
    />
  );

  return { onClose };
}

const twoPlayed: RunSelection[] = [
  { round: 1, pickedGameId: "g1", completedAt: at },
  { round: 2, pickedGameId: "g3", completedAt: at }
];

describe("BracketOverlay", () => {
  it("shows matchups with names and marks the live match", () => {
    renderOverlay(twoPlayed, 3);

    expect(screen.getByRole("dialog", { name: "Bracket" })).toBeInTheDocument();
    expect(screen.getByText("Round 3 of 15 · Round of 16")).toBeInTheDocument();

    const panel = screen.getByRole("tabpanel");
    const liveMatch = within(panel).getByRole("group", { name: "Round 3: Game G5 vs Game G6" });
    expect(within(liveMatch).getByText("Now playing")).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Round 1: Game One vs Game Two" })).toBeInTheDocument();
  });

  it("hides scores during play", () => {
    renderOverlay(twoPlayed, 3);
    expect(screen.queryByText("600")).not.toBeInTheDocument();
  });

  it("reveals scores and the wrong pick once the run is over", () => {
    renderOverlay([{ round: 1, pickedGameId: "g2", completedAt: at }], 1, { revealScores: true });

    expect(screen.getByText("Out in round 1 · Round of 16")).toBeInTheDocument();
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("600")).toBeInTheDocument();
    expect(within(panel).getByText("590")).toBeInTheDocument();
    expect(within(panel).getByText(/Your pick/)).toBeInTheDocument();
  });

  it("switches stages with the round tabs", async () => {
    renderOverlay(twoPlayed, 3);

    const quarterTab = screen.getByRole("tab", { name: /QF/ });
    fireEvent.click(quarterTab);

    expect(quarterTab).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    expect(
      await within(panel).findByRole("group", { name: "Round 9: Game One vs Game G3" })
    ).toBeInTheDocument();
  });

  it("closes with the close button and Escape", () => {
    const { onClose } = renderOverlay(twoPlayed, 3);

    fireEvent.click(screen.getByLabelText("Close bracket"));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
