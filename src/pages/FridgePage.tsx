import { useEffect, useRef, useState, type PointerEvent } from "react";
import { BokehPhoto } from "../components/BokehPhoto.tsx";
import { Polaroid } from "../components/Polaroid.tsx";
import { fetchMoments, fetchSession, type MomentItem } from "../lib/api.ts";
import type { FridgeViewState } from "../three/fridge/types.ts";
// 3D upgrade path: createFridgeScene() in src/three/fridge/createFridgeScene.ts

const WALL_WIDTH = 720;
const WALL_HEIGHT = 1200;
const MIN_SCALE = 0.18;
const MAX_SCALE = 2.6;

type Camera = FridgeViewState;

export function FridgePage() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    camX: number;
    camY: number;
    moved: boolean;
  } | null>(null);
  const skipClick = useRef(false);
  const camRef = useRef<Camera>({ x: 0, y: 0, scale: 0.78 });

  const [cam, setCam] = useState<Camera>(camRef.current);
  const [items, setItems] = useState<MomentItem[]>([]);
  const [expanded, setExpanded] = useState<MomentItem | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ok = await fetchSession();
        if (cancelled) return;
        if (!ok) {
          window.location.replace("/");
          return;
        }
        const next = await fetchMoments();
        if (!cancelled) {
          setItems(next);
          setReady(true);
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(true);
        if (error instanceof Error && error.message === "unauthorized") {
          window.location.replace("/");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !ready) {
      return;
    }
    const fit = () => {
    const rect = viewport.getBoundingClientRect();
    const scale = clamp(
      Math.min(rect.width / (WALL_WIDTH + 24), rect.height / (WALL_HEIGHT + 100)) * 0.98,
      MIN_SCALE,
      MAX_SCALE,
    );
    commitCam({
      scale,
      x: (rect.width - WALL_WIDTH * scale) / 2,
      y: Math.max(8, (rect.height - (WALL_HEIGHT + 80) * scale) / 2),
    });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const onNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.92 : 1.08;
      zoomAt(event.clientX, event.clientY, camRef.current.scale * factor);
    };
    viewport.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onNativeWheel);
  }, []);

  function commitCam(next: Camera) {
    camRef.current = next;
    setCam(next);
  }

  function zoomAt(clientX: number, clientY: number, nextScale: number) {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const current = camRef.current;
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const worldX = (localX - current.x) / current.scale;
    const worldY = (localY - current.y) / current.scale;
    commitCam({
      scale,
      x: localX - worldX * scale,
      y: localY - worldY * scale,
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (expanded) {
      return;
    }
    if (event.button !== 0) return;
    if (pointers.current.size === 0) skipClick.current = false;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 1) {
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        camX: camRef.current.x,
        camY: camRef.current.y,
        moved: false,
      };
    }
    if (pointers.current.size === 2) {
      skipClick.current = true;
      for (const id of pointers.current.keys()) event.currentTarget.setPointerCapture(id);
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: camRef.current.scale,
      };
      drag.current = null;
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) {
      return;
    }
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const midpointX = (a.x + b.x) / 2;
      const midpointY = (a.y + b.y) / 2;
      const ratio = distance / Math.max(pinchStart.current.distance, 1);
      zoomAt(midpointX, midpointY, pinchStart.current.scale * ratio);
      return;
    }

    if (drag.current) {
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (Math.hypot(dx, dy) > 8) {
        drag.current.moved = true;
        skipClick.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      if (!drag.current.moved) return;
      commitCam({
        ...camRef.current,
        x: drag.current.camX + dx,
        y: drag.current.camY + dy,
      });
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinchStart.current = null;
    }
    if (pointers.current.size === 1) {
      const [remaining] = pointers.current.values();
      drag.current = { ...remaining, camX: camRef.current.x, camY: camRef.current.y, moved: true };
    }
    if (pointers.current.size === 0) {
      if (drag.current?.moved) {
        skipClick.current = true;
      }
      drag.current = null;
    }
  }

  function onSelect(item: MomentItem) {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    setExpanded(item);
  }

  return (
    <main className="fridge-page">
      {!ready && <div className="gallery-status" role="status">
        {loadError ? <>相册加载失败，请重试。<button onClick={() => { setLoadError(false); setAttempt(value => value + 1); }}>重试</button></> : "正在加载相册…"}
      </div>}
      <div
        ref={viewportRef}
        className="fridge-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="fridge-world"
          style={{
            transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`,
          }}
        >
          <div
            className="fridge-door"
            style={{ width: WALL_WIDTH, height: WALL_HEIGHT }}
          >
            <span className="fridge-handle" />
            <h1 className="fridge-title">Moments</h1>
            {ready
              ? items.map((item) => (
                  <Polaroid key={item.id} item={item} onSelect={onSelect} />
                ))
              : null}
          </div>
        </div>
      </div>

      {expanded ? (
        <div
          className="expand-layer"
          role="dialog"
          aria-modal="true"
          aria-label={expanded.caption}
          onClick={() => setExpanded(null)}
        >
          <figure
            className="expanded-polaroid"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="magnet" />
            <BokehPhoto palette={expanded.palette} />
            <figcaption>{expanded.caption}</figcaption>
          </figure>
        </div>
      ) : null}
    </main>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
