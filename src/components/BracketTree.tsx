"use client";

import { motion } from "framer-motion";

import { BracketChampionCard } from "@/components/BracketChampionCard";
import { BracketMatchCard } from "@/components/BracketMatchCard";
import { useFitScale } from "@/hooks/useFitScale";
import type { TournamentStage } from "@/lib/bracket";
import { getAdvancingGameId, type BracketMatch, type BracketModel } from "@/lib/bracket-model";
import type { RunGame } from "@/lib/types";

const COLUMN_WIDTH = 200;
const COLUMN_GAP = 34;
const HEADER_HEIGHT = 36;
const TREE_HEIGHT = 560;
const NATURAL_WIDTH = COLUMN_WIDTH * 7 + COLUMN_GAP * 6;
const NATURAL_HEIGHT = HEADER_HEIGHT + TREE_HEIGHT;

type ColumnSpec = {
  stage: TournamentStage;
  rounds: number[];
  side: "left" | "right";
  /** Columns further from the centre animate in first. */
  depth: number;
};

const LEFT_COLUMNS: ColumnSpec[] = [
  { stage: "round-of-16", rounds: [1, 2, 3, 4], side: "left", depth: 0 },
  { stage: "quarterfinal", rounds: [9, 10], side: "left", depth: 1 },
  { stage: "semifinal", rounds: [13], side: "left", depth: 2 }
];

const RIGHT_COLUMNS: ColumnSpec[] = [
  { stage: "semifinal", rounds: [14], side: "right", depth: 2 },
  { stage: "quarterfinal", rounds: [11, 12], side: "right", depth: 1 },
  { stage: "round-of-16", rounds: [5, 6, 7, 8], side: "right", depth: 0 }
];

type BracketTreeProps = {
  model: BracketModel;
  games: Record<string, RunGame>;
  revealScores: boolean;
  isRunOver: boolean;
};

function getCellClasses(spec: ColumnSpec, match: BracketMatch, index: number) {
  const classes = ["bracket-cell"];

  if (spec.stage === "semifinal") {
    classes.push("bracket-feed-straight");
  } else {
    classes.push(index % 2 === 0 ? "bracket-feed-top" : "bracket-feed-bottom");
  }
  if (getAdvancingGameId(match)) classes.push("feed-lit");

  if (spec.stage !== "round-of-16") {
    classes.push("bracket-receive");
    if (match.topGameId || match.bottomGameId) classes.push("receive-lit");
  }

  return classes.join(" ");
}

function columnMotion(depth: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28, ease: "easeOut" as const, delay: 0.04 + depth * 0.06 }
  };
}

export function BracketTree({ model, games, revealScores, isRunOver }: BracketTreeProps) {
  const { containerRef, scale } = useFitScale<HTMLDivElement>({
    width: NATURAL_WIDTH,
    height: NATURAL_HEIGHT,
    padding: 32,
    minScale: 0.55,
    maxScale: 2
  });

  const stageTitles = Object.fromEntries(model.stages.map((stage) => [stage.id, stage.title]));
  const finalMatch = model.matches[15];
  const champion = model.championId ? (games[model.championId] ?? null) : null;

  function renderHeader(stage: TournamentStage, key: string) {
    const isCurrent = !isRunOver && stage === model.currentStageId;
    return (
      <div
        key={key}
        className={[
          "text-center font-display text-lg uppercase leading-none tracking-[0.18em]",
          isCurrent ? "text-accent" : "text-text-secondary"
        ].join(" ")}
        style={{ width: COLUMN_WIDTH }}
      >
        {stageTitles[stage]}
      </div>
    );
  }

  function renderColumn(spec: ColumnSpec) {
    return (
      <motion.div
        key={`${spec.side}-${spec.stage}`}
        dir={spec.side === "right" ? "rtl" : "ltr"}
        className="flex flex-col"
        style={{ width: COLUMN_WIDTH, height: TREE_HEIGHT }}
        {...columnMotion(spec.depth)}
      >
        {spec.rounds.map((round, index) => {
          const match = model.matches[round];
          return (
            <div key={round} className={`${getCellClasses(spec, match, index)} flex-1`}>
              <div dir="ltr" className="w-full">
                <BracketMatchCard
                  match={match}
                  games={games}
                  revealScores={revealScores}
                  isRunOver={isRunOver}
                />
              </div>
            </div>
          );
        })}
      </motion.div>
    );
  }

  const finalCellClasses = [
    "bracket-cell bracket-receive bracket-receive-end h-full",
    finalMatch.topGameId ? "receive-lit" : "",
    finalMatch.bottomGameId ? "receive-end-lit" : ""
  ].join(" ");

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: NATURAL_WIDTH,
          height: NATURAL_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
          ["--bracket-gap" as string]: `${COLUMN_GAP}px`
        }}
      >
        <div className="flex items-start" style={{ height: HEADER_HEIGHT, gap: COLUMN_GAP }}>
          {LEFT_COLUMNS.map((spec) => renderHeader(spec.stage, `h-left-${spec.stage}`))}
          {renderHeader("final", "h-final")}
          {RIGHT_COLUMNS.map((spec) => renderHeader(spec.stage, `h-right-${spec.stage}`))}
        </div>

        <div className="flex" style={{ gap: COLUMN_GAP }}>
          {LEFT_COLUMNS.map(renderColumn)}

          <motion.div
            className="flex flex-col"
            style={{ width: COLUMN_WIDTH, height: TREE_HEIGHT }}
            {...columnMotion(3)}
          >
            <div className={finalCellClasses}>
              <div className="relative w-full">
                <div className="absolute inset-x-0 bottom-full mb-6">
                  <BracketChampionCard champion={champion} />
                </div>
                <BracketMatchCard
                  match={finalMatch}
                  games={games}
                  revealScores={revealScores}
                  isRunOver={isRunOver}
                />
              </div>
            </div>
          </motion.div>

          {RIGHT_COLUMNS.map(renderColumn)}
        </div>
      </div>
    </div>
  );
}
