"use client";

type ScreenFlashProps = {
  type: "correct" | "incorrect" | null;
};

export function ScreenFlash({ type }: ScreenFlashProps) {
  if (!type) return null;

  const isCorrect = type === "correct";

  // Correct: subtle edge radial gradients (top + bottom)
  // Incorrect: center radial gradient
  const gradient = isCorrect
    ? `radial-gradient(ellipse 120% 40% at 50% 0%, rgba(34, 197, 94, 0.15), transparent 60%),
       radial-gradient(ellipse 120% 40% at 50% 100%, rgba(34, 197, 94, 0.15), transparent 60%)`
    : "radial-gradient(ellipse at center, rgba(239, 68, 68, 0.2), transparent 70%)";

  const animClass = isCorrect ? "animate-flash-correct" : "animate-flash-incorrect";

  return (
    <div
      key={`${type}-${Date.now()}`}
      className={`pointer-events-none fixed inset-0 z-40 ${animClass}`}
      style={{ background: gradient }}
      aria-hidden="true"
    />
  );
}
