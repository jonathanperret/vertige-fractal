import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MandelbrotCanvas,
  MandelbrotPalette,
  MandelbrotViewport,
} from './standalone/mandelbrot';

type OverlaySpec = [[number, number, number], string];

const overlays: OverlaySpec[] = [
  [[-0.7624408696724466, 0.15111695770871622, 58.14811982749229], '2.png'],
  [[-0.7790093316154937, 0.14259088021324595, 200], '3.png'],
  [[-0.7800631994335768, 0.13428712862079534, 3758.1557643680244], '4.png'],
];

const cameraViews: Array<[number, number, number]> = [
  [-1.1782685749698265, 0.1922475031674506, 178.7091852129108],
  [-0.7668512060286207, 0.15139570682153763, 46.87175976351492],
  [-0.7798865343424441, 0.14161080656031674, 158.38090710690577],
  [-0.7800631994335768, 0.13428712862079534, 3758.1557643680244],
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
  const [viewport, setViewport] = useState<MandelbrotViewport>({
    center: [cameraViews[0][0], cameraViews[0][1]],
    zoom: cameraViews[0][2],
    rotation: 0,
  });
  const [fps, setFps] = useState<string>('0.0');
  const [dragging, setDragging] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [viewIndex, setViewIndex] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRefs = useRef<Array<HTMLImageElement | null>>([]);
  const animationFrameRef = useRef<number | null>(null);
  const viewportRef = useRef<MandelbrotViewport>(viewport);
  const activePointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const dpr = 1;

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

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
      if (nextIndex < 0 || nextIndex >= cameraViews.length) {
        return;
      }

      stopCameraAnimation();
      setViewIndex(nextIndex);

      const start = viewportRef.current;
      const [targetX, targetY, targetZoom] = cameraViews[nextIndex];
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
      if (canvasSize.width <= 0 || canvasSize.height <= 0) {
        return;
      }

      const theta = renderedViewport.rotation ?? 0;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      overlays.forEach(([[centerX, centerY, fillWindowZoom], filename], index) => {
        const overlay = overlayRefs.current[index];
        if (!overlay) {
          return;
        }

        if (fillWindowZoom <= 0) {
          console.error(
            `Overlay ${filename} has invalid fillWindowZoom: ${fillWindowZoom}`,
          );
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

  const handleCopyCoordinates = useCallback(async () => {
    const triplet = `[${viewport.center[0]},${viewport.center[1]},${viewport.zoom}]`;

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
        onViewportRendered={updateOverlayPlacement}
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
          const factor = event.deltaY > 0 ? 0.9 : 1.1;
          setViewport((current) => ({
            ...current,
            zoom: Math.max(0.1, current.zoom * factor),
          }));
        }}
      />
      {overlays.map(([, filename], index) => (
        <img
          key={`${filename}-${index}`}
          ref={(node) => {
            overlayRefs.current[index] = node;
          }}
          src={`${process.env.PUBLIC_URL}/inserts/${filename}`}
          alt={`Overlay ${filename}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: 'translateY(-50%)',
            width: 0,
            height: 'auto',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      ))}
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
          x: {viewport.center[0].toFixed(6)} | y: {viewport.center[1].toFixed(6)} | zoom:{' '}
          {viewport.zoom.toFixed(3)}
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
      </div>
      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          display: 'flex',
          gap: 8,
        }}
      >
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
          disabled={viewIndex >= cameraViews.length - 1}
          style={{
            width: 34,
            height: 30,
            fontFamily: 'monospace',
            fontSize: 18,
            color: '#d8f1ff',
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(216, 241, 255, 0.35)',
            borderRadius: 6,
            cursor: viewIndex >= cameraViews.length - 1 ? 'not-allowed' : 'pointer',
            opacity: viewIndex >= cameraViews.length - 1 ? 0.5 : 1,
          }}
        >
          {'>'}
        </button>
      </div>
    </div>
  );
}

export default App;
