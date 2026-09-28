"use client";

import { VsMark } from "@/components/VsMark";

type VsBannerProps = {
  state: "idle" | "deciding" | "revealed";
};

export function VsBanner({ state }: VsBannerProps) {
  return (
    <div className="hidden md:block absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
      <VsMark
        size="lg"
        className={[
          "transition-[transform,opacity] duration-300 ease-out",
          state === "deciding" ? "scale-110" : "scale-100",
          state === "revealed" ? "opacity-0" : "opacity-100"
        ].join(" ")}
      />
    </div>
  );
}
