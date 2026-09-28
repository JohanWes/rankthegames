"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import { getCoverUrl } from "@/components/BracketMatchCard";
import type { RunGame } from "@/lib/types";

const RESET_DISPLAY_MS = 1000;

type ResetPopupProps = {
  visible: boolean;
  streak: number;
  champion: RunGame | null;
  onComplete: () => void;
};

export function ResetPopup({ visible, streak, champion, onComplete }: ResetPopupProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onComplete, RESET_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [visible, onComplete]);

  const coverUrl = getCoverUrl(champion);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="flex flex-col items-center px-6 text-center"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.06, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            {coverUrl && (
              <div className="relative mb-5 h-44 w-33 overflow-hidden rounded-lg border-2 border-gold shadow-[0_16px_48px_-12px_rgba(251,191,36,0.45)]">
                <Image src={coverUrl} alt="" fill sizes="132px" className="object-cover" />
              </div>
            )}

            <h2 className="font-display text-8xl font-semibold uppercase leading-[0.8] text-gold sm:text-9xl">
              Champion
            </h2>

            <p className="mt-3 max-w-[80vw] font-display text-3xl leading-none text-text-primary">
              {champion?.name ?? "Bracket complete"}
            </p>

            <p className="mt-2 text-sm font-medium text-text-secondary">
              <span className="tabular font-semibold text-text-primary">{streak}</span> correct picks
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
