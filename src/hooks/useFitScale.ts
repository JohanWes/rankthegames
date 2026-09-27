"use client";

import { useLayoutEffect, useRef, useState } from "react";

type FitScaleOptions = {
  width: number;
  height: number;
  padding?: number;
  minScale?: number;
  maxScale?: number;
};

/** Scale factor that fits fixed-size content inside the observed container. */
export function useFitScale<T extends HTMLElement>({
  width,
  height,
  padding = 0,
  minScale = 0.5,
  maxScale = 1
}: FitScaleOptions) {
  const containerRef = useRef<T>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    function update() {
      if (!element || element.clientWidth === 0 || element.clientHeight === 0) return;
      const fit = Math.min(
        (element.clientWidth - padding * 2) / width,
        (element.clientHeight - padding * 2) / height
      );
      setScale(Math.min(maxScale, Math.max(minScale, fit)));
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width, height, padding, minScale, maxScale]);

  return { containerRef, scale };
}
