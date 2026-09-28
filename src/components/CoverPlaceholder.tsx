type CoverPlaceholderProps = {
  name?: string;
  iconSize?: number;
};

/** Flat stand-in for a missing cover: a controller outline, optionally with the title. */
export function CoverPlaceholder({ name, iconSize = 48 }: CoverPlaceholderProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-raised p-4 text-text-muted">
      <svg width={iconSize} height={iconSize} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path
          d="M20 18H44C50.627 18 56 23.373 56 30V34C56 40.627 50.627 46 44 46H20C13.373 46 8 40.627 8 34V30C8 23.373 13.373 18 20 18Z"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path d="M22 27V37M17 32H27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="42" cy="29" r="2.5" fill="currentColor" />
        <circle cx="47" cy="34" r="2.5" fill="currentColor" />
      </svg>
      {name && (
        <span className="text-center font-display text-2xl leading-tight text-text-secondary">{name}</span>
      )}
    </div>
  );
}
