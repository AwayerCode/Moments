import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";

export type FrameLoop = (delta: number, elapsed: number) => void;

export type WebGLHost = {
  renderer: WebGLRenderer;
  resize: () => { width: number; height: number };
  start: (loop: FrameLoop) => void;
  dispose: () => void;
};

/** Shared WebGL host so the fridge wall can later mount the same renderer path. */
export function mountWebGL(
  canvas: HTMLCanvasElement,
  options?: { alpha?: boolean },
): WebGLHost {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: options?.alpha ?? true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  let frame = 0;
  let last = performance.now();
  let running: FrameLoop | null = null;

  function resize() {
    const parent = canvas.parentElement ?? canvas;
    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    renderer.setSize(width, height, false);
    return { width, height };
  }

  function start(loop: FrameLoop) {
    running = loop;
    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      running?.(delta, now / 1000);
    };
    frame = window.requestAnimationFrame(tick);
  }

  function dispose() {
    window.cancelAnimationFrame(frame);
    running = null;
    renderer.dispose();
  }

  resize();
  return { renderer, resize, start, dispose };
}

export function easeOutBack(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const c1 = 1.15;
  const c3 = c1 + 1;
  return 1 + c3 * (clamped - 1) ** 3 + c1 * (clamped - 1) ** 2;
}
