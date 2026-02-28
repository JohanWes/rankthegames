"use client";

type VsBannerProps = {
  state: "idle" | "deciding" | "revealed";
};

export function VsBanner({ state }: VsBannerProps) {
  return (
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
      <div
        className={`
          glass flex h-20 w-20 items-center justify-center rounded-full
          transition-all duration-300
          ${state === "deciding" ? "scale-110" : "scale-100"}
          ${state === "revealed" ? "opacity-60" : "opacity-100"}
        `}
      >
        <span className="font-display text-3xl font-bold text-neon-cyan neon-glow-cyan">
          VS
        </span>
      </div>
    </div>
  );
}
