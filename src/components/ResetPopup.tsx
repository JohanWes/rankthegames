"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const RESET_DISPLAY_MS = 1000;

type ResetPopupProps = {
  visible: boolean;
  streak: number;
  onComplete: () => void;
};

export function ResetPopup({ visible, streak, onComplete }: ResetPopupProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onComplete, RESET_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [visible, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Glow backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.12), transparent 70%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            aria-hidden="true"
          />

          {/* Content */}
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
            }}
          >
            <h2
              className="font-display text-8xl font-bold tracking-wider text-accent glow-accent-text sm:text-9xl"
            >
              RESET!
            </h2>

            <motion.p
              className="mt-2 font-display text-3xl font-bold text-text-primary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              {streak} streak
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
