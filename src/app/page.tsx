import Link from "next/link";
import { LandingRunPrefetch } from "@/components/LandingRunPrefetch";
import { DemoCards } from "@/components/DemoCards";

export default function LandingPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <LandingRunPrefetch />
      {/* Entrance animation is CSS-only so the prerendered HTML animates in before hydration */}
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 md:gap-10">
        <div className="animate-slide-up animate-slide-up-1 text-center">
          <h1 className="font-display text-6xl font-semibold uppercase leading-[0.85] tracking-[-0.01em] text-text-primary sm:text-7xl lg:text-8xl">
            Rank the <span className="text-accent">games</span>
          </h1>
          <p className="mt-4 text-base text-text-secondary sm:text-lg">
            Two games. Pick the more popular one. One miss ends the run.
          </p>
        </div>

        <div className="animate-slide-up animate-slide-up-2" aria-hidden="true">
          <DemoCards />
        </div>

        <div className="animate-slide-up animate-slide-up-3 flex flex-col items-center gap-5">
          <Link href="/game" className="btn-primary px-10 pt-4 pb-3 text-3xl">
            Pick the winner
          </Link>

          <Link
            href="/leaderboard"
            className="text-sm font-medium text-text-secondary underline decoration-line-strong underline-offset-4 transition-colors hover:text-text-primary hover:decoration-accent"
          >
            View leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
