import { entryPose as getEntryPose, galleryPose as getGalleryPose, inspectPose as getInspectPose } from "./cameraRig.ts";
import { flightPosition, easeInOut, easeOut, clamp, lerp, printPath } from "./sequence.ts";
import { createRendering } from "./rendering.ts";
import { ACESFilmicToneMapping, Color, PCFShadowMap, PerspectiveCamera, Plane, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer } from "three";
import type { MomentItem } from "../../shared/moments.ts";
import { LAYOUT, TIMING, galleryPanBounds, galleryStartX, rubberBandPan, settlePanX } from "./galleryLayout.ts";
import { selectRenderQuality } from "./renderQuality.ts";
import { createCard, type GalleryCard } from "./gallery.ts";
import { SceneResources } from "./resources.ts";
import { loadWorld, createHeroHit, buildGalleryWall } from "./world.ts";
import { buildLights, buildEnvironment } from "./lighting.ts";

export type ScenePhase =
  | "loading"
  | "camera"
  | "printing"
  | "transition"
  | "gallery"
  | "inspect"
  | "returning";

type Callbacks = {
  onPhase?: (phase: ScenePhase) => void;
  onInspect?: (item: MomentItem | null) => void;
  onNearEnd?: () => void;
  onReady?: () => void;
  onError?: (message: string) => void;
};

export type MomentsSceneHandle = {
  pressShutter: () => void;
  travel: (direction: number) => void;
  returnToCamera: () => void;
  appendItems: (items: MomentItem[]) => void;
  closeInspect: () => void;
  setReducedMotion: (reduce: boolean) => void;
  dispose: () => void;
};

/**
 * One renderer and one scene own the entire experience. Two camera poses
 * share that world: a studio entry on the Instax, and a face-on wall.
 */
export async function createMomentsScene(
  canvas: HTMLCanvasElement,
  initialItems: MomentItem[],
  callbacks: Callbacks = {},
  signal?: AbortSignal,
): Promise<MomentsSceneHandle> {
  const quality = selectRenderQuality({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  });
  const renderer = new WebGLRenderer({
    canvas,
    antialias: quality.antialias,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  // r18x: PCFShadowMap is the soft PCF path (PCFSoftShadowMap was removed); softness via shadow.radius.
  renderer.shadowMap.type = PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.setClearColor("#f2ded5");

  const scene = new Scene();
  const resources = new SceneResources(scene);
  resources.track(renderer);
  try {
  if (signal?.aborted) throw new Error("Scene initialization cancelled");
  const abort = () => resources.dispose();
  signal?.addEventListener("abort", abort, {once:true});
  resources.track({dispose: () => signal?.removeEventListener("abort", abort)});
  scene.background = new Color("#c9e3eb");
  const viewCamera = new PerspectiveCamera(33, 1, 0.08, 80);
  const desiredPosition = new Vector3();
  const desiredTarget = new Vector3();
  const currentTarget = desiredTarget.clone();
  viewCamera.position.copy(desiredPosition);
  viewCamera.lookAt(currentTarget);


  const { cameraActor, markers } = await loadWorld(scene, resources);
  const galleryWall = buildGalleryWall(scene);
  const lights = buildLights(scene, quality.shadowMapSize);
  const environment = buildEnvironment(renderer, scene);
  resources.track(environment);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.6;
  const cards: GalleryCard[] = [];
  const heroHit = createHeroHit(cameraActor);
  scene.add(heroHit);

  let phase: ScenePhase = "loading";
  let sequenceStartedAt = 0;
  let targetGalleryX = galleryStartX();
  let inspected: GalleryCard | null = null;
  let beforeInspectX = galleryStartX();
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let disposed = false;
  let dragging = false;
  let dragged = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let previousPointerX = 0;
  let previousPointerY = 0;
  const inspectOffset = new Vector3();
  let inspectZoom = 1;
  const touches = new Map<number, Vector2>();
  let pinchDistance = 0;
  let enteredGalleryOnce = false;
  let pointer = new Vector2(99, 99);
  const raycaster = new Raycaster();
  const pointerNdc = new Vector2();
  const startCardPosition = new Vector3();
  const ejectedCardPosition = new Vector3();
  const ejectionClipPlane = new Plane(new Vector3(0, -1, 0), -1.18);
  let heroPrintScale = 0.53;
  const galleryFrom = new Vector3();
  const galleryFromTarget = new Vector3();

  addGalleryItems(initialItems);

  function entryPose(aspect: number) {
    return getEntryPose(markers, aspect);
  }

  function syncCameraStage() {
    cameraActor.updateMatrixWorld(true);
    const slot = markers.PrintSlot;
    const slotPosition = slot.getWorldPosition(new Vector3());
    const path = printPath(slotPosition, cameraActor.scale.x);
    heroPrintScale = path.scale;
    startCardPosition.copy(path.start);
    ejectedCardPosition.copy(path.end);
    ejectionClipPlane.copy(path.clip);
    heroHit.position.copy(cameraActor.position);
    heroHit.scale.copy(cameraActor.scale).multiplyScalar(1.12);
    if (!enteredGalleryOnce && (phase === "loading" || phase === "camera")) prepareHeroCard();
  }

  function addGalleryItems(items: MomentItem[]) {
    const startIndex = cards.length;
    items.forEach((item, offset) => {
      const card = createCard(
        item,
        startIndex + offset,
        scene,
        resources,
        quality.photoTextureWidth,
      );
      card.group.visible = true;
      cards.push(card);
      galleryWall.ensure(card.target.x);
    });
  }

  const {composer, bokehPass} = await createRendering(renderer, scene, viewCamera, quality, resources);

  function setPhase(next: ScenePhase) {
    if (phase === next) return;
    phase = next;
    callbacks.onPhase?.(next);
  }

  function galleryPose(x: number) { return getGalleryPose(x, viewCamera); }

  function printingPose(aspect: number) {
    const entry = entryPose(aspect);
    const portrait = aspect < 0.72;
    return {
      position: new Vector3(
        entry.position.x,
        entry.position.y + (portrait ? 0.12 : 0.18),
        entry.position.z + (portrait ? 0.4 : 0.9),
      ),
      target: entry.target.clone(),
    };
  }

  function inspectPose(card: GalleryCard) {
    const pose = getInspectPose(card.target, card.targetScale, viewCamera);
    pose.position.z = card.target.z + (pose.position.z - card.target.z) * inspectZoom;
    pose.position.add(inspectOffset); pose.target.add(inspectOffset);
    return pose;
  }

  function setCoverClipped(clipped: boolean) {
    const cover = cards[0];
    if (!cover) return;
    cover.visuals.forEach((mesh) => {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((material) => {
        material.clippingPlanes = clipped ? [ejectionClipPlane] : null;
        material.needsUpdate = true;
      });
    });
  }

  function restCards() {
    cards.forEach((card) => {
      card.group.visible = true;
      card.group.position.copy(card.target);
      card.group.rotation.set(0, 0, card.targetRotation);
      card.group.scale.setScalar(card.targetScale);
    });
  }

  function prepareHeroCard() {
    const cover = cards[0];

    if (!cover) return;
    setCoverClipped(true);
    cover.group.position.copy(startCardPosition);
    cover.group.rotation.set(-Math.PI / 2, 0, 0);
    cover.group.scale.setScalar(heroPrintScale);
    cover.group.visible = false;
    cover.setResident(true);
  }

  prepareHeroCard();

  function startSequence() {
    sequenceStartedAt = performance.now();
  }

  function sequenceElapsed() {
    return (performance.now() - sequenceStartedAt) / 1000;
  }

  function fadeCanvas(onHidden: () => void) {
    canvas.classList.add("is-fading");
    resources.timeout(() => {
      onHidden();
      resources.timeout(() => {
        canvas.classList.remove("is-fading");
      }, 30);
    }, TIMING.reducedFade * 1000);
  }

  function pressShutter() {
    if (phase !== "camera") return;
    cameraActor.visible = true;
    if (enteredGalleryOnce) {
      beginEnterGallery(true);
      return;
    }
    const cover = cards[0];
    if (cover) cover.group.visible = true;
    startSequence();
    setPhase("printing");
    if (reducedMotion) {
      fadeCanvas(() => finishEnterGallery());
    }
  }

  function beginEnterGallery(short: boolean) {
    dragging = false;
    setCoverClipped(false);
    if (short) restCards();
    else {
      cards.slice(1).forEach((card) => {
        card.group.visible = true;
        card.group.position.copy(card.target);
        card.group.rotation.set(0, 0, card.targetRotation);
        card.group.scale.setScalar(card.targetScale);
      });
    }
    targetGalleryX = settlePanX(targetGalleryX, galleryMinX(), galleryLimitX());
    const from = viewCamera.position.clone();
    const fromTarget = currentTarget.clone();
    galleryFrom.copy(from);
    galleryFromTarget.copy(fromTarget);
    startSequence();
    setPhase("transition");
    if (reducedMotion) {
      fadeCanvas(() => finishEnterGallery());
    }
  }

  function finishEnterGallery() {
    setCoverClipped(false);
    restCards();
    const pose = galleryPose(targetGalleryX);
    viewCamera.position.copy(pose.position);
    currentTarget.copy(pose.target);
    desiredPosition.copy(pose.position);
    desiredTarget.copy(pose.target);
    viewCamera.lookAt(currentTarget);

    heroHit.visible = false;
    enteredGalleryOnce = true;
    setPhase("gallery");
  }

  function beginReturnToCamera() {
    if (phase !== "gallery") return;
    dragging = false;
    inspected = null;
    callbacks.onInspect?.(null);
    cameraActor.visible = true;
    heroHit.visible = true;
    galleryFrom.copy(viewCamera.position);
    galleryFromTarget.copy(currentTarget);
    startSequence();
    setPhase("returning");
    if (reducedMotion) {
      fadeCanvas(() => finishReturnToCamera());
    }
  }

  function finishReturnToCamera() {
    const entry = entryPose(viewCamera.aspect);

    cameraActor.visible = true;
    heroHit.visible = true;
    viewCamera.position.copy(entry.position);
    currentTarget.copy(entry.target);
    desiredPosition.copy(entry.position);
    desiredTarget.copy(entry.target);
    viewCamera.lookAt(currentTarget);
    targetGalleryX = galleryStartX();
    setPhase("camera");
  }

  function galleryBounds() {
    const pose = galleryPose(targetGalleryX);
    const halfWidth = Math.tan(viewCamera.fov * Math.PI / 360) * (pose.position.z - LAYOUT.wallZ) * viewCamera.aspect;
    return galleryPanBounds(cards.map(c => ({x:c.target.x, scale:c.targetScale, rotation:c.targetRotation})), halfWidth);
  }
  function galleryMinX() { return galleryBounds().min; }
  function galleryLimitX() { return galleryBounds().max; }

  function applyPan(delta: number) {
    if (phase !== "gallery") return;
    targetGalleryX = rubberBandPan(
      targetGalleryX,
      delta,
      galleryMinX(),
      galleryLimitX(),
    );
    requestMoreIfNeeded();
  }

  function travel(direction: number) {
    applyPan(direction * 1.8);
  }

  function requestMoreIfNeeded() {
    if (targetGalleryX > galleryLimitX() - 3.2) callbacks.onNearEnd?.();
  }

  function closeInspect() {
    if (phase !== "inspect") return;
    inspected = null;
    targetGalleryX = beforeInspectX;
    callbacks.onInspect?.(null);
    setPhase("gallery");
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === "touch" && phase === "inspect") {
      touches.set(event.pointerId, new Vector2(event.clientX, event.clientY));
      if (touches.size === 2) {
        const [a,b] = [...touches.values()]; pinchDistance = a.distanceTo(b);
        dragged = true; canvas.setPointerCapture(event.pointerId); return;
      }
    }
    if (phase === "gallery" || phase === "inspect") {
      dragging = true;
      dragged = false;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
      previousPointerX = event.clientX;
      previousPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (phase === "camera") {
      updateRaycaster(event);
      if (raycaster.intersectObject(heroHit, false).length) {
        pressShutter();
      }
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, new Vector2(event.clientX, event.clientY));
      if (touches.size === 2 && phase === "inspect") {
        const [a,b] = [...touches.values()]; const distance = a.distanceTo(b);
        if (distance > 0 && pinchDistance > 0) inspectZoom = clamp(inspectZoom * pinchDistance / distance, .45, 2.2);
        pinchDistance = distance; dragged = true; return;
      }
    }
    if (dragging && (phase === "gallery" || phase === "inspect")) {
      const dx = event.clientX - previousPointerX;
      if (Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > 7) {
        dragged = true;
      }
      const width = 2 * Math.tan(viewCamera.fov * Math.PI / 360) * (viewCamera.position.z - LAYOUT.wallZ) * viewCamera.aspect;
      if (phase === "inspect" && inspected) {
        inspectOffset.x -= dx * width / canvas.clientWidth;
        inspectOffset.y += (event.clientY - previousPointerY) * width / canvas.clientWidth;
        inspectOffset.x = clamp(inspectOffset.x, cards[0].target.x - inspected.target.x - 1, Math.max(...cards.map(c => c.target.x)) - inspected.target.x + 1);
        inspectOffset.y = clamp(inspectOffset.y, -2.5 - inspected.target.y, 4.5 - inspected.target.y);
        if (inspected.target.x + inspectOffset.x > galleryLimitX() - 3.2) callbacks.onNearEnd?.();
      } else applyPan(-dx * width / canvas.clientWidth);
      previousPointerX = event.clientX;
      previousPointerY = event.clientY;
      canvas.style.cursor = "grabbing";
      return;
    }
    if (phase === "inspect" || phase === "transition" || phase === "returning" || phase === "printing") {
      canvas.style.cursor = "default";
      return;
    }
    updateRaycaster(event);
    if (phase === "camera") {
      canvas.style.cursor = raycaster.intersectObject(heroHit, false).length
        ? "pointer"
        : "default";
    } else if (phase === "gallery") {
      canvas.style.cursor = pickCard() ? "pointer" : "grab";
    }
  }

  function onPointerUp(event: PointerEvent) {
    touches.delete(event.pointerId);
    if (pinchDistance > 0) {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!touches.size) { pinchDistance = 0; dragging = false; }
      else { const remaining = [...touches.values()][0]; previousPointerX = remaining.x; previousPointerY = remaining.y; }
      return;
    }
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (dragging && (phase === "gallery" || phase === "inspect")) {
      if (!dragged && event.type !== "pointercancel") {
        updateRaycaster(event);
        const card = pickCard();
        if (card) {
          if (phase === "inspect" && card === inspected) { closeInspect(); dragging = false; return; }
          if (phase === "gallery") beforeInspectX = targetGalleryX;
          inspectOffset.set(0, 0, 0); inspectZoom = 1;
          inspected = card;
          targetGalleryX = card.target.x;
          callbacks.onInspect?.(card.item);
          setPhase("inspect");
        }
      } else {
        targetGalleryX = settlePanX(targetGalleryX, galleryMinX(), galleryLimitX());
      }
    }
    dragging = false;
    if (phase === "gallery") canvas.style.cursor = "grab";
  }

  function onWheel(event: WheelEvent) {
    if (phase !== "gallery" && phase !== "inspect") return;
    event.preventDefault();
    if (phase === "inspect") {
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
      inspectZoom = clamp(inspectZoom * Math.exp(clamp(delta * .002, -.3, .3)), .45, 2.2);
      return;
    }
    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    const pixels = delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    applyPan(clamp(pixels * 0.006, -0.6, 0.6));
  }

  function updateRaycaster(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer = new Vector2(event.clientX - rect.left, event.clientY - rect.top);
    pointerNdc.set(
      (pointer.x / rect.width) * 2 - 1,
      -(pointer.y / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointerNdc, viewCamera);
  }

  function pickCard(): GalleryCard | null {
    const meshes = cards
      .filter((card) => card.group.visible)
      .map((card) => card.hit);
    const [hit] = raycaster.intersectObjects(meshes, false);
    if (!hit) return null;
    return cards.find((card) => card.hit === hit.object) ?? null;
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    viewCamera.aspect = width / height;

    viewCamera.fov = viewCamera.aspect < 0.72 ? 46 : 33;
    viewCamera.updateProjectionMatrix();
    syncCameraStage();
    targetGalleryX = settlePanX(targetGalleryX, galleryMinX(), galleryLimitX());
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  resources.track({dispose: () => {
    resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    canvas.classList.remove("is-fading");
  }});
  resize();

  let lastFrame = performance.now();
  let frameHandle = 0;
  resources.track({dispose: () => window.cancelAnimationFrame(frameHandle)});

  function animate(now: number) {
    if (disposed || !resources.active) return;
    frameHandle = window.requestAnimationFrame(animate);
    const rawDelta = (now - lastFrame) / 1000;
    lastFrame = now;
    const delta = Math.min(0.05, rawDelta);

    galleryWall.update(viewCamera.position.x);
    for (const card of cards) {
      const hero = card === cards[0] && !enteredGalleryOnce && (phase === "printing" || phase === "transition");
      const near = Math.abs(card.target.x - viewCamera.position.x) < 14;
      card.setResident(near || hero || (phase === "camera" && card === cards[0]));
      if (!hero) card.group.visible = near && !(phase === "camera" && card === cards[0] && !enteredGalleryOnce);
      const gap =
        Math.abs(card.group.position.z - card.target.z) +
        Math.abs(card.group.position.x - card.target.x) * 0.2;
      card.contact.material.opacity = 0.55 * clamp(1 - gap / 0.3, 0, 1);
    }

    if (phase === "printing") {
      const sequenceTime = sequenceElapsed();
      const cover = cards[0];
      if (cover) {
        const progress = easeOut(clamp((sequenceTime - 0.08) / 0.78, 0, 1));
        cover.group.position.lerpVectors(startCardPosition, ejectedCardPosition, progress);
        cover.group.rotation.x = -Math.PI / 2;
        cover.group.rotation.z = Math.sin(progress * Math.PI * 2) * 0.018;
        cover.group.scale.setScalar(heroPrintScale);
      }
      lights.flash.intensity = Math.max(0, 80 - Math.max(0, sequenceTime - 0.04) * 300);
      if (sequenceTime >= TIMING.print) beginEnterGallery(false);
    } else if (phase === "transition") {
      const sequenceTime = sequenceElapsed();
      const duration = enteredGalleryOnce ? TIMING.shortDolly : TIMING.firstDolly;
      const progress = easeInOut(clamp(sequenceTime / duration, 0, 1));
      const pose = galleryPose(targetGalleryX);
      viewCamera.position.lerpVectors(galleryFrom, pose.position, progress);
      currentTarget.lerpVectors(galleryFromTarget, pose.target, progress);
      viewCamera.lookAt(currentTarget);
      const cover = cards[0];
      if (cover && !enteredGalleryOnce) {
        // Clear the desk and toys before turning the paper upright.
        cover.group.position.copy(flightPosition(ejectedCardPosition, cover.target, progress));
        const turn = easeInOut(clamp((progress - .3) / .45, 0, 1));
        cover.group.rotation.set(-Math.PI / 2 * (1 - turn), 0, cover.targetRotation * turn);
        cover.group.scale.setScalar(lerp(heroPrintScale, cover.targetScale, turn));
      }
      if (progress >= 1) finishEnterGallery();
    } else if (phase === "returning") {
      const sequenceTime = sequenceElapsed();
      const progress = easeInOut(clamp(sequenceTime / TIMING.returnDolly, 0, 1));
      const entry = entryPose(viewCamera.aspect);
      viewCamera.position.lerpVectors(galleryFrom, entry.position, progress);
      currentTarget.lerpVectors(galleryFromTarget, entry.target, progress);
      viewCamera.lookAt(currentTarget);
      if (progress >= 1) finishReturnToCamera();
    } else {
      lights.flash.intensity = Math.max(0, lights.flash.intensity - delta * 160);
    }

    if (phase === "camera") {
      const entry = entryPose(viewCamera.aspect);
      desiredPosition.copy(entry.position);
      desiredTarget.copy(entry.target);
      viewCamera.position.copy(entry.position);
      currentTarget.copy(entry.target);
      viewCamera.lookAt(currentTarget);

    } else if (phase === "gallery") {
      const pose = galleryPose(targetGalleryX);
      desiredPosition.copy(pose.position);
      desiredTarget.copy(pose.target);
    } else if (phase === "printing") {
      const pose = printingPose(viewCamera.aspect);
      desiredPosition.copy(pose.position);
      desiredTarget.copy(pose.target);
    } else if (phase === "inspect" && inspected) {
      const pose = inspectPose(inspected);
      desiredPosition.copy(pose.position);
      desiredTarget.copy(pose.target);
    }

    if (phase === "gallery" || phase === "inspect" || phase === "printing") {
      const smooth = 1 - Math.exp(-delta * 4.8);
      viewCamera.position.lerp(desiredPosition, smooth);
      currentTarget.lerp(desiredTarget, smooth);
      viewCamera.lookAt(currentTarget);
    }

    if (bokehPass) {
      const uniforms = bokehPass.materialBokeh.uniforms;
      if (uniforms.focus) {
        uniforms.focus.value = viewCamera.position.distanceTo(currentTarget);
      }
    }

    if (composer) composer.render(delta);
    else renderer.render(scene, viewCamera);
  }

  setPhase("camera");
  frameHandle = window.requestAnimationFrame(animate);
  callbacks.onReady?.();

  return {
    pressShutter,
    travel,
    returnToCamera: beginReturnToCamera,
    appendItems: addGalleryItems,
    closeInspect,
    setReducedMotion(value) {
      reducedMotion = value;
    },
    dispose() {
      disposed = true;
      resources.dispose();
    },
  };
  } catch (error) { resources.dispose(); throw error; }
}

