"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

type DemoPhase = "idle" | "focus-left" | "focus-right" | "winner";

const DEMO_GAMES = [
  {
    name: "The Witcher 3",
    imageUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1wyy.jpg",
  },
  {
    name: "Elden Ring",
    imageUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg",
  },
] as const;

const PHASE_DURATIONS: Record<DemoPhase, number> = {
  idle: 600,
  "focus-left": 800,
  "focus-right": 700,
  winner: 1200,
};

const PHASE_ORDER: DemoPhase[] = [
  "idle",
  "focus-left",
  "focus-right",
  "winner",
];

// Minimal cursor SVG — a clean angled pointer
function CursorIcon() {
  return (
    <svg
      width="20"
      height="24"
      viewBox="0 0 20 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1 1L1 18.5L5.5 14.5L9.5 22L13 20.5L9 13H15L1 1Z"
        fill="rgba(245, 158, 11, 0.9)"
        stroke="rgba(255, 255, 255, 0.6)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GamepadFallback({ name }: { name: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3"
      style={{
        background:
          "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(0,240,255,0.1) 100%), #161B22",
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 64 64"
        fill="none"
        className="opacity-30"
      >
        <path
          d="M20 18H44C50.627 18 56 23.373 56 30V34C56 40.627 50.627 46 44 46H20C13.373 46 8 40.627 8 34V30C8 23.373 13.373 18 20 18Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="22" cy="32" r="3" fill="currentColor" />
        <circle cx="42" cy="32" r="2.5" fill="currentColor" />
      </svg>
      <span className="text-center font-display text-sm font-semibold text-text-secondary">
        {name}
      </span>
    </div>
  );
}

function DemoCard({
  game,
  isFocused,
  isWinner,
}: {
  game: (typeof DEMO_GAMES)[number];
  isFocused: boolean;
  isWinner: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative">
      {/* Card */}
      <motion.div
        animate={{
          scale: isWinner ? 1.06 : 1,
          y: isWinner ? -6 : 0,
          opacity: isFocused || isWinner ? 1 : 0.85,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="relative aspect-[3/4] w-[160px] overflow-hidden rounded-xl border-2 border-white/10 bg-bg-elevated sm:w-[200px] md:w-[300px] lg:w-[380px]"
      >
        {!imgError ? (
          <Image
            src={game.imageUrl}
            alt={game.name}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 400px, (min-width: 768px) 300px, 200px"
            onError={() => setImgError(true)}
          />
        ) : (
          <GamepadFallback name={game.name} />
        )}
      </motion.div>

      {/* Amber selection ring */}
      <motion.div
        animate={{ opacity: isFocused && !isWinner ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="pointer-events-none absolute inset-0 rounded-xl border-2 border-accent glow-accent-box"
      />

      {/* Green winner ring */}
      <motion.div
        animate={{ opacity: isWinner ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="pointer-events-none absolute inset-0 rounded-xl border-2 border-correct neon-glow-green"
      />
    </div>
  );
}

export type { DemoPhase };

export function DemoCards({
  className,
  onPhaseChange,
}: {
  className?: string;
  onPhaseChange?: (phase: DemoPhase) => void;
}) {
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [reducedMotion, setReducedMotion] = useState(false);
  const leftCardRef = useRef<HTMLDivElement>(null);
  const rightCardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorTarget, setCursorTarget] = useState({ x: 0, y: 0 });
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const advancePhase = useCallback((nextPhase: DemoPhase) => {
    setPhase(nextPhase);
    onPhaseChangeRef.current?.(nextPhase);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setReducedMotion(true);
      return;
    }

    let phaseIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      phaseIndex = (phaseIndex + 1) % PHASE_ORDER.length;
      const nextPhase = PHASE_ORDER[phaseIndex];
      advancePhase(nextPhase);
      timeoutId = setTimeout(tick, PHASE_DURATIONS[nextPhase]);
    }

    timeoutId = setTimeout(tick, PHASE_DURATIONS[PHASE_ORDER[0]]);

    return () => clearTimeout(timeoutId);
  }, [advancePhase]);

  // Update cursor position based on phase
  useEffect(() => {
    if (reducedMotion) return;

    const container = containerRef.current;
    const leftCard = leftCardRef.current;
    const rightCard = rightCardRef.current;
    if (!container || !leftCard || !rightCard) return;

    const containerRect = container.getBoundingClientRect();

    function getCardCenter(card: HTMLDivElement) {
      const rect = card.getBoundingClientRect();
      return {
        x: rect.left + rect.width * 0.55 - containerRect.left,
        y: rect.top + rect.height * 0.45 - containerRect.top,
      };
    }

    if (phase === "idle") {
      // Center between both cards
      const left = getCardCenter(leftCard);
      const right = getCardCenter(rightCard);
      setCursorTarget({ x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 });
    } else if (phase === "focus-left") {
      setCursorTarget(getCardCenter(leftCard));
    } else if (phase === "focus-right" || phase === "winner") {
      setCursorTarget(getCardCenter(rightCard));
    }
  }, [phase, reducedMotion]);

  const leftFocused = !reducedMotion && phase === "focus-left";
  const rightFocused =
    !reducedMotion && (phase === "focus-right" || phase === "winner");
  const rightWinner = !reducedMotion && phase === "winner";
  const showCursor = !reducedMotion && phase !== "winner";

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center gap-4 md:gap-6 ${className ?? ""}`}
    >
      <div ref={leftCardRef}>
        <DemoCard
          game={DEMO_GAMES[0]}
          isFocused={leftFocused}
          isWinner={false}
        />
      </div>

      {/* VS indicator */}
      <div className="glass flex h-8 w-8 items-center justify-center rounded-full md:h-10 md:w-10">
        <span className="glow-accent-text font-display text-xs font-bold text-accent md:text-sm">
          VS
        </span>
      </div>

      <div ref={rightCardRef}>
        <DemoCard
          game={DEMO_GAMES[1]}
          isFocused={rightFocused}
          isWinner={rightWinner}
        />
      </div>

      {/* Animated cursor */}
      {!reducedMotion && (
        <motion.div
          className="pointer-events-none absolute z-30"
          animate={{
            x: cursorTarget.x - 2,
            y: cursorTarget.y - 2,
            opacity: showCursor ? 0.9 : 0,
            scale: showCursor ? 1 : 0.7,
          }}
          transition={{
            x: { type: "spring", stiffness: 120, damping: 18 },
            y: { type: "spring", stiffness: 120, damping: 18 },
            opacity: { duration: 0.2 },
            scale: { duration: 0.2 },
          }}
          style={{ left: 0, top: 0 }}
        >
          <CursorIcon />
        </motion.div>
      )}
    </div>
  );
}
