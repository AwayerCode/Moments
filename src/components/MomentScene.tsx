import { useEffect, useRef, useState } from "react";
import {
  claimInviteFromLocation,
  fetchMomentsPage,
  type MomentItem,
} from "../lib/api.ts";
import type {
  MomentsSceneHandle,
  ScenePhase,
} from "../three/moments/createMomentsScene.ts";

const DEMO_ITEMS: MomentItem[] = [
  { id: "m1", caption: "2025.09.15 · 1岁9个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "lilac", pin: "top" },
  { id: "m2", caption: "2025.03.02 · 1岁3个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "mint", pin: "top" },
  { id: "m3", caption: "2024.11.20 · 0岁11个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "sky", pin: "top" },
  { id: "m4", caption: "2025.01.18 · 1岁1个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "peach", pin: "top" },
  { id: "m5", caption: "2024.08.04 · 0岁8个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "mint", pin: "top" },
  { id: "m6", caption: "2025.07.22 · 1岁7个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "sky", pin: "top" },
  { id: "m7", caption: "2025.06.08 · 1岁6个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "peach", pin: "top" },
  { id: "m8", caption: "2024.12.01 · 1岁0个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "lilac", pin: "top" },
  { id: "m9", caption: "2025.04.30 · 1岁4个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "butter", pin: "top" },
  { id: "m10", caption: "2025.10.12 · 1岁10个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "sky", pin: "top" },
  { id: "m11", caption: "2024.09.09 · 0岁9个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "mint", pin: "top" },
  { id: "m12", caption: "2025.02.14 · 1岁2个月", x: 0, y: 0, width: 1, height: 1, rotate: 0, palette: "mint", pin: "top" },
];

export function MomentScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MomentsSceneHandle | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  const [phase, setPhase] = useState<ScenePhase>("loading");
  const [inspected, setInspected] = useState<MomentItem | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let scene: MomentsSceneHandle | null = null;

    void (async () => {
      try {
        await claimInviteFromLocation();
      } catch {
        // A public preview remains available when private access is unavailable.
      }

      let items = DEMO_ITEMS;
      try {
        const page = await fetchMomentsPage();
        if (page.items.length) items = page.items;
        nextCursorRef.current = page.nextCursor;
      } catch {
        // The WebGL scene can still demonstrate its motion with local artwork.
      }
      if (cancelled) return;

      async function loadMore() {
        const cursor = nextCursorRef.current;
        if (!cursor || loadingMoreRef.current || !sceneRef.current) return;
        loadingMoreRef.current = true;
        try {
          const page = await fetchMomentsPage(cursor);
          if (cancelled) return;
          nextCursorRef.current = page.nextCursor;
          if (page.items.length) sceneRef.current?.appendItems(page.items);
        } catch {
          // Keep the current wall usable when the next page is unavailable.
        } finally {
          loadingMoreRef.current = false;
        }
      }

      try {
        const { createMomentsScene } = await import(
          "../three/moments/createMomentsScene.ts"
        );
        scene = await createMomentsScene(canvas, items, {
          onPhase: setPhase,
          onInspect: setInspected,
          onNearEnd: () => void loadMore(),
          onError: setNotice,
        });
      } catch {
        if (!cancelled) {
          setNotice("3D 场景暂时无法打开，请检查浏览器 WebGL 支持后重试");
        }
        return;
      }
      if (cancelled) {
        scene.dispose();
        return;
      }
      sceneRef.current = scene;
    })();

    return () => {
      cancelled = true;
      nextCursorRef.current = null;
      loadingMoreRef.current = false;
      sceneRef.current = null;
      scene?.dispose();
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const setMotionPreference = () => {
      sceneRef.current?.setReducedMotion(media.matches);
    };
    media.addEventListener("change", setMotionPreference);
    return () => media.removeEventListener("change", setMotionPreference);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        sceneRef.current?.closeInspect();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        sceneRef.current?.travel(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        sceneRef.current?.travel(1);
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        sceneRef.current?.pressShutter();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="moments-scene" data-phase={phase}>
      <canvas
        ref={canvasRef}
        className="moments-canvas"
        aria-label="Sisi Moments 三维记忆展廊"
        tabIndex={0}
      />

      {phase === "loading" ? (
        <div className="scene-loading" role="status">
          <span>正在打开记忆展廊</span>
          <i aria-hidden />
        </div>
      ) : null}

      {phase === "camera" ? (
        <div className="scene-intro" aria-live="polite">
          <button
            type="button"
            className="shutter-control"
            onClick={() => sceneRef.current?.pressShutter()}
            aria-label="按下快门，打印第一张照片"
          >
            <span aria-hidden />
            轻按快门
          </button>
          <p>第一张照片会带你走进 Moments</p>
        </div>
      ) : null}

      {phase === "printing" ? (
        <div className="scene-process" role="status">
          <span />
          正在显影
        </div>
      ) : null}

      {phase === "gallery" ? (
        <div className="gallery-hint" aria-live="polite">
          <button type="button" onClick={() => sceneRef.current?.travel(-1)} aria-label="向左边看">
            ‹
          </button>
          <p>左右拖动看展 · 滑过左缘回到相机</p>
          <button type="button" onClick={() => sceneRef.current?.travel(1)} aria-label="向右边看">
            ›
          </button>
        </div>
      ) : null}

      {phase === "inspect" && inspected ? (
        <div className="inspect-caption" aria-live="polite">
          <p>{inspected.caption}</p>
          <button type="button" onClick={() => sceneRef.current?.closeInspect()}>
            返回展廊
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="scene-notice" role="alert">
          {notice}
        </div>
      ) : null}
    </main>
  );
}
