"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

import { getBracketRoundPair } from "@/lib/bracket";
import {
  buildBracketTree,
  CARD_WIDTH,
  CARD_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAX_ZOOM,
  getCoverUrl,
  type BracketNode
} from "@/lib/bracket-layout";
import { useBracketCamera } from "@/hooks/useBracketCamera";
import type { RunGame, RunPair, RunSelection } from "@/lib/types";

const STAGE_LABELS = [
  { label: "Openers", x: 105 },
  { label: "Winners", x: 270 },
  { label: "Quarters", x: 450 },
  { label: "Final", x: 770 },
  { label: "Quarters", x: 1090 },
  { label: "Winners", x: 1270 },
  { label: "Openers", x: 1435 }
] as const;

type BracketOverlayProps = {
  open: boolean;
  onClose: () => void;
  games: Record<string, RunGame>;
  openingPairs: RunPair[];
  selections: RunSelection[];
  currentRound: number;
};

function Miniature({ node, game }: { node: BracketNode; game: RunGame }) {
  const coverUrl = getCoverUrl(game);

  return (
    <div
      role="img"
      aria-label={game.name}
      className="absolute -translate-x-1/2 -translate-y-1/2 select-none"
      style={{
        left: node.x,
        top: node.y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT
      }}
    >
      <motion.div
        className={[
          "relative h-full w-full overflow-hidden rounded-lg border bg-bg-elevated shadow-[0_20px_40px_rgba(0,0,0,0.4)]",
          "transition-[border-color,filter,opacity,box-shadow] duration-200",
          node.active
            ? "border-accent shadow-[0_0_0_2px_rgba(245,158,11,0.18),0_0_32px_rgba(245,158,11,0.4)]"
            : node.winner
              ? "border-correct/80 shadow-[0_0_22px_rgba(34,197,94,0.22)]"
              : "border-white/16",
          node.eliminated ? "opacity-40 grayscale" : "opacity-100"
        ].join(" ")}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: node.eliminated ? 0.4 : 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            draggable={false}
            sizes={`${CARD_WIDTH * MAX_ZOOM}px`}
            className="pointer-events-none object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-bg-elevated via-bg-base to-black" />
        )}

        {node.eliminated && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/48">
            <span className="font-display text-5xl font-black leading-none text-wrong drop-shadow-[0_0_12px_rgba(239,68,68,0.78)]">
              X
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function EmptySlot({ node }: { node: BracketNode }) {
  return (
    <div
      className={[
        "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-dashed border-white/12 bg-bg-elevated/24",
        node.active ? "border-accent/45 bg-accent/8" : ""
      ].join(" ")}
      style={{
        left: node.x,
        top: node.y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT
      }}
      aria-hidden="true"
    >
      <div className="h-2 w-2 rounded-full bg-white/18" />
    </div>
  );
}

export function BracketOverlay({
  open,
  onClose,
  games,
  openingPairs,
  selections,
  currentRound
}: BracketOverlayProps) {
  const { nodes, connectors, focusPoint } = useMemo(
    () => buildBracketTree(openingPairs, selections, currentRound),
    [openingPairs, selections, currentRound]
  );

  const {
    viewportRef,
    camera,
    isDragging,
    handlers,
    fitWholeBracket,
    resetToInitialView,
    zoomIn,
    zoomOut
  } = useBracketCamera({ active: open, focusPoint });

  const currentPair = getBracketRoundPair(currentRound, openingPairs, selections);

  // Escape key to close
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Tournament bracket"
          className="fixed inset-0 z-50 overflow-hidden bg-[#050912]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Header toolbar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 md:p-5">
            <div className="pointer-events-auto rounded-lg border border-white/10 bg-bg-base/78 px-3 py-2 shadow-2xl backdrop-blur-xl md:px-4">
              <p className="font-display text-2xl font-semibold leading-none text-text-primary md:text-3xl">
                Bracket
              </p>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                Round {currentPair ? currentRound : Math.min(currentRound, 15)} / 15
              </p>
            </div>

            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/10 bg-bg-base/78 p-1.5 shadow-2xl backdrop-blur-xl">
              <button
                type="button"
                onClick={zoomOut}
                aria-label="Zoom out"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-2xl leading-none text-text-secondary transition-colors hover:border-accent/60 hover:text-accent"
              >
                -
              </button>
              <div className="hidden min-w-14 text-center font-display text-xl font-semibold text-text-primary sm:block">
                {Math.round(camera.zoom * 100)}%
              </div>
              <button
                type="button"
                onClick={zoomIn}
                aria-label="Zoom in"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-2xl leading-none text-text-secondary transition-colors hover:border-accent/60 hover:text-accent"
              >
                +
              </button>
              <button
                type="button"
                onClick={fitWholeBracket}
                className="hidden h-10 rounded-md border border-white/10 px-3 font-display text-lg font-semibold uppercase tracking-[0.08em] text-text-secondary transition-colors hover:border-accent/60 hover:text-accent sm:block"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={resetToInitialView}
                className="hidden h-10 rounded-md border border-white/10 px-3 font-display text-lg font-semibold uppercase tracking-[0.08em] text-text-secondary transition-colors hover:border-accent/60 hover:text-accent md:block"
              >
                Focus
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close bracket"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-2xl leading-none text-text-secondary transition-colors hover:border-wrong/70 hover:text-wrong"
              >
                X
              </button>
            </div>
          </div>

          {/* Infinite canvas viewport */}
          <motion.div
            ref={viewportRef}
            className={[
              "absolute inset-0 touch-none overflow-hidden select-none",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            ].join(" ")}
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 50%, rgba(245,158,11,0.10), transparent 28rem), linear-gradient(rgba(240,246,252,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(240,246,252,0.055) 1px, transparent 1px)",
              backgroundPosition: "center, center, center",
              backgroundSize: "100% 100%, 48px 48px, 48px 48px"
            }}
            {...handlers}
            initial={{ scale: 0.99 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.99 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div
              className="absolute top-0 left-0"
              style={{
                width: WORLD_WIDTH,
                height: WORLD_HEIGHT,
                transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
                transformOrigin: "0 0",
                transition: isDragging ? "none" : "transform 110ms ease-out",
                willChange: "transform"
              }}
              aria-label={
                currentPair
                  ? `Tournament bracket current round ${currentRound}`
                  : "Tournament bracket"
              }
            >
              {/* World background */}
              <div className="absolute inset-0 rounded-[28px] border border-white/8 bg-bg-base/36 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_40px_120px_rgba(0,0,0,0.28)]" />

              {/* Stage labels */}
              {STAGE_LABELS.map(({ label, x }) => (
                <div
                  key={`${label}-${x}`}
                  className="absolute top-7 -translate-x-1/2 font-display text-[18px] font-semibold uppercase tracking-[0.22em] text-text-muted"
                  style={{ left: x }}
                >
                  {label}
                </div>
              ))}

              {/* Connector lines */}
              <svg
                viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="bracket-line" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="rgba(240,246,252,0.32)" />
                    <stop offset="50%" stopColor="rgba(245,158,11,0.55)" />
                    <stop offset="100%" stopColor="rgba(240,246,252,0.32)" />
                  </linearGradient>
                </defs>
                {connectors.map((line, index) => (
                  <g key={`${line.x1}-${line.y1}-${index}`}>
                    <line
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      stroke="rgba(0,0,0,0.42)"
                      strokeWidth="9"
                      strokeLinecap="round"
                    />
                    <line
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      stroke="url(#bracket-line)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </g>
                ))}
              </svg>

              {/* Game nodes */}
              {nodes.map((node) => {
                const game = node.gameId ? (games[node.gameId] ?? null) : null;
                return game ? (
                  <Miniature key={node.key} node={node} game={game} />
                ) : (
                  <EmptySlot key={node.key} node={node} />
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
