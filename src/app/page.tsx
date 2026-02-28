"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LandingRunPrefetch } from "@/components/LandingRunPrefetch";

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
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <LandingRunPrefetch />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-2xl"
      >
        {/* Decorative accent lines */}
        <motion.div
          variants={itemVariants}
          className="absolute -left-8 top-1/2 h-px w-24 bg-gradient-to-r from-transparent via-accent/60 to-transparent hidden lg:block"
          style={{ transform: 'translateY(-50%)' }}
        />
        <motion.div
          variants={itemVariants}
          className="absolute -right-8 top-1/2 h-px w-24 bg-gradient-to-l from-transparent via-accent/60 to-transparent hidden lg:block"
          style={{ transform: 'translateY(-50%)' }}
        />

        {/* Glass card */}
        <motion.div
          variants={itemVariants}
          className="glass relative overflow-hidden rounded-3xl border border-white/8 px-8 py-16 md:px-16 md:py-20"
        >
          {/* Subtle inner glow */}
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-accent/5 to-transparent opacity-50" />
          
          <div className="relative text-center">
            {/* Title */}
            <motion.h1
              variants={itemVariants}
              className="font-display text-6xl font-bold leading-none tracking-tight sm:text-7xl lg:text-8xl"
            >
              <span className="text-text-primary glow-accent-text">
                RANK THE
              </span>
              <br />
              <span className="text-accent">GAMES</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="mt-6 text-base text-text-secondary sm:text-lg"
            >
              Which game is more popular?
            </motion.p>

            {/* Play button */}
            <motion.div variants={itemVariants} className="mt-10">
              <Link
                href="/game"
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-accent/60 bg-accent/10 px-10 py-4 font-display text-2xl font-bold text-accent transition-all duration-300 hover:bg-accent/20 hover:border-accent"
              >
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="absolute h-full w-full animate-pulse-glow rounded-full bg-accent/20" />
                </span>
                <span className="relative z-10">PLAY</span>
              </Link>
            </motion.div>

            {/* Leaderboard link */}
            <motion.div variants={itemVariants} className="mt-8">
              <Link
                href="/leaderboard"
                className="text-sm text-text-secondary underline underline-offset-4 transition-colors hover:text-accent"
              >
                View Leaderboard
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
