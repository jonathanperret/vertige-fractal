import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MandelbrotCanvas,
  MandelbrotPalette,
  MandelbrotViewport,
} from './standalone/mandelbrot';

type OverlaySpec = [[number, number, number], string];

const defaultOverlaySpecs: OverlaySpec[] = [
  [[-1.4937222, 0.17819655, 8.61107], '12.png'],
  [[-1.2405645, 0.23397534, 23.4137], '13.png'],
  [[-1.326251, 0.1716343, 19.7618], '14.png'],
  [[-1.1769119, 0.2099396, 146.488], '1.png'],
  [[-1.194643, 0.22494905, 89.0857], '2.png'],
  [[-1.1646283, 0.20896037, 235.973], '3.png'],
  [[-1.1710526, 0.20083064, 600.0], '4.png'],
  [[-1.2937647, 0.21940078, 50.9397], '5.png'],
  [[-1.1739289, 0.20109071, 593.677], '6.png'],
  [[-1.1675626, 0.20080358, 3115.27], '7.png'],
  [[-1.1675779, 0.20015191, 33718.3], '8.png'],
  [[-1.1674278, 0.20014556, 24091.3], '9.png'],
  [[-1.1675217, 0.20018652, 27182.2], '10.png'],
  [[-1.1665803, 0.20102253, 2779.82], '11.png'],
  [[-1.1933927, 0.20618969, 90.6876], '15.png'],
  [[-1.1665459, 0.20031059, 1899.39], '16.png'],
  [[-1.1673148, 0.19993023, 8491.58], '17.png'],
  [[-1.1680137, 0.19931438, 10675.0], '18.png'],
  [[-1.1676485, 0.199318, 8010.5], '19.png'],
  [[-1.1678882, 0.19979915, 7556.4], '20.png'],
];

const overlayFilenames = defaultOverlaySpecs.map(([, f]) => f);
const OVERLAY_STORAGE_KEY = 'mandelbrot-overlay-positions';

const VIEWS_STORAGE_KEY = 'mandelbrot-camera-views';

const defaultCameraViews: Array<[number, number, number]> = [
  [-0.61134475, -0.040334556, 0.774388],
  [-1.2884501, 0.21523253, 5.7917],
  [-1.2487993, 0.20859993, 17.989],
  [-1.1741412, 0.21180441, 61.7813],
  [-1.1715733, 0.20003404, 379.561],
  [-1.1670974, 0.20055126, 1666.67],
  [-1.1674727, 0.20016897, 13567.2],
  [-1.1673872, 0.19993365, 8532.59],
  [-1.1679556, 0.19930395, 8937.45],
  [-1.1676251, 0.1993054, 8937.45],
  [-1.1678925, 0.19979762, 6835.37],
  [-0.59958959, 0.039706799, 0.80362],
];
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const palette: MandelbrotPalette = [
  [180, 150, 190], // muted lavender
  [220, 160, 170], // soft rose pink
  [245, 240, 245], // near-white
  [190, 190, 185], // warm gray
  [140, 165, 150], // sage green
  [200, 130, 155], // deeper rose
  [170, 195, 240], // light blue
  [100, 90, 105], // dark mauve
];

const paletteSpeed = 0.02;

const phasedProgress = (
  t: number,
  startFraction: number,
  endFraction: number,
): number => {
  if (t <= startFraction) {
    return 0;
  }

  if (t >= endFraction) {
    return 1;
  }

  return (t - startFraction) / (endFraction - startFraction);
};

function App(): JSX.Element {
  const [views, setViews] = useState<Array<[number, number, number]>>(() => {
    try {
      const saved = localStorage.getItem(VIEWS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      /* ignore */
    }
    return defaultCameraViews.map((v) => [...v] as [number, number, number]);
  });
  const [viewsCopyStatus, setViewsCopyStatus] = useState<'idle' | 'copied'>('idle');
  const viewsRef = useRef(views);
  const [viewport, setViewport] = useState<MandelbrotViewport>({
    center: [views[0][0], views[0][1]],
    zoom: views[0][2],
    rotation: 0,
  });
  const [, setFps] = useState<string>('0.0');
  const [dragging, setDragging] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [viewIndex, setViewIndex] = useState(0);
  const [overlayPositions, setOverlayPositions] = useState<
    Array<[number, number, number]>
  >(() => {
    try {
      const saved = localStorage.getItem(OVERLAY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === defaultOverlaySpecs.length)
          return parsed;
      }
    } catch {
      /* ignore */
    }
    return defaultOverlaySpecs.map(([pos]) => [...pos] as [number, number, number]);
  });
  const [overlayCopyStatus, setOverlayCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [editMode, setEditMode] = useState(false);

  const overlayData = useMemo(
    () =>
      overlayPositions.map((pos, i) => ({
        position: pos as [number, number, number],
        imageUrl: `${process.env.PUBLIC_URL}/inserts/${overlayFilenames[i]}`,
      })),
    [overlayPositions],
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRefs = useRef<Array<HTMLDivElement | null>>([]);
  const animationFrameRef = useRef<number | null>(null);
  const viewportRef = useRef<MandelbrotViewport>(viewport);
  const activePointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const overlayPositionsRef = useRef(overlayPositions);
  const overlayDragRef = useRef<{
    pointerId: number;
    index: number;
    type: 'move' | 'scale';
    startX: number;
    startY: number;
    startPos: [number, number, number];
  } | null>(null);

  const dpr = 1;

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    viewsRef.current = views;
    localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(views));
  }, [views]);

  useEffect(() => {
    overlayPositionsRef.current = overlayPositions;
    localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlayPositions));
  }, [overlayPositions]);

  const stopCameraAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCameraAnimation();
    };
  }, [stopCameraAnimation]);

  const animateToView = useCallback(
    (nextIndex: number) => {
      const currentViews = viewsRef.current;
      if (nextIndex < 0 || nextIndex >= currentViews.length) {
        return;
      }

      stopCameraAnimation();
      setViewIndex(nextIndex);

      const start = viewportRef.current;
      const [targetX, targetY, targetZoom] = currentViews[nextIndex];
      const target: MandelbrotViewport = {
        center: [targetX, targetY],
        zoom: targetZoom,
        rotation: start.rotation ?? 0,
      };

      const durationMs = 4000;
      const startTime = performance.now();
      const startZoom = Math.max(start.zoom, 1e-9);
      const endZoom = Math.max(target.zoom, 1e-9);
      const zoomingIn = endZoom > startZoom;

      const panStart = zoomingIn ? 0 : 0.3;
      const panEnd = zoomingIn ? 0.7 : 1;
      const zoomStart = zoomingIn ? 0.3 : 0;
      const zoomEnd = zoomingIn ? 1 : 0.7;

      const tick = (now: number) => {
        const t = Math.min((now - startTime) / durationMs, 1);
        const panProgress = easeInOutCubic(phasedProgress(t, panStart, panEnd));
        const zoomProgress = easeInOutCubic(phasedProgress(t, zoomStart, zoomEnd));
        const logZoom =
          Math.log(startZoom) + (Math.log(endZoom) - Math.log(startZoom)) * zoomProgress;

        const nextViewport: MandelbrotViewport = {
          center: [
            start.center[0] + (target.center[0] - start.center[0]) * panProgress,
            start.center[1] + (target.center[1] - start.center[1]) * panProgress,
          ],
          zoom: Math.exp(logZoom),
          rotation: start.rotation ?? 0,
        };

        setViewport(nextViewport);

        if (t < 1) {
          animationFrameRef.current = requestAnimationFrame(tick);
        } else {
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(tick);
    },
    [stopCameraAnimation],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        animateToView(viewIndex - 1);
      } else if (e.key === 'ArrowRight') {
        animateToView(viewIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [animateToView, viewIndex]);

  const updateOverlayPlacement = useCallback(
    (
      renderedViewport: MandelbrotViewport,
      canvasSize: { width: number; height: number },
    ) => {
      canvasSizeRef.current = canvasSize;
      if (canvasSize.width <= 0 || canvasSize.height <= 0) {
        return;
      }

      const theta = renderedViewport.rotation ?? 0;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const positions = overlayPositionsRef.current;

      positions.forEach(([centerX, centerY, fillWindowZoom], index) => {
        const overlay = overlayRefs.current[index];
        if (!overlay) {
          return;
        }

        if (fillWindowZoom <= 0) {
          return;
        }

        const deltaX = (centerX - renderedViewport.center[0]) * renderedViewport.zoom;
        const deltaY = (centerY - renderedViewport.center[1]) * renderedViewport.zoom;

        const pX = deltaX * cosT + deltaY * sinT;
        const pY = -deltaX * sinT + deltaY * cosT;

        const overlayCenterX = (pX * canvasSize.height + canvasSize.width) / 2;
        const overlayCenterY = (canvasSize.height - pY * canvasSize.height) / 2;
        const overlayWidthPx =
          (renderedViewport.zoom * canvasSize.height) / fillWindowZoom;

        overlay.style.left = `${overlayCenterX - overlayWidthPx / 2}px`;
        overlay.style.top = `${overlayCenterY}px`;
        overlay.style.width = `${overlayWidthPx}px`;
      });
    },
    [],
  );

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const drag = overlayDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const vp = viewportRef.current;
      const H = canvasSizeRef.current.height;
      if (H <= 0) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (drag.type === 'move') {
        const theta = vp.rotation ?? 0;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const s = (vp.zoom * H) / 2;
        const dcX = (dx * cosT + dy * sinT) / s;
        const dcY = (dx * sinT - dy * cosT) / s;
        setOverlayPositions((prev) => {
          const next = [...prev];
          next[drag.index] = [
            drag.startPos[0] + dcX,
            drag.startPos[1] + dcY,
            drag.startPos[2],
          ];
          return next;
        });
      } else {
        const scaleFactor = Math.pow(2, dx / 150);
        setOverlayPositions((prev) => {
          const next = [...prev];
          next[drag.index] = [
            drag.startPos[0],
            drag.startPos[1],
            Math.max(1, drag.startPos[2] / scaleFactor),
          ];
          return next;
        });
      }
    };

    const handleUp = (e: PointerEvent) => {
      const drag = overlayDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      overlayDragRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    updateOverlayPlacement(viewportRef.current, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    });
  }, [editMode, overlayPositions, updateOverlayPlacement]);

  const handleCopyCoordinates = useCallback(async () => {
    const triplet = `[${viewport.center[0].toPrecision(
      8,
    )},${viewport.center[1].toPrecision(8)},${viewport.zoom.toPrecision(6)}]`;

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable');
      }

      await navigator.clipboard.writeText(triplet);
      setCopyStatus('copied');
    } catch (error) {
      setCopyStatus('error');
    }

    window.setTimeout(() => {
      setCopyStatus('idle');
    }, 1200);
  }, [viewport]);

  const handleCopyOverlays = useCallback(async () => {
    const lines = overlayPositions.map((pos, i) => {
      const [x, y, z] = pos;
      return `  [[${x.toPrecision(8)}, ${y.toPrecision(8)}, ${z.toPrecision(6)}], '${
        overlayFilenames[i]
      }'],`;
    });
    const text = `const overlays: OverlaySpec[] = [\n${lines.join('\n')}\n];`;
    try {
      await navigator.clipboard.writeText(text);
      setOverlayCopyStatus('copied');
      setTimeout(() => setOverlayCopyStatus('idle'), 1200);
    } catch {
      /* ignore */
    }
  }, [overlayPositions]);

  const handleResetOverlays = useCallback(() => {
    setOverlayPositions(
      defaultOverlaySpecs.map(([pos]) => [...pos] as [number, number, number]),
    );
  }, []);

  const handleOverlayPointerDown = useCallback(
    (e: React.PointerEvent, index: number, type: 'move' | 'scale') => {
      e.stopPropagation();
      e.preventDefault();
      overlayDragRef.current = {
        pointerId: e.pointerId,
        index,
        type,
        startX: e.clientX,
        startY: e.clientY,
        startPos: [...overlayPositionsRef.current[index]] as [number, number, number],
      };
    },
    [],
  );

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#05070a',
      }}
    >
      <MandelbrotCanvas
        ref={canvasRef}
        viewport={viewport}
        maxIterations={256}
        antiAliasing={1}
        showCrosshair={false}
        palette={palette}
        paletteSpeed={paletteSpeed}
        devicePixelRatio={dpr}
        onFpsChange={setFps}
        onViewportRendered={editMode ? updateOverlayPlacement : undefined}
        overlays={overlayData}
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }

          stopCameraAnimation();

          activePointerIdRef.current = event.pointerId;
          lastPointerRef.current = { x: event.clientX, y: event.clientY };
          setDragging(true);
          canvasRef.current?.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (activePointerIdRef.current !== event.pointerId || !lastPointerRef.current) {
            return;
          }

          const canvas = canvasRef.current;
          if (!canvas) {
            return;
          }

          const rect = canvas.getBoundingClientRect();
          const scale = Math.max(rect.height, 1);

          const dx = event.clientX - lastPointerRef.current.x;
          const dy = event.clientY - lastPointerRef.current.y;

          lastPointerRef.current = { x: event.clientX, y: event.clientY };

          setViewport((current) => {
            const theta = current.rotation ?? 0;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);

            const dpX = (2 * dx) / scale;
            const dpY = (-2 * dy) / scale;

            const deltaX = (dpX * cosT - dpY * sinT) / current.zoom;
            const deltaY = (dpX * sinT + dpY * cosT) / current.zoom;

            return {
              ...current,
              center: [current.center[0] - deltaX, current.center[1] - deltaY],
            };
          });
        }}
        onPointerUp={(event) => {
          if (activePointerIdRef.current !== event.pointerId) {
            return;
          }

          activePointerIdRef.current = null;
          lastPointerRef.current = null;
          setDragging(false);
          canvasRef.current?.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (activePointerIdRef.current !== event.pointerId) {
            return;
          }

          activePointerIdRef.current = null;
          lastPointerRef.current = null;
          setDragging(false);
          canvasRef.current?.releasePointerCapture(event.pointerId);
        }}
        onWheel={(event) => {
          event.preventDefault();
          stopCameraAnimation();
          const factor = event.deltaY > 0 ? 0.97 : 1.03;
          setViewport((current) => ({
            ...current,
            zoom: Math.max(0.1, current.zoom * factor),
          }));
        }}
      />
      {editMode &&
        overlayFilenames.map((filename, index) => (
          <div
            key={`overlay-${index}`}
            ref={(node) => {
              overlayRefs.current[index] = node;
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: 'translateY(-50%)',
              width: 0,
              cursor: 'move',
            }}
            onPointerDown={(e) => handleOverlayPointerDown(e, index, 'move')}
          >
            <div
              style={{
                width: '100%',
                paddingBottom: '100%',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: -6,
                bottom: -6,
                width: 12,
                height: 12,
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(0,0,0,0.4)',
                borderRadius: 2,
                cursor: 'nwse-resize',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleOverlayPointerDown(e, index, 'scale');
              }}
            />
          </div>
        ))}
      {editMode ? (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            color: '#d8f1ff',
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(216, 241, 255, 0.3)',
            borderRadius: 8,
            padding: '6px 10px',
            fontFamily: 'monospace',
            fontSize: 12,
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>
            x: {viewport.center[0].toFixed(6)} | y: {viewport.center[1].toFixed(6)} |
            zoom: {viewport.zoom.toFixed(3)}
          </span>
          <button
            type="button"
            onClick={handleCopyCoordinates}
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#d8f1ff',
              background: 'rgba(216, 241, 255, 0.12)',
              border: '1px solid rgba(216, 241, 255, 0.35)',
              borderRadius: 5,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
          {copyStatus === 'copied' ? <span>copied</span> : null}
          {copyStatus === 'error' ? <span>copy failed</span> : null}
          <span style={{ margin: '0 4px', opacity: 0.3 }}>|</span>
          <label
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#d8f1ff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <input
              type="checkbox"
              checked={editMode}
              onChange={(e) => setEditMode(e.target.checked)}
            />
            Edit
          </label>
          <button
            type="button"
            onClick={handleCopyOverlays}
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#d8f1ff',
              background: 'rgba(216, 241, 255, 0.12)',
              border: '1px solid rgba(216, 241, 255, 0.35)',
              borderRadius: 5,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            Copy overlays
          </button>
          {overlayCopyStatus === 'copied' ? <span>copied</span> : null}
          <button
            type="button"
            onClick={handleResetOverlays}
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#d8f1ff',
              background: 'rgba(216, 241, 255, 0.12)',
              border: '1px solid rgba(216, 241, 255, 0.35)',
              borderRadius: 5,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            Reset overlays
          </button>
        </div>
      ) : (
        <label
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'rgba(216, 241, 255, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={editMode}
            onChange={(e) => setEditMode(e.target.checked)}
          />
          Edit
        </label>
      )}
      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          display: 'flex',
          flexDirection: editMode ? 'column' : 'row',
          gap: 4,
          maxHeight: editMode ? '60vh' : undefined,
          overflowY: editMode ? 'auto' : undefined,
        }}
      >
        {editMode ? (
          <>
            {views.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  type="button"
                  title="Move up"
                  disabled={i === 0}
                  onClick={() => {
                    setViews((prev) => {
                      const next = [...prev];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      return next;
                    });
                    if (viewIndex === i) setViewIndex(i - 1);
                    else if (viewIndex === i - 1) setViewIndex(i);
                  }}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: '#d8f1ff',
                    background: 'rgba(216, 241, 255, 0.12)',
                    border: '1px solid rgba(216, 241, 255, 0.35)',
                    borderRadius: 4,
                    padding: '3px 5px',
                    cursor: i === 0 ? 'not-allowed' : 'pointer',
                    opacity: i === 0 ? 0.3 : 1,
                  }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  title="Move down"
                  disabled={i === views.length - 1}
                  onClick={() => {
                    setViews((prev) => {
                      const next = [...prev];
                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                      return next;
                    });
                    if (viewIndex === i) setViewIndex(i + 1);
                    else if (viewIndex === i + 1) setViewIndex(i);
                  }}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: '#d8f1ff',
                    background: 'rgba(216, 241, 255, 0.12)',
                    border: '1px solid rgba(216, 241, 255, 0.35)',
                    borderRadius: 4,
                    padding: '3px 5px',
                    cursor: i === views.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: i === views.length - 1 ? 0.3 : 1,
                  }}
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => animateToView(i)}
                  style={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: i === viewIndex ? '#000' : '#d8f1ff',
                    background:
                      i === viewIndex
                        ? 'rgba(216, 241, 255, 0.8)'
                        : 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(216, 241, 255, 0.35)',
                    borderRadius: 4,
                    padding: '3px 6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {i + 1}: {v[0].toFixed(4)}, {v[1].toFixed(4)}, z{v[2].toFixed(1)}
                </button>
                <button
                  type="button"
                  title="Record current view"
                  onClick={() => {
                    setViews((prev) => {
                      const next = [...prev];
                      next[i] = [viewport.center[0], viewport.center[1], viewport.zoom];
                      return next;
                    });
                  }}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: '#d8f1ff',
                    background: 'rgba(216, 241, 255, 0.12)',
                    border: '1px solid rgba(216, 241, 255, 0.35)',
                    borderRadius: 4,
                    padding: '3px 5px',
                    cursor: 'pointer',
                  }}
                >
                  ●
                </button>
                <button
                  type="button"
                  title="Delete view"
                  onClick={() => {
                    setViews((prev) => {
                      if (prev.length <= 1) return prev;
                      const next = prev.filter((_, j) => j !== i);
                      return next;
                    });
                    if (viewIndex >= views.length - 1 && viewIndex > 0) {
                      setViewIndex(viewIndex - 1);
                    }
                  }}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: '#d8f1ff',
                    background: 'rgba(216, 241, 255, 0.12)',
                    border: '1px solid rgba(216, 241, 255, 0.35)',
                    borderRadius: 4,
                    padding: '3px 5px',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => {
                  setViews((prev) => [
                    ...prev,
                    [viewport.center[0], viewport.center[1], viewport.zoom],
                  ]);
                }}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: '#d8f1ff',
                  background: 'rgba(216, 241, 255, 0.12)',
                  border: '1px solid rgba(216, 241, 255, 0.35)',
                  borderRadius: 4,
                  padding: '3px 6px',
                  cursor: 'pointer',
                }}
              >
                + Add view
              </button>
              <button
                type="button"
                onClick={async () => {
                  const lines = views.map(
                    ([x, y, z]) =>
                      `  [${x.toPrecision(8)}, ${y.toPrecision(8)}, ${z.toPrecision(
                        6,
                      )}],`,
                  );
                  const text = `const cameraViews: Array<[number, number, number]> = [\n${lines.join(
                    '\n',
                  )}\n];`;
                  try {
                    await navigator.clipboard.writeText(text);
                    setViewsCopyStatus('copied');
                    setTimeout(() => setViewsCopyStatus('idle'), 1200);
                  } catch {
                    /* ignore */
                  }
                }}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: '#d8f1ff',
                  background: 'rgba(216, 241, 255, 0.12)',
                  border: '1px solid rgba(216, 241, 255, 0.35)',
                  borderRadius: 4,
                  padding: '3px 6px',
                  cursor: 'pointer',
                }}
              >
                Copy views
              </button>
              {viewsCopyStatus === 'copied' ? (
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: '#d8f1ff',
                    alignSelf: 'center',
                  }}
                >
                  copied
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => animateToView(viewIndex - 1)}
              disabled={viewIndex <= 0}
              style={{
                width: 34,
                height: 30,
                fontFamily: 'monospace',
                fontSize: 18,
                color: '#d8f1ff',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(216, 241, 255, 0.35)',
                borderRadius: 6,
                cursor: viewIndex <= 0 ? 'not-allowed' : 'pointer',
                opacity: viewIndex <= 0 ? 0.5 : 1,
              }}
            >
              {'<'}
            </button>
            <button
              type="button"
              onClick={() => animateToView(viewIndex + 1)}
              disabled={viewIndex >= views.length - 1}
              style={{
                width: 34,
                height: 30,
                fontFamily: 'monospace',
                fontSize: 18,
                color: '#d8f1ff',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(216, 241, 255, 0.35)',
                borderRadius: 6,
                cursor: viewIndex >= views.length - 1 ? 'not-allowed' : 'pointer',
                opacity: viewIndex >= views.length - 1 ? 0.5 : 1,
              }}
            >
              {'>'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
