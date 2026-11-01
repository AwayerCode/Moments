import { useEffect, useRef, useState } from "react";
import {
  claimInviteFromLocation,
  fetchMomentsPage,
  type MomentItem,
} from "../lib/api.ts";
import { shouldHandleSceneShortcut } from "../lib/sceneKeyboard.ts";
import type {
  MomentsSceneHandle,
  ScenePhase,
} from "../scene/createScene.ts";

import { PLACEHOLDER_MOMENTS as DEMO_ITEMS } from "../../shared/demoMoments.ts";

export function MomentScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MomentsSceneHandle | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  const [phase, setPhase] = useState<ScenePhase>("loading");

  const [notice, setNotice] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const controller = new AbortController();
    let scene: MomentsSceneHandle | null = null;

    void (async () => {
      try {
        await claimInviteFromLocation();
      } catch {
        // A public preview remains available when private access is unavailable.
      }

      let items: MomentItem[] = [];
      try {
        let cursor: string | undefined;
        do {
          const page = await fetchMomentsPage(cursor);
          items = page.items;
          cursor = page.nextCursor ?? undefined;
          nextCursorRef.current = page.nextCursor;
        } while (!cancelled && !items.length && cursor);
      } catch (error) {
        if (error instanceof Error && error.message === "unauthorized") items = DEMO_ITEMS;
        else if (!cancelled) setNotice("照片暂时无法加载，请刷新重试");
      }
      if (cancelled) return;

      async function loadMore() {
        const cursor = nextCursorRef.current;
        if (!cursor || loadingMoreRef.current || !sceneRef.current) return;
        loadingMoreRef.current = true;
        try {
          let next: string | undefined = cursor;
          do {
            const page = await fetchMomentsPage(next);
            if (cancelled) return;
            nextCursorRef.current = page.nextCursor;
            next = page.nextCursor ?? undefined;
            if (page.items.length) { sceneRef.current?.appendItems(page.items); break; }
          } while (next);
        } catch {
          // Keep the current wall usable when the next page is unavailable.
        } finally {
          loadingMoreRef.current = false;
        }
      }

      try {
        const { createMomentsScene } = await import(
          "../scene/createScene.ts"
        );
        scene = await createMomentsScene(canvas, items, {
          onPhase: (phase) => { if (!cancelled) setPhase(phase); },

          onNearEnd: () => void loadMore(),
          onError: (message) => { if (!cancelled) setNotice(message); },
        }, controller.signal);
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
      controller.abort();
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
        if (phase === "gallery") sceneRef.current?.returnToCamera();
        else sceneRef.current?.closeInspect();
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
      if (
        (event.key === " " || event.key === "Enter") &&
        shouldHandleSceneShortcut(event.target)
      ) {
        event.preventDefault();
        sceneRef.current?.pressShutter();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase]);

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
            aria-label="轻按快门，走进 Moments"
          >
            <span aria-hidden />
            轻按快门，走进 Moments
          </button>
        </div>
      ) : null}

      {phase === "printing" ? (
        <div className="scene-process" role="status">
          <span />
          正在显影
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
