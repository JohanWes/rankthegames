"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { WORLD_WIDTH, WORLD_HEIGHT, MAX_ZOOM, type FocusPoint } from "@/lib/bracket-layout";

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

const MIN_ZOOM_FLOOR = 0.2;
const CAMERA_MARGIN = 96;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
    const mobileZoom = clamp(
      Math.max(fitZoom, size.width / 440),
      getMinZoom(size),
      MAX_ZOOM
    );
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

function getTouchDistance(touches: React.TouchList) {
  if (touches.length < 2) return 0;
  const left = touches[0];
  const right = touches[1];
  return Math.hypot(right.clientX - left.clientX, right.clientY - left.clientY);
}

function getTouchMidpoint(touches: React.TouchList): Point {
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

type UseBracketCameraOptions = {
  active: boolean;
  focusPoint: FocusPoint;
};

export function useBracketCamera({ active, focusPoint }: UseBracketCameraOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    camera: Camera;
  } | null>(null);
  const touchRef = useRef<
    | { mode: "pan"; start: Point; camera: Camera }
    | { mode: "pinch"; distance: number; anchor: Point; camera: Camera }
    | null
  >(null);
  const [camera, setCameraState] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
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
    setCameraForViewport(getInitialCamera(size, focusPoint), size);
  }, [focusPoint, setCameraForViewport]);

  const fitWholeBracket = useCallback(() => {
    const size = getViewportSize(viewportRef.current);
    if (!size) return;
    const zoom = clamp(Math.min(getFitZoom(size), 1.05), getMinZoom(size), MAX_ZOOM);
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

  // Sync cameraRef with state
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  // Reset on open
  useEffect(() => {
    if (!active) return;
    const frame = window.requestAnimationFrame(resetToInitialView);
    return () => window.cancelAnimationFrame(frame);
  }, [active, resetToInitialView]);

  // Handle resize
  useEffect(() => {
    if (!active) return;

    function handleResize() {
      const size = getViewportSize(viewportRef.current);
      if (!size) return;
      setCameraForViewport((previousCamera) => previousCamera, size);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [active, setCameraForViewport]);

  // Wheel zoom
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

  // Pointer pan (mouse / pen / single-touch)
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

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  // Touch handlers (pan + pinch)
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchRef.current = {
        mode: "pan",
        start: { x: touch.clientX, y: touch.clientY },
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
      const currentCamera = cameraRef.current;
      touchRef.current = {
        mode: "pinch",
        distance: getTouchDistance(event.touches),
        anchor: {
          x: (point.x - currentCamera.x) / currentCamera.zoom,
          y: (point.y - currentCamera.y) / currentCamera.zoom
        },
        camera: currentCamera
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

  return {
    viewportRef,
    camera,
    isDragging,
    handlers: {
      onWheel: handleWheel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd
    },
    fitWholeBracket,
    resetToInitialView,
    zoomIn: () => zoomFromCenter(1.22),
    zoomOut: () => zoomFromCenter(0.82)
  };
}
