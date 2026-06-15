import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MandelbrotCanvas,
  MandelbrotPalette,
  MandelbrotViewport,
} from './mandelbrot';

type OverlaySpec = [[number, number, number], string];

const defaultOverlaySpecs: OverlaySpec[] = [
  [[-1.3528733, 0.057807705, 1953.93], '1.png'],
  [[-1.3597766, 0.082378469, 199.039], '2.png'],
  [[-1.1951548, 0.17481587, 525.371], '3.png'],
  [[-1.3502136, 0.058715242, 8432.69], '4.png'],
  [[-1.2160771, 0.17822955, 305.677], '5.png'],
  [[-1.0087396, 0.29914395, 228.858], '6.png'],
  [[-1.4556332, 0.047241741, 40.1455], '7.png'],
  [[-1.4086795, 0.082097293, 50.2761], '8.png'],
  [[-1.2965443, 0.12559795, 54.3054], '9.png'],
  [[-1.0644267, 0.25784406, 1325.98], '10.png'],
  [[-1.2189299, 0.27860774, 51.7380], '11.png'],
  [[-0.73081244, 0.42576754, 28.9621], '12.png'],
  [[-0.54220128, 0.63156436, 759.941], '13.png'],
  [[-0.53746271, 0.62938440, 378.586], '14.png'],
  [[-1.1265718, 0.27578018, 443.604], '15.png'],
  [[-1.1324724, 0.28028005, 411.328], '16.png'],
  [[-0.93509808, 0.33410513, 39.9445], '17.png'],
  [[-1.1103976, 0.25856603, 2168.10], '18.png'],
  [[-1.0717933, 0.24886579, 575.252], '19.png'],
  [[-1.0865335, 0.32350321, 38.0815], '20.png'],
  [[-1.2469597, 0.35514611, 146.644], '21.png'],
  [[-0.57758682, 0.60303350, 84.7343], '22.png'],
  [[-1.1985007, 0.18620254, 543.249], '23.png'],
  [[-1.2401825, 0.39916494, 103.228], '24.png'],
  [[-1.1786069, 0.19607417, 329.253], '25.png'],
  [[-1.2762708, 0.43338798, 108.801], '26.png'],
  [[-1.1051335, 0.25481832, 739.575], '27.png'],
  [[-1.3564189, 0.060228197, 1038.82], '28.png'],
  [[-1.3549644, 0.059818134, 2330.73], '29.png'],
  [[-0.96022875, 0.28749406, 81.4735], '30.png'],
  [[-0.56219421, 0.64281258, 27874.7], '31.png'],
  [[0, 0, 2], '40.png'],
  [[0, 0, 2], '41.png'],
  [[0, 0, 2], '42.png'],
  [[0, 0, 2], '43.png'],
  [[0, 0, 2], '44.png'],
  [[0, 0, 2], '45.png'],
  [[0, 0, 2], '46.png'],
  [[0, 0, 2], '47.png'],
  [[0, 0, 2], '48.png'],
];
const overlayFilenames = defaultOverlaySpecs.map(([, f]) => f);
const OVERLAY_STORAGE_KEY = 'mandelbrot-overlay-positions';

const VIEWS_STORAGE_KEY = 'mandelbrot-camera-views';

const defaultCameraViews: Array<[number, number, number]> = [
  [-0.73200879, -0.015404773, 1.03516],
  [-1.2002044, 0.27835788, 26.8811],
  [-1.0733398, 0.30608545, 17.7957],
  [-0.94732535, 0.30936247, 19.8392],
  [-1.2699831, 0.12991583, 19.7285],
  [-1.1957417, 0.18558522, 238.679],
  [-1.1718046, 0.19719716, 158.012],
  [-1.4235644, 0.052297648, 15.9474],
  [-1.3597666, 0.077724613, 91.4390],
  [-1.3556432, 0.060098560, 549.828],
  [-1.3503901, 0.058643490, 3432.90],
  [-1.3525320, 0.057618788, 871.706],
  [-1.2191236, 0.17659274, 107.801],
  [-1.1939609, 0.17302685, 257.984],
  [-1.2424533, 0.40146476, 61.8456],
  [-1.2580382, 0.35500811, 52.0431],
  [-1.2791999, 0.43133761, 55.8654],
  [-1.1299581, 0.27808294, 164.914],
  [-1.1096345, 0.25858793, 1007.61],
  [-1.1054407, 0.25407931, 370.984],
  [-1.0687911, 0.24732117, 226.679],
  [-1.0642892, 0.25788679, 515.897],
  [-1.0056986, 0.29867234, 103.045],
  [-0.68285041, 0.44135104, 17.4680],
  [-0.57393496, 0.60299808, 60.7226],
  [-0.54029424, 0.62998407, 210.424],
  [-0.56220195, 0.64281669, 14455.6],
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

function App(): React.JSX.Element {
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
        imageUrl: `${import.meta.env.BASE_URL}inserts/${overlayFilenames[i]}`,
      })),
    [overlayPositions],
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRefs = useRef<Array<HTMLDivElement | null>>([]);
  const overlayAlphaRef = useRef<
    Map<string, { data: Uint8ClampedArray; width: number; height: number }>
  >(new Map());
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

  useEffect(() => {
    overlayFilenames.forEach((filename) => {
      const url = `${import.meta.env.BASE_URL}inserts/${filename}`;
      if (overlayAlphaRef.current.has(url)) return;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, c.width, c.height);
        overlayAlphaRef.current.set(url, {
          data: imageData.data,
          width: c.width,
          height: c.height,
        });
      };
      img.src = url;
    });
  }, []);

  const isOpaqueAt = useCallback(
    (clientX: number, clientY: number, index: number): boolean => {
      const overlay = overlayRefs.current[index];
      if (!overlay) return false;
      const rect = overlay.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;
      const url = `${import.meta.env.BASE_URL}inserts/${overlayFilenames[index]}`;
      const alpha = overlayAlphaRef.current.get(url);
      if (alpha && relX >= 0 && relX < 1 && relY >= 0 && relY < 1) {
        const px = Math.floor(relX * alpha.width);
        const py = Math.floor(relY * alpha.height);
        return alpha.data[(py * alpha.width + px) * 4 + 3] >= 10;
      }
      return false;
    },
    [],
  );

  const hitTestOverlays = useCallback(
    (clientX: number, clientY: number): number => {
      for (let i = overlayFilenames.length - 1; i >= 0; i--) {
        if (isOpaqueAt(clientX, clientY, i)) return i;
      }
      return -1;
    },
    [isOpaqueAt],
  );

  const handleScalePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    overlayDragRef.current = {
      pointerId: e.pointerId,
      index,
      type: 'scale',
      startX: e.clientX,
      startY: e.clientY,
      startPos: [...overlayPositionsRef.current[index]] as [number, number, number],
    };
  }, []);

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
        antiAliasing={2}
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

          if (editMode) {
            const hit = hitTestOverlays(event.clientX, event.clientY);
            if (hit >= 0) {
              event.stopPropagation();
              event.preventDefault();
              overlayDragRef.current = {
                pointerId: event.pointerId,
                index: hit,
                type: 'move',
                startX: event.clientX,
                startY: event.clientY,
                startPos: [...overlayPositionsRef.current[hit]] as [
                  number,
                  number,
                  number,
                ],
              };
              return;
            }
          }

          activePointerIdRef.current = event.pointerId;
          lastPointerRef.current = { x: event.clientX, y: event.clientY };
          setDragging(true);
          canvasRef.current?.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (editMode && !activePointerIdRef.current) {
            const canvas = canvasRef.current;
            if (canvas) {
              const hit = hitTestOverlays(event.clientX, event.clientY);
              canvas.style.cursor = hit >= 0 ? 'move' : dragging ? 'grabbing' : 'grab';
            }
          }

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
        overlayFilenames.map((_, index) => (
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
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '100%',
                paddingBottom: '100%',
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
                pointerEvents: 'auto',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleScalePointerDown(e, index);
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
      ) : null}
      <label
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          fontFamily: 'monospace',
          fontSize: 11,
          color: editMode ? '#d8f1ff' : 'rgba(216, 241, 255, 0.4)',
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
              <button
                type="button"
                onClick={() => {
                  setViews(
                    defaultCameraViews.map(
                      (v) => [...v] as [number, number, number],
                    ),
                  );
                  setViewIndex(0);
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
                Reset views
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
