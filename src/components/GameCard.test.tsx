import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameCard } from "./GameCard";
import type { RunGame } from "@/lib/types";

const baseGame: RunGame = {
  id: "g1",
  name: "Test Game",
  year: 2023,
  imageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1234.jpg",
  thumbUrl: "https://images.igdb.com/igdb/image/upload/t_thumb/co1234.jpg",
  snapshotScore: 750,
  seedRank: 5
};

describe("GameCard", () => {
  it("renders game name and year", () => {
    render(
      <GameCard game={baseGame} state="idle" position="left" />
    );
    expect(screen.getAllByText("Test Game").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2023").length).toBeGreaterThanOrEqual(1);
  });

  it("shows score when showScore is true", () => {
    render(
      <GameCard game={baseGame} state="correct" showScore position="left" />
    );
    expect(screen.getByText("Live Score")).toBeInTheDocument();
  });

  it("hides score when showScore is false", () => {
    render(
      <GameCard game={baseGame} state="idle" position="left" />
    );
    expect(screen.queryByText("Live Score")).not.toBeInTheDocument();
  });

  it("calls onSelect when clicked in idle state", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <GameCard game={baseGame} state="idle" onSelect={onSelect} position="left" />
    );

    await user.click(screen.getByLabelText("Select Test Game"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not call onSelect when disabled", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <GameCard game={baseGame} state="idle" onSelect={onSelect} disabled position="left" />
    );

    await user.click(screen.getByLabelText("Select Test Game"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not call onSelect when in non-idle state", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <GameCard game={baseGame} state="selected" onSelect={onSelect} position="left" />
    );

    await user.click(screen.getByLabelText("Select Test Game"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders fallback when imageUrl is null", () => {
    const noImageGame = { ...baseGame, imageUrl: null };
    render(
      <GameCard game={noImageGame} state="idle" position="left" />
    );
    // Fallback shows the name in the center + in the scrim
    const names = screen.getAllByText("Test Game");
    expect(names.length).toBeGreaterThanOrEqual(2);
  });
});
