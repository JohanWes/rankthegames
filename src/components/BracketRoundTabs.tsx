"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { BracketChampionCard } from "@/components/BracketChampionCard";
import { BracketMatchCard } from "@/components/BracketMatchCard";
import type { TournamentStage } from "@/lib/bracket";
import type { BracketModel } from "@/lib/bracket-model";
import type { RunGame } from "@/lib/types";

type BracketRoundTabsProps = {
  model: BracketModel;
  games: Record<string, RunGame>;
  revealScores: boolean;
  isRunOver: boolean;
};

export function BracketRoundTabs({ model, games, revealScores, isRunOver }: BracketRoundTabsProps) {
  // Remounted each time the overlay opens, so it always starts on the current stage.
  const [activeStageId, setActiveStageId] = useState<TournamentStage>(model.currentStageId);
  const activeStage = model.stages.find((stage) => stage.id === activeStageId) ?? model.stages[0];
  const champion = model.championId ? (games[model.championId] ?? null) : null;

  return (
    <div className="flex h-full flex-col">
      <div
        role="tablist"
        aria-label="Bracket stages"
        className="mx-4 mt-3 grid shrink-0 grid-cols-4 gap-1 rounded-xl border border-white/10 bg-bg-base/80 p-1"
      >
        {model.stages.map((stage) => {
          const isActive = stage.id === activeStage.id;
          const doneCount = stage.matches.filter((match) => match.status === "done").length;
          const isCurrent = !isRunOver && stage.id === model.currentStageId;

          return (
            <button
              key={stage.id}
              type="button"
              role="tab"
              id={`bracket-tab-${stage.id}`}
              aria-selected={isActive}
              aria-controls="bracket-tabpanel"
              onClick={() => setActiveStageId(stage.id)}
              className={[
                "relative flex flex-col items-center rounded-lg px-1 py-1.5 transition-colors",
                isActive ? "bg-accent/15 text-accent" : "text-text-secondary hover:text-text-primary"
              ].join(" ")}
            >
              <span className="font-display text-lg uppercase leading-none tracking-[0.1em]">
                {stage.shortTitle}
              </span>
              <span className="mt-0.5 text-[10px] font-semibold tabular-nums leading-none opacity-75">
                {doneCount}/{stage.matches.length}
              </span>
              {isCurrent && (
                <span
                  className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="bracket-tabpanel"
        aria-labelledby={`bracket-tab-${activeStage.id}`}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-8"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeStage.id}
            className="mx-auto flex max-w-md flex-col gap-5"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <h3 className="font-display text-2xl uppercase leading-none tracking-[0.14em] text-text-secondary">
              {activeStage.title}
            </h3>

            {activeStage.id === "final" && (
              <div className="mx-auto w-48 py-2">
                <BracketChampionCard champion={champion} />
              </div>
            )}

            {activeStage.matches.map((match) => (
              <BracketMatchCard
                key={match.round}
                match={match}
                games={games}
                revealScores={revealScores}
                isRunOver={isRunOver}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
