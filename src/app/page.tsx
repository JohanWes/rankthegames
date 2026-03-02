"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LandingRunPrefetch } from "@/components/LandingRunPrefetch";
import { DemoCards } from "@/components/DemoCards";
import type { DemoPhase } from "@/components/DemoCards";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 14,
    },
  },
};

export default function LandingPage() {
  const [demoPhase, setDemoPhase] = useState<DemoPhase>("idle");
  const handlePhaseChange = useCallback((phase: DemoPhase) => {
    setDemoPhase(phase);
  }, []);

  const isWinner = demoPhase === "winner";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <LandingRunPrefetch />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex w-full max-w-5xl flex-col items-center gap-6 md:gap-8"
      >
        {/* Title */}
        <motion.div variants={itemVariants} className="text-center">
          <h1 className="font-display text-5xl font-bold leading-none tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-text-primary glow-accent-text">
              RANK THE{" "}
            </span>
            <span className="text-accent">GAMES</span>
          </h1>
          <p className="mt-3 text-sm text-text-secondary sm:text-base">
            Which game is more popular?
          </p>
        </motion.div>

        {/* Micro-demo */}
        <motion.div variants={itemVariants} aria-hidden="true">
          <DemoCards onPhaseChange={handlePhaseChange} />
        </motion.div>

        {/* Bouncing chevron arrow */}
        <motion.div
          variants={itemVariants}
          aria-hidden="true"
          className="-my-2"
        >
          <motion.svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            animate={{
              y: isWinner ? [0, 6, 0] : 0,
              opacity: isWinner ? 1 : 0.3,
            }}
            transition={{
              y: {
                duration: 0.6,
                ease: "easeInOut",
                repeat: isWinner ? 1 : 0,
              },
              opacity: { duration: 0.3 },
            }}
            className="text-accent"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </motion.div>

        {/* CTA section */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center gap-6"
        >
          <motion.div
            animate={{
              scale: isWinner ? 1.08 : 1,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
          >
            <Link
              href="/game"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-accent/60 bg-accent/10 px-12 py-4 font-display text-2xl font-bold tracking-wide text-accent transition-all duration-300 hover:bg-accent/20 hover:border-accent sm:text-3xl"
            >
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="absolute h-full w-full animate-pulse-glow rounded-full bg-accent/20" />
              </span>
              <span className="relative z-10">PICK THE WINNER</span>
            </Link>
          </motion.div>

          <Link
            href="/leaderboard"
            className="text-sm text-text-secondary underline underline-offset-4 transition-colors hover:text-accent"
          >
            View Leaderboard
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}
