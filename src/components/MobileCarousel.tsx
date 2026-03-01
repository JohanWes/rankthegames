"use client";

import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type MobileCarouselProps = {
  children: [ReactNode, ReactNode];
  locked?: boolean;
  scrollToIndex?: number;
};

function DotIndicator({ active }: { active: boolean }) {
  return (
    <div
      className={`h-2 w-2 rounded-full transition-all duration-300 ${
        active ? "bg-accent scale-125" : "bg-text-muted"
      }`}
    />
  );
}

export function MobileCarousel({
  children,
  locked = false,
  scrollToIndex,
}: MobileCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const [activeIndex, setActiveIndex] = useState(0);
  const hasHinted = useRef(false);

  // Track active index from scroll position
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollLeft = container.scrollLeft;
    const slotWidth = container.scrollWidth / 2;
    setActiveIndex(scrollLeft > slotWidth * 0.5 ? 1 : 0);
  }, []);

  // Programmatic scroll when scrollToIndex changes
  useEffect(() => {
    if (scrollToIndex == null) return;
    const slot = slotRefs.current[scrollToIndex];
    if (!slot) return;

    slot.scrollIntoView({
      behavior: prefersReducedMotion() ? "instant" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [scrollToIndex]);

  // Swipe hint on first mount
  useEffect(() => {
    if (hasHinted.current) return;
    const container = containerRef.current;
    if (!container) return;

    if (prefersReducedMotion()) return;

    hasHinted.current = true;
    const timer = setTimeout(() => {
      container.scrollTo({ left: 40, behavior: "smooth" });
      setTimeout(() => {
        container.scrollTo({ left: 0, behavior: "smooth" });
      }, 400);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Mobile carousel - hidden at md+ */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`
          flex snap-x snap-mandatory scroll-smooth no-scrollbar
          md:hidden
          ${locked ? "overflow-x-hidden" : "overflow-x-auto"}
        `}
      >
        {children.map((child, i) => (
          <div
            key={i}
            ref={(el) => {
              slotRefs.current[i] = el;
            }}
            className="w-[85vw] flex-shrink-0 snap-center px-2 first:pl-[7.5vw] last:pr-[7.5vw]"
          >
            <div className="mx-auto max-h-[70svh]">
              {child}
            </div>
          </div>
        ))}
      </div>

      {/* Dot indicators + VS badge - mobile only */}
      <div className="mt-3 flex items-center justify-center gap-3 md:hidden">
        <DotIndicator active={activeIndex === 0} />
        <div className="flex h-8 w-8 items-center justify-center rounded-full glass">
          <span className="font-display text-sm font-bold text-accent glow-accent-text">
            VS
          </span>
        </div>
        <DotIndicator active={activeIndex === 1} />
      </div>

      {/* Desktop pass-through - hidden below md */}
      <div className="hidden md:contents">
        {children}
      </div>
    </>
  );
}
