/* eslint-disable react/prop-types */

import React, {
  CanvasHTMLAttributes,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import * as twgl from 'twgl.js';
import {
  createMandelbrotFragmentShader,
  fullscreenVertexArray,
  fullscreenVertexShader,
} from './shaders';

export type MandelbrotPoint = [number, number];
export type MandelbrotColour = [number, number, number];
export type MandelbrotPalette = MandelbrotColour[];

export interface MandelbrotViewport {
  center: MandelbrotPoint;
  zoom: number;
  rotation?: number;
}

export interface MandelbrotCanvasProps
  extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, 'color'> {
  viewport: MandelbrotViewport;
  maxIterations?: number;
  antiAliasing?: number;
  escapeRadius?: number;
  palette?: MandelbrotPalette;
  paletteSpeed?: number;
  showCrosshair?: boolean;
  devicePixelRatio?: number;
  onFpsChange?: (fps: string) => void;
  onViewportRendered?: (
    viewport: MandelbrotViewport,
    canvasSize: { width: number; height: number },
  ) => void;
}

interface ResizeObserverLike {
  disconnect: () => void;
  observe: (target: Element) => void;
}

function toShaderPalette(palette: MandelbrotPalette): number[] {
  const flat: number[] = [];
  for (const [r, g, b] of palette) {
    flat.push(r / 255, g / 255, b / 255);
  }
  return flat;
}

const defaultPalette: MandelbrotPalette = [
  [0, 7, 100],
  [32, 107, 203],
  [237, 255, 255],
  [255, 170, 0],
  [0, 2, 0],
  [0, 7, 100],
  [32, 107, 203],
  [237, 255, 255],
];

const MandelbrotCanvas = React.forwardRef<HTMLCanvasElement, MandelbrotCanvasProps>(
  (
    {
      viewport,
      maxIterations = 300,
      antiAliasing = 1,
      escapeRadius = 64,
      palette = defaultPalette,
      paletteSpeed = 0.05,
      showCrosshair = false,
      devicePixelRatio = window.devicePixelRatio || 1,
      onFpsChange,
      onViewportRendered,
      style,
      ...canvasProps
    },
    forwardedRef,
  ) => {
    const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const glRef = useRef<WebGLRenderingContext | null>(null);
    const bufferInfoRef = useRef<twgl.BufferInfo | null>(null);
    const programInfoRef = useRef<twgl.ProgramInfo | null>(null);
    const resizeObserverRef = useRef<ResizeObserverLike | null>(null);
    const fpsThenRef = useRef(0);
    const fpsFramesRef = useRef(0);
    const fpsElapsedRef = useRef(0);

    const setCanvasRef = useCallback(
      (node: HTMLCanvasElement | null) => {
        localCanvasRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const fragmentShader = createMandelbrotFragmentShader({
      maxIterations,
      antiAliasing,
      escapeRadius,
      showCrosshair,
      paletteSize: palette.length,
    });

    const renderFrame = useCallback(
      (timestamp?: number) => {
        const canvas = localCanvasRef.current;
        const gl = glRef.current;
        const programInfo = programInfoRef.current;
        const bufferInfo = bufferInfoRef.current;

        if (!canvas || !gl || !programInfo || !bufferInfo) {
          return;
        }

        twgl.resizeCanvasToDisplaySize(canvas, devicePixelRatio);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(programInfo.program);

        twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
        twgl.setUniforms(programInfo, {
          resolution: [canvas.width, canvas.height],
          u_xy: viewport.center,
          u_zoom: viewport.zoom,
          u_theta: viewport.rotation ?? 0,
          u_palette: toShaderPalette(palette),
          u_paletteSpeed: paletteSpeed,
        });
        twgl.drawBufferInfo(gl, bufferInfo);

        onViewportRendered?.(viewport, {
          width: canvas.clientWidth,
          height: canvas.clientHeight,
        });

        if (timestamp !== undefined && onFpsChange) {
          fpsFramesRef.current += 1;
          fpsElapsedRef.current += timestamp - fpsThenRef.current;
          fpsThenRef.current = timestamp;

          if (fpsElapsedRef.current >= 1000) {
            onFpsChange(
              (fpsFramesRef.current * (1000 / fpsElapsedRef.current)).toFixed(1),
            );
            fpsFramesRef.current = 0;
            fpsElapsedRef.current -= 1000;
          }
        }
      },
      [
        palette,
        paletteSpeed,
        devicePixelRatio,
        onFpsChange,
        onViewportRendered,
        viewport,
      ],
    );

    useLayoutEffect(() => {
      const canvas = localCanvasRef.current;
      if (!canvas) {
        return;
      }

      const gl = twgl.getContext(canvas, { antialias: false });
      if (!gl) {
        console.error('Unable to create a WebGL context for the Mandelbrot canvas.');
        return;
      }

      glRef.current = gl;

      const handleContextLost = (event: Event) => {
        event.preventDefault();
        console.error('Mandelbrot canvas WebGL context lost.');
      };

      const handleContextRestored = () => {
        glRef.current = twgl.getContext(canvas, { antialias: false });
      };

      canvas.addEventListener('webglcontextlost', handleContextLost, false);
      canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost, false);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored, false);
      };
    }, []);

    useLayoutEffect(() => {
      const gl = glRef.current;
      if (!gl) {
        return;
      }

      bufferInfoRef.current = twgl.createBufferInfoFromArrays(gl, fullscreenVertexArray);
      programInfoRef.current = twgl.createProgramInfo(gl, [
        fullscreenVertexShader,
        fragmentShader,
      ]);
      renderFrame();
    }, [fragmentShader, renderFrame]);

    useLayoutEffect(() => {
      renderFrame();
    }, [renderFrame]);

    useEffect(() => {
      const canvas = localCanvasRef.current;
      if (!canvas) {
        return;
      }

      const handleResize = () => {
        requestAnimationFrame((timestamp: number) => renderFrame(timestamp));
      };

      window.addEventListener('resize', handleResize);

      const ResizeObserverCtor = (
        window as Window & {
          ResizeObserver?: new (callback: () => void) => ResizeObserverLike;
        }
      ).ResizeObserver;

      if (ResizeObserverCtor) {
        resizeObserverRef.current = new ResizeObserverCtor(handleResize);
        resizeObserverRef.current.observe(canvas);
      }

      return () => {
        window.removeEventListener('resize', handleResize);
        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = null;
      };
    }, [renderFrame]);

    return (
      <canvas
        {...canvasProps}
        ref={setCanvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          ...style,
        }}
      />
    );
  },
);

MandelbrotCanvas.displayName = 'MandelbrotCanvas';

export default MandelbrotCanvas;
