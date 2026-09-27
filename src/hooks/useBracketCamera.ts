"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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
  // clientWidth/Height ignore the overlay's open/close scale animation.
  if (!element || element.clientWidth === 0 || element.clientHeight === 0) return null;
  return { width: element.clientWidth, height: element.clientHeight };
}

function getFitZoom(size: ViewportSize) {
  const horizontal = (size.width - 48) / WORLD_WIDTH;
  const vertical = (size.height - 72) / WORLD_HEIGHT;
  return Math.max(MIN_ZOOM_FLOOR, Math.min(horizontal, vertical));
}

function getMinZoom(size: ViewportSize) {
  return Math.max(MIN_ZOOM_FLOOR, getFitZoom(size) * 0.82);
}

function clampZoom(zoom: number, size: ViewportSize) {
  return clamp(zoom, getMinZoom(size), MAX_ZOOM);
}

function clampCamera(camera: Camera, size: ViewportSize): Camera {
  const zoom = clampZoom(camera.zoom, size);
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

function getFitCamera(size: ViewportSize): Camera {
  const zoom = clampZoom(Math.min(getFitZoom(size), 1.05), size);
  return {
    x: (size.width - WORLD_WIDTH * zoom) / 2,
    y: (size.height - WORLD_HEIGHT * zoom) / 2,
    zoom
  };
}

function getInitialCamera(size: ViewportSize, focusPoint: Point): Camera {
  if (size.width >= 768) return getFitCamera(size);

  const zoom = clampZoom(Math.max(getFitZoom(size), size.width / 440), size);
  return {
    x: size.width / 2 - focusPoint.x * zoom,
    y: size.height / 2 - focusPoint.y * zoom,
    zoom
  };
}

/** Camera that keeps `worldPoint` under the screen-space `point` at `zoom`. */
function anchorCamera(worldPoint: Point, point: Point, zoom: number): Camera {
  return {
    x: point.x - worldPoint.x * zoom,
    y: point.y - worldPoint.y * zoom,
    zoom
  };
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
  // Read at reset time only, so round changes while open don't discard the user's view.
  const focusPointRef = useRef(focusPoint);
  focusPointRef.current = focusPoint;
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
  // True only for button-driven moves, which get a short CSS transition.
  const [isAnimated, setIsAnimated] = useState(false);

  const setCamera = useCallback(
    (
      nextCamera: Camera | ((camera: Camera, size: ViewportSize) => Camera),
      animated = false
    ) => {
      const size = getViewportSize(viewportRef.current);
      if (!size) return;
      setIsAnimated(animated);
      setCameraState((previousCamera) => {
        const rawCamera =
          typeof nextCamera === "function" ? nextCamera(previousCamera, size) : nextCamera;
        const clampedCamera = clampCamera(rawCamera, size);
        cameraRef.current = clampedCamera;
        return clampedCamera;
      });
    },
    []
  );

  const resetToInitialView = useCallback(
    (animated: boolean) =>
      setCamera((_, size) => getInitialCamera(size, focusPointRef.current), animated),
    [setCamera]
  );

  const zoomAtPoint = useCallback(
    (factor: number, point: Point, animated = false) => {
      setCamera((previousCamera, size) => {
        const worldPoint = {
          x: (point.x - previousCamera.x) / previousCamera.zoom,
          y: (point.y - previousCamera.y) / previousCamera.zoom
        };
        return anchorCamera(worldPoint, point, clampZoom(previousCamera.zoom * factor, size));
      }, animated);
    },
    [setCamera]
  );

  const zoomFromCenter = (factor: number) => {
    const size = getViewportSize(viewportRef.current);
    if (!size) return;
    zoomAtPoint(factor, { x: size.width / 2, y: size.height / 2 }, true);
  };

  // Fit on open, before first paint (the viewport ref is attached by now).
  useLayoutEffect(() => {
    if (active) resetToInitialView(false);
  }, [active, resetToInitialView]);

  // Handle resize
  useEffect(() => {
    if (!active) return;

    const handleResize = () => setCamera((previousCamera) => previousCamera);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [active, setCamera]);

  // Wheel / trackpad-pinch zoom. Native non-passive listener: React's onWheel is
  // passive, so preventDefault there can't stop ctrl+wheel from zooming the page.
  useEffect(() => {
    const element = viewportRef.current;
    if (!active || !element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      // Trackpad pinch arrives as ctrl+wheel with small deltas.
      const sensitivity = event.ctrlKey ? 0.01 : 0.00135;
      zoomAtPoint(Math.exp(-event.deltaY * sensitivity), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [active, zoomAtPoint]);

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

  // Touch handlers (pan + pinch). Page scroll/zoom is blocked by `touch-none`.
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

      if (event.touches.length >= 2 && gesture.mode === "pinch") {
        const element = viewportRef.current;
        const size = getViewportSize(element);
        if (!element || !size || gesture.distance === 0) return;

        const rect = element.getBoundingClientRect();
        const midpoint = getTouchMidpoint(event.touches);
        const point = {
          x: midpoint.x - rect.left,
          y: midpoint.y - rect.top
        };
        // Clamp before anchoring so the content stays under the fingers at the zoom limits.
        const zoom = clampZoom(
          gesture.camera.zoom * (getTouchDistance(event.touches) / gesture.distance),
          size
        );
        setCamera(anchorCamera(gesture.anchor, point, zoom));
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

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      // Fingers still down (e.g. lifting one of two): restart the gesture from them.
      if (event.touches.length > 0) {
        handleTouchStart(event);
        return;
      }
      touchRef.current = null;
      setIsDragging(false);
    },
    [handleTouchStart]
  );

  return {
    viewportRef,
    camera,
    isDragging,
    isAnimated,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd
    },
    fitWholeBracket: () => setCamera((_, size) => getFitCamera(size), true),
    resetToInitialView: () => resetToInitialView(true),
    zoomIn: () => zoomFromCenter(1.22),
    zoomOut: () => zoomFromCenter(0.82)
  };
}
