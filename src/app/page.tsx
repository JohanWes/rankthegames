import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="text-center">
        {/* Title */}
        <h1 className="font-display text-7xl font-bold leading-none tracking-tight sm:text-8xl lg:text-9xl">
          <span className="bg-gradient-to-r from-neon-cyan to-neon-purple bg-clip-text text-transparent neon-glow-cyan">
            THIS OR THAT
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-lg text-text-secondary sm:text-xl">
          Which game is more popular?
        </p>

        {/* Play button */}
        <Link
          href="/game"
          className="mt-10 inline-block rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple px-12 py-4 font-display text-2xl font-bold text-bg-deep transition-transform hover:scale-105 active:scale-95"
        >
          PLAY
        </Link>

        {/* Leaderboard link */}
        <div className="mt-6">
          <Link
            href="/leaderboard"
            className="text-sm text-text-secondary underline underline-offset-4 transition-colors hover:text-neon-cyan"
          >
            View Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
