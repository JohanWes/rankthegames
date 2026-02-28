import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakCounter } from "./StreakCounter";

describe("StreakCounter", () => {
  it("renders streak value", () => {
    render(<StreakCounter streak={3} previousStreak={5} isNewHighScore={false} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("applies muted styling for streak 0", () => {
    const { container } = render(
      <StreakCounter streak={0} previousStreak={0} isNewHighScore={false} />
    );
    const streakEl = container.querySelector("span");
    expect(streakEl?.className).toContain("text-text-muted");
  });

  it("applies normal styling for streak 1-4", () => {
    const { container } = render(
      <StreakCounter streak={3} previousStreak={5} isNewHighScore={false} />
    );
    const streakEl = container.querySelector("span");
    expect(streakEl?.className).toContain("text-text-primary");
  });

  it("applies accent styling for streak 5-9", () => {
    const { container } = render(
      <StreakCounter streak={7} previousStreak={10} isNewHighScore={false} />
    );
    const streakEl = container.querySelector("span");
    expect(streakEl?.className).toContain("text-accent");
  });

  it("applies bold styling for streak 10+", () => {
    const { container } = render(
      <StreakCounter streak={10} previousStreak={10} isNewHighScore={false} />
    );
    const streakEl = container.querySelector("span");
    expect(streakEl?.className).toContain("text-accent");
  });

  it("shows NEW BEST badge when isNewHighScore and streak > previousStreak", () => {
    render(<StreakCounter streak={6} previousStreak={5} isNewHighScore />);
    expect(screen.getByText("NEW BEST!")).toBeInTheDocument();
  });

  it("does not show NEW BEST badge when streak <= previousStreak", () => {
    render(<StreakCounter streak={3} previousStreak={5} isNewHighScore />);
    expect(screen.queryByText("NEW BEST!")).not.toBeInTheDocument();
  });
});
