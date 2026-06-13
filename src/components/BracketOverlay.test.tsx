import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BracketOverlay } from "./BracketOverlay";
import { createMockRunResponse } from "@/test/helpers/mock-data";

describe("BracketOverlay", () => {
  it("shows played winners, eliminated games, and current match without text labels", () => {
    const run = createMockRunResponse();
    const onClose = vi.fn();

    render(
      <BracketOverlay
        open
        onClose={onClose}
        games={run.games}
        openingPairs={run.roundPairs}
        selections={[
          { round: 1, pickedGameId: "g1", completedAt: "2024-01-01T00:00:01.000Z" },
          { round: 2, pickedGameId: "g3", completedAt: "2024-01-01T00:00:02.000Z" }
        ]}
        currentRound={3}
      />
    );

    expect(screen.getByLabelText("Close bracket")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Game One" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "Game Two" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Pending" })).not.toBeInTheDocument();
    expect(screen.getAllByText("X").length).toBeGreaterThan(0);
  });
});
