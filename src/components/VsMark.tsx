type VsMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses: Record<NonNullable<VsMarkProps["size"]>, string> = {
  sm: "h-8 w-8 text-base",
  md: "h-10 w-10 text-lg",
  lg: "h-16 w-16 text-3xl"
};

export function VsMark({ size = "md", className = "" }: VsMarkProps) {
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-bg-base font-display font-semibold leading-none text-accent shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)]",
        sizeClasses[size],
        className
      ].join(" ")}
    >
      {/* Teko sits high in its box; nudge it onto the optical centre. */}
      <span className="translate-y-[0.08em]">VS</span>
    </div>
  );
}
