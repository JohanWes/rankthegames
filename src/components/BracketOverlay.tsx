"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

import { getBracketRoundPair } from "@/lib/bracket";
import type { RunGame, RunPair, RunSelection } from "@/lib/types";

type BracketOverlayProps = {
  open: boolean;
  onClose: () => void;
  games: Record<string, RunGame>;
  openingPairs: RunPair[];
  selections: RunSelection[];
  currentRound: number;
};

type BracketSlot = {
  key: string;
  x: number;
  y: number;
  gameId: string | null;
  eliminated?: boolean;
  active?: boolean;
  winner?: boolean;
};

type BranchLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type Point = {
  x: number;
  y: number;
};

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

const WORLD_WIDTH = 1540;
const WORLD_HEIGHT = 820;
const CARD_WIDTH = 74;
const CARD_HEIGHT = 100;
const MIN_ZOOM_FLOOR = 0.2;
const MAX_ZOOM = 3.1;
const CAMERA_MARGIN = 96;

const seedY = [100, 175, 250, 325, 495, 570, 645, 720];
const leftSeedX = 105;
const rightSeedX = 1435;
const leftFirstWinnerX = 270;
const rightFirstWinnerX = 1270;
const leftQuarterWinnerX = 450;
const rightQuarterWinnerX = 1090;
const leftFinalistX = 620;
const rightFinalistX = 920;
const championX = 770;
const firstWinnerY = [137.5, 287.5, 532.5, 682.5];
const quarterWinnerY = [212.5, 607.5];
const finalistY = 410;

const currentRoundInputs: Record<number, string[]> = {
  9: ["w1", "w2"],
  10: ["w3", "w4"],
  11: ["w5", "w6"],
  12: ["w7", "w8"],
  13: ["w9", "w10"],
  14: ["w11", "w12"],
  15: ["w13", "w14"]
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSelection(selections: RunSelection[], round: number) {
  return selections.find((selection) => selection.round === round) ?? null;
}

function getCoverUrl(game: RunGame | null) {
  return game?.imageUrl ?? game?.thumbUrl ?? null;
}

function getGameName(game: RunGame | null) {
  return game?.name ?? "";
}

function getViewportSize(element: HTMLDivElement | null): ViewportSize | null {
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return null;
  return { width: rect.width, height: rect.height };
}

function getFitZoom(size: ViewportSize) {
  const horizontal = (size.width - 48) / WORLD_WIDTH;
  const vertical = (size.height - 72) / WORLD_HEIGHT;
  return Math.max(MIN_ZOOM_FLOOR, Math.min(horizontal, vertical));
}

function getMinZoom(size: ViewportSize) {
  return Math.max(MIN_ZOOM_FLOOR, getFitZoom(size) * 0.82);
}

function clampCamera(camera: Camera, size: ViewportSize): Camera {
  const zoom = clamp(camera.zoom, getMinZoom(size), MAX_ZOOM);
  const scaledWidth = WORLD_WIDTH * zoom;
  const scaledHeight = WORLD_HEIGHT * zoom;

  let x = camera.x;
  let y = camera.y;

  if (scaledWidth <= size.width - CAMERA_MARGIN * 2) {
    x = (size.width - scaledWidth) / 2;
  } else {
    x = clamp(x, size.width - scaledWidth - CAMERA_MARGIN, CAMERA_MARGIN);
  }

  if (scaledHeight <= size.height - CAMERA_MARGIN * 2) {
    y = (size.height - scaledHeight) / 2;
  } else {
    y = clamp(y, size.height - scaledHeight - CAMERA_MARGIN, CAMERA_MARGIN);
  }

  return { x, y, zoom };
}

function centerCameraOn(point: Point, zoom: number, size: ViewportSize): Camera {
  return clampCamera(
    {
      x: size.width / 2 - point.x * zoom,
      y: size.height / 2 - point.y * zoom,
      zoom
    },
    size
  );
}

function getInitialCamera(size: ViewportSize, focusPoint: Point): Camera {
  const fitZoom = getFitZoom(size);

  if (size.width < 768) {
    const mobileZoom = clamp(Math.max(fitZoom, size.width / 440), getMinZoom(size), MAX_ZOOM);
    return centerCameraOn(focusPoint, mobileZoom, size);
  }

  const desktopZoom = clamp(Math.min(fitZoom, 1.05), getMinZoom(size), MAX_ZOOM);
  return clampCamera(
    {
      x: (size.width - WORLD_WIDTH * desktopZoom) / 2,
      y: (size.height - WORLD_HEIGHT * desktopZoom) / 2,
      zoom: desktopZoom
    },
    size
  );
}

function getInitialSlots(
  games: Record<string, RunGame>,
  openingPairs: RunPair[],
  selections: RunSelection[],
  currentRound: number
): BracketSlot[] {
  return openingPairs.flatMap((pair, index) => {
    const isRightHalf = index >= 4;
    const pairIndex = isRightHalf ? index - 4 : index;
    const yIndex = pairIndex * 2;
    const selection = getSelection(selections, pair.round);
    const active = currentRound === pair.round;

    return [
      {
        key: `r${pair.round}-left`,
        x: isRightHalf ? rightSeedX : leftSeedX,
        y: seedY[yIndex],
        gameId: pair.leftGameId,
        eliminated: !!selection && selection.pickedGameId !== pair.leftGameId,
        active
      },
      {
        key: `r${pair.round}-right`,
        x: isRightHalf ? rightSeedX : leftSeedX,
        y: seedY[yIndex + 1],
        gameId: pair.rightGameId,
        eliminated: !!selection && selection.pickedGameId !== pair.rightGameId,
        active
      }
    ];
  }).filter((slot) => slot.gameId == null || games[slot.gameId]);
}

function createWinnerSlot({
  key,
  sourceRound,
  x,
  y,
  selections,
  currentRound
}: {
  key: string;
  sourceRound: number;
  x: number;
  y: number;
  selections: RunSelection[];
  currentRound: number;
}): BracketSlot {
  const selection = getSelection(selections, sourceRound);

  return {
    key,
    x,
    y,
    gameId: selection?.pickedGameId ?? null,
    active: currentRoundInputs[currentRound]?.includes(key) ?? false,
    winner: !!selection
  };
}

function getWinnerSlots(selections: RunSelection[], currentRound: number): BracketSlot[] {
  return [
    ...[1, 2, 3, 4].map((round, index) =>
      createWinnerSlot({
        key: `w${round}`,
        sourceRound: round,
        x: leftFirstWinnerX,
        y: firstWinnerY[index],
        selections,
        currentRound
      })
    ),
    ...[5, 6, 7, 8].map((round, index) =>
      createWinnerSlot({
        key: `w${round}`,
        sourceRound: round,
        x: rightFirstWinnerX,
        y: firstWinnerY[index],
        selections,
        currentRound
      })
    ),
    ...[9, 10].map((round, index) =>
      createWinnerSlot({
        key: `w${round}`,
        sourceRound: round,
        x: leftQuarterWinnerX,
        y: quarterWinnerY[index],
        selections,
        currentRound
      })
    ),
    ...[11, 12].map((round, index) =>
      createWinnerSlot({
        key: `w${round}`,
        sourceRound: round,
        x: rightQuarterWinnerX,
        y: quarterWinnerY[index],
        selections,
        currentRound
      })
    ),
    createWinnerSlot({
      key: "w13",
      sourceRound: 13,
      x: leftFinalistX,
      y: finalistY,
      selections,
      currentRound
    }),
    createWinnerSlot({
      key: "w14",
      sourceRound: 14,
      x: rightFinalistX,
      y: finalistY,
      selections,
      currentRound
    }),
    createWinnerSlot({
      key: "w15",
      sourceRound: 15,
      x: championX,
      y: finalistY,
      selections,
      currentRound
    })
  ];
}

function buildSlots(
  games: Record<string, RunGame>,
  openingPairs: RunPair[],
  selections: RunSelection[],
  currentRound: number
) {
  return [
    ...getInitialSlots(games, openingPairs, selections, currentRound),
    ...getWinnerSlots(selections, currentRound)
  ];
}

function getFocusPoint(slots: BracketSlot[]): Point {
  const activeSlots = slots.filter((slot) => slot.active && slot.gameId);
  const targetSlots = activeSlots.length > 0 ? activeSlots : slots.filter((slot) => slot.gameId);

  if (targetSlots.length === 0) {
    return { x: championX, y: finalistY };
  }

  return {
    x: targetSlots.reduce((sum, slot) => sum + slot.x, 0) / targetSlots.length,
    y: targetSlots.reduce((sum, slot) => sum + slot.y, 0) / targetSlots.length
  };
}

function getBranchLines() {
  const lines: BranchLine[] = [];
  const edge = CARD_WIDTH / 2;

  function leftGroup(seedStartIndex: number, midX: number, outX: number, outputY: number) {
    const topY = seedY[seedStartIndex];
    const bottomY = seedY[seedStartIndex + 1];
    lines.push(
      { x1: leftSeedX + edge, y1: topY, x2: midX, y2: topY },
      { x1: leftSeedX + edge, y1: bottomY, x2: midX, y2: bottomY },
      { x1: midX, y1: topY, x2: midX, y2: bottomY },
      { x1: midX, y1: outputY, x2: outX - edge, y2: outputY }
    );
  }

  function rightGroup(seedStartIndex: number, midX: number, outX: number, outputY: number) {
    const topY = seedY[seedStartIndex];
    const bottomY = seedY[seedStartIndex + 1];
    lines.push(
      { x1: rightSeedX - edge, y1: topY, x2: midX, y2: topY },
      { x1: rightSeedX - edge, y1: bottomY, x2: midX, y2: bottomY },
      { x1: midX, y1: topY, x2: midX, y2: bottomY },
      { x1: midX, y1: outputY, x2: outX + edge, y2: outputY }
    );
  }

  leftGroup(0, 190, leftFirstWinnerX, firstWinnerY[0]);
  leftGroup(2, 190, leftFirstWinnerX, firstWinnerY[1]);
  leftGroup(4, 190, leftFirstWinnerX, firstWinnerY[2]);
  leftGroup(6, 190, leftFirstWinnerX, firstWinnerY[3]);
  rightGroup(0, 1350, rightFirstWinnerX, firstWinnerY[0]);
  rightGroup(2, 1350, rightFirstWinnerX, firstWinnerY[1]);
  rightGroup(4, 1350, rightFirstWinnerX, firstWinnerY[2]);
  rightGroup(6, 1350, rightFirstWinnerX, firstWinnerY[3]);

  lines.push(
    { x1: leftFirstWinnerX + edge, y1: firstWinnerY[0], x2: 360, y2: firstWinnerY[0] },
    { x1: leftFirstWinnerX + edge, y1: firstWinnerY[1], x2: 360, y2: firstWinnerY[1] },
    { x1: 360, y1: firstWinnerY[0], x2: 360, y2: firstWinnerY[1] },
    { x1: 360, y1: quarterWinnerY[0], x2: leftQuarterWinnerX - edge, y2: quarterWinnerY[0] },
    { x1: leftFirstWinnerX + edge, y1: firstWinnerY[2], x2: 360, y2: firstWinnerY[2] },
    { x1: leftFirstWinnerX + edge, y1: firstWinnerY[3], x2: 360, y2: firstWinnerY[3] },
    { x1: 360, y1: firstWinnerY[2], x2: 360, y2: firstWinnerY[3] },
    { x1: 360, y1: quarterWinnerY[1], x2: leftQuarterWinnerX - edge, y2: quarterWinnerY[1] },
    { x1: leftQuarterWinnerX + edge, y1: quarterWinnerY[0], x2: 535, y2: quarterWinnerY[0] },
    { x1: leftQuarterWinnerX + edge, y1: quarterWinnerY[1], x2: 535, y2: quarterWinnerY[1] },
    { x1: 535, y1: quarterWinnerY[0], x2: 535, y2: quarterWinnerY[1] },
    { x1: 535, y1: finalistY, x2: leftFinalistX - edge, y2: finalistY },
    { x1: leftFinalistX + edge, y1: finalistY, x2: championX - edge, y2: finalistY },
    { x1: rightFirstWinnerX - edge, y1: firstWinnerY[0], x2: 1180, y2: firstWinnerY[0] },
    { x1: rightFirstWinnerX - edge, y1: firstWinnerY[1], x2: 1180, y2: firstWinnerY[1] },
    { x1: 1180, y1: firstWinnerY[0], x2: 1180, y2: firstWinnerY[1] },
    { x1: 1180, y1: quarterWinnerY[0], x2: rightQuarterWinnerX + edge, y2: quarterWinnerY[0] },
    { x1: rightFirstWinnerX - edge, y1: firstWinnerY[2], x2: 1180, y2: firstWinnerY[2] },
    { x1: rightFirstWinnerX - edge, y1: firstWinnerY[3], x2: 1180, y2: firstWinnerY[3] },
    { x1: 1180, y1: firstWinnerY[2], x2: 1180, y2: firstWinnerY[3] },
    { x1: 1180, y1: quarterWinnerY[1], x2: rightQuarterWinnerX + edge, y2: quarterWinnerY[1] },
    { x1: rightQuarterWinnerX - edge, y1: quarterWinnerY[0], x2: 1005, y2: quarterWinnerY[0] },
    { x1: rightQuarterWinnerX - edge, y1: quarterWinnerY[1], x2: 1005, y2: quarterWinnerY[1] },
    { x1: 1005, y1: quarterWinnerY[0], x2: 1005, y2: quarterWinnerY[1] },
    { x1: 1005, y1: finalistY, x2: rightFinalistX + edge, y2: finalistY },
    { x1: rightFinalistX - edge, y1: finalistY, x2: championX + edge, y2: finalistY }
  );

  return lines;
}

function StageLabel({ children, x }: { children: string; x: number }) {
  return (
    <div
      className="absolute top-7 -translate-x-1/2 font-display text-[18px] font-semibold uppercase tracking-[0.22em] text-text-muted"
      style={{ left: x }}
    >
      {children}
    </div>
  );
}

function EmptyMiniature({ slot }: { slot: BracketSlot }) {
  return (
    <div
      className={[
        "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-dashed border-white/12 bg-bg-elevated/24",
        slot.active ? "border-accent/45 bg-accent/8" : ""
      ].join(" ")}
      style={{
        left: slot.x,
        top: slot.y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT
      }}
      aria-hidden="true"
    >
      <div className="h-2 w-2 rounded-full bg-white/18" />
    </div>
  );
}

function Miniature({ slot, game }: { slot: BracketSlot; game: RunGame }) {
  const coverUrl = getCoverUrl(game);

  return (
    <div
      role="img"
      aria-label={getGameName(game)}
      className="absolute -translate-x-1/2 -translate-y-1/2 select-none"
      style={{
        left: slot.x,
        top: slot.y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT
      }}
    >
      <motion.div
        className={[
          "relative h-full w-full overflow-hidden rounded-lg border bg-bg-elevated shadow-[0_20px_40px_rgba(0,0,0,0.4)]",
          "transition-[border-color,filter,opacity,box-shadow] duration-200",
          slot.active
            ? "border-accent shadow-[0_0_0_2px_rgba(245,158,11,0.18),0_0_32px_rgba(245,158,11,0.4)]"
            : slot.winner
              ? "border-correct/80 shadow-[0_0_22px_rgba(34,197,94,0.22)]"
              : "border-white/16",
          slot.eliminated ? "opacity-40 grayscale" : "opacity-100"
        ].join(" ")}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: slot.eliminated ? 0.4 : 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            draggable={false}
            sizes={`${CARD_WIDTH * MAX_ZOOM}px`}
            className="pointer-events-none object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-bg-elevated via-bg-base to-black" />
        )}

        {slot.eliminated && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/48">
            <span className="font-display text-5xl font-black leading-none text-wrong drop-shadow-[0_0_12px_rgba(239,68,68,0.78)]">
              X
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function getTouchDistance(touches: React.TouchList) {
  if (touches.length < 2) return 0;
  const left = touches[0];
  const right = touches[1];
  return Math.hypot(right.clientX - left.clientX, right.clientY - left.clientY);
}

function getTouchMidpoint(touches: React.TouchList) {
  if (touches.length < 2) {
    return {
      x: touches[0]?.clientX ?? 0,
      y: touches[0]?.clientY ?? 0
    };
  }

  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

export function BracketOverlay({
  open,
  onClose,
  games,
  openingPairs,
  selections,
  currentRound
}: BracketOverlayProps) {
  const slots = useMemo(
    () => buildSlots(games, openingPairs, selections, currentRound),
    [games, openingPairs, selections, currentRound]
  );
  const lines = useMemo(() => getBranchLines(), []);
  const focusPoint = useMemo(() => getFocusPoint(slots), [slots]);
  const currentPair = getBracketRoundPair(currentRound, openingPairs, selections);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    camera: Camera;
  } | null>(null);
  const touchRef = useRef<
    | {
        mode: "pan";
        start: Point;
        camera: Camera;
      }
    | {
        mode: "pinch";
        distance: number;
        anchor: Point;
        camera: Camera;
      }
    | null
  >(null);
  const [camera, setCameraState] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 1, height: 1 });
  const [isDragging, setIsDragging] = useState(false);

  const setCamera = useCallback((nextCamera: Camera | ((camera: Camera) => Camera)) => {
    const size = getViewportSize(viewportRef.current);
    setCameraState((previousCamera) => {
      const rawCamera = typeof nextCamera === "function" ? nextCamera(previousCamera) : nextCamera;
      const clampedCamera = size ? clampCamera(rawCamera, size) : rawCamera;
      cameraRef.current = clampedCamera;
      return clampedCamera;
    });
  }, []);

  const setCameraForViewport = useCallback(
    (nextCamera: Camera | ((camera: Camera) => Camera), size: ViewportSize) => {
      setCameraState((previousCamera) => {
        const rawCamera = typeof nextCamera === "function" ? nextCamera(previousCamera) : nextCamera;
        const clampedCamera = clampCamera(rawCamera, size);
        cameraRef.current = clampedCamera;
        return clampedCamera;
      });
    },
    []
  );

  const resetToInitialView = useCallback(() => {
    const size = getViewportSize(viewportRef.current);
    if (!size) return;

    setViewportSize(size);
    setCameraForViewport(getInitialCamera(size, focusPoint), size);
  }, [focusPoint, setCameraForViewport]);

  const fitWholeBracket = useCallback(() => {
    const size = getViewportSize(viewportRef.current);
    if (!size) return;

    const zoom = clamp(Math.min(getFitZoom(size), 1.05), getMinZoom(size), MAX_ZOOM);
    setViewportSize(size);
    setCameraForViewport(
      {
        x: (size.width - WORLD_WIDTH * zoom) / 2,
        y: (size.height - WORLD_HEIGHT * zoom) / 2,
        zoom
      },
      size
    );
  }, [setCameraForViewport]);

  const zoomAtPoint = useCallback(
    (nextZoom: number, point: Point) => {
      setCamera((previousCamera) => {
        const worldPoint = {
          x: (point.x - previousCamera.x) / previousCamera.zoom,
          y: (point.y - previousCamera.y) / previousCamera.zoom
        };
        const size = getViewportSize(viewportRef.current);
        const zoom = size
          ? clamp(nextZoom, getMinZoom(size), MAX_ZOOM)
          : clamp(nextZoom, MIN_ZOOM_FLOOR, MAX_ZOOM);

        return {
          x: point.x - worldPoint.x * zoom,
          y: point.y - worldPoint.y * zoom,
          zoom
        };
      });
    },
    [setCamera]
  );

  const zoomFromCenter = useCallback(
    (factor: number) => {
      const size = getViewportSize(viewportRef.current);
      if (!size) return;
      zoomAtPoint(cameraRef.current.zoom * factor, {
        x: size.width / 2,
        y: size.height / 2
      });
    },
    [zoomAtPoint]
  );

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(resetToInitialView);

    return () => window.cancelAnimationFrame(frame);
  }, [open, resetToInitialView]);

  useEffect(() => {
    if (!open) return;

    function handleResize() {
      const size = getViewportSize(viewportRef.current);
      if (!size) return;

      setViewportSize(size);
      setCameraForViewport((previousCamera) => previousCamera, size);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open, setCameraForViewport]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();

      const rect = event.currentTarget.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      const nextZoom = cameraRef.current.zoom * Math.exp(-event.deltaY * 0.00135);
      zoomAtPoint(nextZoom, point);
    },
    [zoomAtPoint]
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      camera: cameraRef.current
    };
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      setCamera({
        x: drag.camera.x + event.clientX - drag.startX,
        y: drag.camera.y + event.clientY - drag.startY,
        zoom: drag.camera.zoom
      });
    },
    [setCamera]
  );

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;

    dragRef.current = null;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchRef.current = {
        mode: "pan",
        start: {
          x: touch.clientX,
          y: touch.clientY
        },
        camera: cameraRef.current
      };
      setIsDragging(true);
      return;
    }

    if (event.touches.length >= 2) {
      const midpoint = getTouchMidpoint(event.touches);
      const point = {
        x: midpoint.x - rect.left,
        y: midpoint.y - rect.top
      };
      const camera = cameraRef.current;

      touchRef.current = {
        mode: "pinch",
        distance: getTouchDistance(event.touches),
        anchor: {
          x: (point.x - camera.x) / camera.zoom,
          y: (point.y - camera.y) / camera.zoom
        },
        camera
      };
      setIsDragging(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const gesture = touchRef.current;
      if (!gesture) return;

      event.preventDefault();

      if (event.touches.length >= 2 && gesture.mode === "pinch") {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect || gesture.distance === 0) return;

        const midpoint = getTouchMidpoint(event.touches);
        const point = {
          x: midpoint.x - rect.left,
          y: midpoint.y - rect.top
        };
        const nextZoom = gesture.camera.zoom * (getTouchDistance(event.touches) / gesture.distance);

        setCamera({
          x: point.x - gesture.anchor.x * nextZoom,
          y: point.y - gesture.anchor.y * nextZoom,
          zoom: nextZoom
        });
        return;
      }

      if (event.touches.length === 1 && gesture.mode === "pan") {
        const touch = event.touches[0];
        setCamera({
          x: gesture.camera.x + touch.clientX - gesture.start.x,
          y: gesture.camera.y + touch.clientY - gesture.start.y,
          zoom: gesture.camera.zoom
        });
      }
    },
    [setCamera]
  );

  const handleTouchEnd = useCallback(() => {
    touchRef.current = null;
    setIsDragging(false);
  }, []);

  const viewportWorldRect = {
    x: clamp(-camera.x / camera.zoom, 0, WORLD_WIDTH),
    y: clamp(-camera.y / camera.zoom, 0, WORLD_HEIGHT),
    width: clamp(viewportSize.width / camera.zoom, 0, WORLD_WIDTH),
    height: clamp(viewportSize.height / camera.zoom, 0, WORLD_HEIGHT)
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Tournament bracket"
          className="fixed inset-0 z-50 overflow-hidden bg-[#050912]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 md:p-5">
            <div className="pointer-events-auto rounded-lg border border-white/10 bg-bg-base/78 px-3 py-2 shadow-2xl backdrop-blur-xl md:px-4">
              <p className="font-display text-2xl font-semibold leading-none text-text-primary md:text-3xl">
                Bracket
              </p>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                Round {currentPair ? currentRound : Math.min(currentRound, 15)} / 15
              </p>
            </div>

            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/10 bg-bg-base/78 p-1.5 shadow-2xl backdrop-blur-xl">
              <button
                type="button"
                onClick={() => zoomFromCenter(0.82)}
                aria-label="Zoom out"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-2xl leading-none text-text-secondary transition-colors hover:border-accent/60 hover:text-accent"
              >
                -
              </button>
              <div className="hidden min-w-14 text-center font-display text-xl font-semibold text-text-primary sm:block">
                {Math.round(camera.zoom * 100)}%
              </div>
              <button
                type="button"
                onClick={() => zoomFromCenter(1.22)}
                aria-label="Zoom in"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-2xl leading-none text-text-secondary transition-colors hover:border-accent/60 hover:text-accent"
              >
                +
              </button>
              <button
                type="button"
                onClick={fitWholeBracket}
                className="hidden h-10 rounded-md border border-white/10 px-3 font-display text-lg font-semibold uppercase tracking-[0.08em] text-text-secondary transition-colors hover:border-accent/60 hover:text-accent sm:block"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={resetToInitialView}
                className="hidden h-10 rounded-md border border-white/10 px-3 font-display text-lg font-semibold uppercase tracking-[0.08em] text-text-secondary transition-colors hover:border-accent/60 hover:text-accent md:block"
              >
                Focus
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close bracket"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-2xl leading-none text-text-secondary transition-colors hover:border-wrong/70 hover:text-wrong"
              >
                X
              </button>
            </div>
          </div>

          <motion.div
            ref={viewportRef}
            className={[
              "absolute inset-0 touch-none overflow-hidden select-none",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            ].join(" ")}
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 50%, rgba(245,158,11,0.10), transparent 28rem), linear-gradient(rgba(240,246,252,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(240,246,252,0.055) 1px, transparent 1px)",
              backgroundPosition: "center, center, center",
              backgroundSize: "100% 100%, 48px 48px, 48px 48px"
            }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            initial={{ scale: 0.99 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.99 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div
              className="absolute top-0 left-0"
              style={{
                width: WORLD_WIDTH,
                height: WORLD_HEIGHT,
                transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
                transformOrigin: "0 0",
                transition: isDragging ? "none" : "transform 110ms ease-out",
                willChange: "transform"
              }}
              aria-label={
                currentPair
                  ? `Tournament bracket current round ${currentRound}`
                  : "Tournament bracket"
              }
            >
              <div className="absolute inset-0 rounded-[28px] border border-white/8 bg-bg-base/36 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_40px_120px_rgba(0,0,0,0.28)]" />
              <StageLabel x={105}>Openers</StageLabel>
              <StageLabel x={270}>Winners</StageLabel>
              <StageLabel x={450}>Quarters</StageLabel>
              <StageLabel x={770}>Final</StageLabel>
              <StageLabel x={1090}>Quarters</StageLabel>
              <StageLabel x={1270}>Winners</StageLabel>
              <StageLabel x={1435}>Openers</StageLabel>

              <svg
                viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="bracket-line" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="rgba(240,246,252,0.32)" />
                    <stop offset="50%" stopColor="rgba(245,158,11,0.55)" />
                    <stop offset="100%" stopColor="rgba(240,246,252,0.32)" />
                  </linearGradient>
                </defs>
                {lines.map((line, index) => (
                  <g key={`${line.x1}-${line.y1}-${index}`}>
                    <line
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      stroke="rgba(0,0,0,0.42)"
                      strokeWidth="9"
                      strokeLinecap="round"
                    />
                    <line
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      stroke="url(#bracket-line)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </g>
                ))}
              </svg>

              {slots.map((slot) => {
                const game = slot.gameId ? games[slot.gameId] ?? null : null;

                return game ? (
                  <Miniature key={slot.key} slot={slot} game={game} />
                ) : (
                  <EmptyMiniature key={slot.key} slot={slot} />
                );
              })}
            </div>
          </motion.div>

          <div className="pointer-events-none absolute right-4 bottom-4 z-20 hidden h-28 w-48 rounded-lg border border-white/10 bg-bg-base/70 p-2 shadow-2xl backdrop-blur-xl md:block">
            <div className="relative h-full w-full overflow-hidden rounded border border-white/8 bg-white/5">
              <div
                className="absolute rounded border border-accent bg-accent/12"
                style={{
                  left: `${(viewportWorldRect.x / WORLD_WIDTH) * 100}%`,
                  top: `${(viewportWorldRect.y / WORLD_HEIGHT) * 100}%`,
                  width: `${(viewportWorldRect.width / WORLD_WIDTH) * 100}%`,
                  height: `${(viewportWorldRect.height / WORLD_HEIGHT) * 100}%`
                }}
              />
              <div
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_12px_rgba(245,158,11,0.8)]"
                style={{
                  left: `${(focusPoint.x / WORLD_WIDTH) * 100}%`,
                  top: `${(focusPoint.y / WORLD_HEIGHT) * 100}%`
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
