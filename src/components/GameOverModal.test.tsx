import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameOverModal } from "./GameOverModal";

describe("GameOverModal", () => {
  it("renders streak and high score", () => {
    render(
      <GameOverModal streak={5} highScore={7} isNewHighScore={false} onPlayAgain={() => {}} />
    );
    expect(screen.getByText("GAME OVER")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows NEW HIGH SCORE badge when isNewHighScore is true", () => {
    render(
      <GameOverModal streak={8} highScore={8} isNewHighScore onPlayAgain={() => {}} />
    );
    expect(screen.getByText("NEW HIGH SCORE!")).toBeInTheDocument();
  });

  it("does not show NEW HIGH SCORE badge when isNewHighScore is false", () => {
    render(
      <GameOverModal streak={3} highScore={8} isNewHighScore={false} onPlayAgain={() => {}} />
    );
    expect(screen.queryByText("NEW HIGH SCORE!")).not.toBeInTheDocument();
  });

  it("calls onPlayAgain when PLAY AGAIN button is clicked", async () => {
    const user = userEvent.setup();
    const onPlayAgain = vi.fn();
    render(
      <GameOverModal streak={3} highScore={5} isNewHighScore={false} onPlayAgain={onPlayAgain} />
    );

    await user.click(screen.getByText("PLAY AGAIN"));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it("renders leaderboard link", () => {
    render(
      <GameOverModal streak={3} highScore={5} isNewHighScore={false} onPlayAgain={() => {}} />
    );
    expect(screen.getByText("View Leaderboard")).toBeInTheDocument();
  });
});
