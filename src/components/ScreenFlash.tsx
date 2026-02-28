"use client";

type ScreenFlashProps = {
  type: "correct" | "incorrect" | null;
};

export function ScreenFlash({ type }: ScreenFlashProps) {
  if (!type) return null;

  const gradient =
    type === "correct"
      ? "radial-gradient(ellipse at center, rgba(34, 197, 94, 0.25), transparent 70%)"
      : "radial-gradient(ellipse at center, rgba(239, 68, 68, 0.25), transparent 70%)";

  return (
    <div
      key={`${type}-${Date.now()}`}
      className="pointer-events-none fixed inset-0 z-40 animate-flash"
      style={{ background: gradient }}
      aria-hidden="true"
    />
  );
}
