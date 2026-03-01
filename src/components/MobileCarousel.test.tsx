import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileCarousel } from "./MobileCarousel";

describe("MobileCarousel", () => {
  it("renders both children", () => {
    render(
      <MobileCarousel>
        <div>Card A</div>
        <div>Card B</div>
      </MobileCarousel>
    );
    expect(screen.getAllByText("Card A")).toHaveLength(2);
    expect(screen.getAllByText("Card B")).toHaveLength(2);
  });

  it("renders VS badge and dot indicators", () => {
    render(
      <MobileCarousel>
        <div>Card A</div>
        <div>Card B</div>
      </MobileCarousel>
    );
    expect(screen.getByText("VS")).toBeInTheDocument();
  });

  it("applies overflow-x-hidden when locked", () => {
    const { container } = render(
      <MobileCarousel locked>
        <div>Card A</div>
        <div>Card B</div>
      </MobileCarousel>
    );
    const carousel = container.querySelector(".snap-x");
    expect(carousel?.className).toContain("overflow-x-hidden");
  });

  it("applies overflow-x-auto when not locked", () => {
    const { container } = render(
      <MobileCarousel locked={false}>
        <div>Card A</div>
        <div>Card B</div>
      </MobileCarousel>
    );
    const carousel = container.querySelector(".snap-x");
    expect(carousel?.className).toContain("overflow-x-auto");
  });
});
