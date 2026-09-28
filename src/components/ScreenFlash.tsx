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
    ? `radial-gradient(ellipse 120% 40% at 50% 0%, var(--color-correct-glow), transparent 60%),
       radial-gradient(ellipse 120% 40% at 50% 100%, var(--color-correct-glow), transparent 60%)`
    : "radial-gradient(ellipse at center, var(--color-wrong-glow), transparent 70%)";

  const animClass = isCorrect ? "animate-flash-correct" : "animate-flash-incorrect";

  return (
    <div
      key={type}
      className={`pointer-events-none fixed inset-0 z-40 ${animClass}`}
      style={{ background: gradient }}
      aria-hidden="true"
    />
  );
}
