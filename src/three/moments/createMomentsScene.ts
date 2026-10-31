import {
  ACESFilmicToneMapping,
  HalfFloatType,
  TextureLoader,
  WebGLRenderTarget,
  Material,
  BoxGeometry,
  CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
} from "three";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import type { MomentItem } from "../../lib/api.ts";
import {
  LAYOUT,
  TIMING,
  cardSlot,
  galleryMaxX as maxGalleryX,
  galleryStartX,
  rubberBandPan,
  settlePanX,
  shouldReturnToCamera,
} from "./galleryLayout.ts";

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
  appendItems: (items: MomentItem[]) => void;
  closeInspect: () => void;
  setReducedMotion: (reduce: boolean) => void;
  dispose: () => void;
};

type GalleryCard = {
  item: MomentItem;
  group: Group;
  hit: Mesh;
  target: Vector3;
  targetScale: number;
  contact: Mesh<PlaneGeometry, MeshBasicMaterial>;
  targetRotation: number;
  texture?: Texture;
};

const COLORS = {
  ink: "#5c4e4b",
  paper: "#fffaf0",
};

const easeInOut = (value: number) =>
  value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;
const easeOut = (value: number) => 1 - (1 - value) ** 3;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const ENTRY_POSITION = new Vector3(0, 0.36, 6.55);
const ENTRY_TARGET = new Vector3(0, -0.16, 0);
const CAMERA_REST = new Vector3(-0.05, -0.32, 0);

/**
 * One renderer and one scene own the entire experience. Two camera poses
 * share that world: a studio entry on the Instax, and a face-on wall.
 */
export async function createMomentsScene(
  canvas: HTMLCanvasElement,
  initialItems: MomentItem[],
  callbacks: Callbacks = {},
): Promise<MomentsSceneHandle> {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  // ACES at ~0.94 (was 0.86) with brighter, neutral lights: clean pastels, no grey cast.
  // (AgX was tried; it desaturated the pink camera and pastel prints too much.)
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.shadowMap.enabled = true;
  // r18x: PCFShadowMap is the soft PCF path (PCFSoftShadowMap was removed); softness via shadow.radius.
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setClearColor("#f4ebe3");

  const scene = new Scene();
  const studioBackground = createStudioBackground();
  scene.background = studioBackground;
  const viewCamera = new PerspectiveCamera(33, 1, 0.08, 80);
  const desiredPosition = ENTRY_POSITION.clone();
  const desiredTarget = ENTRY_TARGET.clone();
  const currentTarget = desiredTarget.clone();
  viewCamera.position.copy(desiredPosition);
  viewCamera.lookAt(currentTarget);

  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.06);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.8;
  room.dispose();
  pmrem.dispose();

  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const grain = loadRoomTexture("/textures/grain_normal.jpg", false, 6, 6, maxAnisotropy);
  const wallTexture: RoomMaps = {
    map: loadRoomTexture("/textures/plaster_albedo.jpg", true, 10, 2.2, maxAnisotropy),
    normalMap: loadRoomTexture("/textures/plaster_normal.jpg", false, 10, 2.2, maxAnisotropy),
    roughnessMap: loadRoomTexture("/textures/plaster_rough.jpg", false, 10, 2.2, maxAnisotropy),
  };
  const loadedTextures = new Set<Texture>();
  const cards: GalleryCard[] = [];

  const galleryRoot = buildGalleryWall(scene, wallTexture);
  galleryRoot.visible = false;
  const lights = buildLights(scene);
  const cameraActor = await buildCamera(scene, grain, callbacks.onError);
  const heroHit = createHeroHit(cameraActor);
  scene.add(heroHit);

  let phase: ScenePhase = "loading";
  let sequenceStartedAt = 0;
  let targetGalleryX = galleryStartX();
  let inspected: GalleryCard | null = null;
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let disposed = false;
  let dragging = false;
  let dragged = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let previousPointerX = 0;
  let enteredGalleryOnce = false;
  let pointer = new Vector2(99, 99);
  const raycaster = new Raycaster();
  const pointerNdc = new Vector2();
  const startCardPosition = new Vector3(0, -0.32, 0.4);
  const ejectedCardPosition = new Vector3(0, -1.48, 0.86);
  const cameraFacing = new Vector2();
  const galleryFrom = new Vector3();
  const galleryFromTarget = new Vector3();

  addGalleryItems(initialItems);

  function addGalleryItems(items: MomentItem[]) {
    const startIndex = cards.length;
    items.forEach((item, offset) => {
      const card = createCard(item, startIndex + offset, scene, loadedTextures);
      card.group.visible = phase === "gallery" || phase === "inspect" || phase === "transition";
      cards.push(card);
    });
  }

  const renderPass = new RenderPass(scene, viewCamera);
  // Multisampled HDR target: the composer bypasses the canvas' own MSAA.
  const composerTarget = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, composerTarget);
  composer.addPass(renderPass);
  if (window.innerWidth >= 760) {
    const aoPass = new GTAOPass(scene, viewCamera, 512, 512);
    aoPass.output = GTAOPass.OUTPUT.Default;
    aoPass.blendIntensity = 0.85;
    aoPass.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.4, thickness: 1, scale: 1 });
    aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    // Keep invisible hit planes / soft decals out of the AO depth-normal prepass,
    // otherwise their rectangles show up as AO outlines on the wall.
    const ao = aoPass as unknown as {
      _overrideVisibility: () => void;
      _restoreVisibility: () => void;
    };
    const hiddenForAo: Mesh[] = [];
    const baseOverride = ao._overrideVisibility.bind(aoPass);
    const baseRestore = ao._restoreVisibility.bind(aoPass);
    ao._overrideVisibility = () => {
      baseOverride();
      scene.traverse((object) => {
        if (!(object instanceof Mesh) || !object.visible) return;
        const material = object.material as Material;
        if (material.transparent && !material.depthWrite) {
          object.visible = false;
          hiddenForAo.push(object);
        }
      });
    };
    ao._restoreVisibility = () => {
      baseRestore();
      hiddenForAo.forEach((object) => (object.visible = true));
      hiddenForAo.length = 0;
    };
    composer.addPass(aoPass);
  }
  let bokehPass: BokehPass | null = null;
  if (window.innerWidth >= 760) {
    bokehPass = new BokehPass(scene, viewCamera, {
      focus: 6.8,
      aperture: 0.000055,
      maxblur: 0.004,
    });
    composer.addPass(bokehPass);
  }
  composer.addPass(new OutputPass());
  // SMAA after tone mapping cleans edges MSAA misses (alpha-tested text, AO/bokeh output).
  composer.addPass(new SMAAPass());

  function setPhase(next: ScenePhase) {
    if (phase === next) return;
    phase = next;
    callbacks.onPhase?.(next);
  }

  function galleryPose(x: number) {
    const mobile = viewCamera.aspect < 0.72;
    const y = mobile ? 0.52 : 0.7;
    const z = mobile ? 8.4 : 7.15;
    return {
      position: new Vector3(x, y, z),
      target: new Vector3(x, y - 0.06, LAYOUT.wallZ),
    };
  }

  function inspectPose(card: GalleryCard) {
    return {
      position: new Vector3(card.target.x, card.target.y, card.target.z + 2.38),
      target: card.target.clone(),
    };
  }

  function setCardsVisible(visible: boolean) {
    cards.forEach((card) => {
      card.group.visible = visible;
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
    setCardsVisible(false);
    if (!cover) return;
    cover.group.position.copy(startCardPosition);
    cover.group.rotation.set(0, 0, 0);
    cover.group.scale.setScalar(0.94);
    cover.group.visible = false;
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
    window.setTimeout(() => {
      onHidden();
      window.setTimeout(() => {
        canvas.classList.remove("is-fading");
      }, 30);
    }, TIMING.reducedFade * 1000);
  }

  function pressShutter() {
    if (phase !== "camera") return;
    cameraActor.visible = true;
    cameraActor.position.copy(CAMERA_REST);
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
    galleryRoot.visible = true;
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
    restCards();
    const pose = galleryPose(targetGalleryX);
    viewCamera.position.copy(pose.position);
    currentTarget.copy(pose.target);
    desiredPosition.copy(pose.position);
    desiredTarget.copy(pose.target);
    viewCamera.lookAt(currentTarget);
    cameraActor.visible = false;
    heroHit.visible = false;
    galleryRoot.visible = true;
    enteredGalleryOnce = true;
    setPhase("gallery");
  }

  function beginReturnToCamera() {
    if (phase !== "gallery") return;
    dragging = false;
    inspected = null;
    callbacks.onInspect?.(null);
    cameraActor.visible = true;
    cameraActor.position.copy(CAMERA_REST);
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
    galleryRoot.visible = false;
    setCardsVisible(false);
    cameraActor.visible = true;
    heroHit.visible = true;
    cameraActor.position.copy(CAMERA_REST);
    viewCamera.position.copy(ENTRY_POSITION);
    currentTarget.copy(ENTRY_TARGET);
    desiredPosition.copy(ENTRY_POSITION);
    desiredTarget.copy(ENTRY_TARGET);
    viewCamera.lookAt(currentTarget);
    targetGalleryX = galleryStartX();
    setPhase("camera");
  }

  function galleryMinX() {
    return galleryStartX();
  }

  function galleryLimitX() {
    const last = cards[cards.length - 1];
    return last ? maxGalleryX(last.target.x) : galleryStartX();
  }

  function applyPan(delta: number, commitReturn: boolean) {
    if (phase !== "gallery") return;
    targetGalleryX = rubberBandPan(
      targetGalleryX,
      delta,
      galleryMinX(),
      galleryLimitX(),
    );
    requestMoreIfNeeded();
    if (commitReturn && shouldReturnToCamera(targetGalleryX, galleryMinX())) {
      beginReturnToCamera();
    }
  }

  function travel(direction: number) {
    applyPan(direction * 1.8, true);
  }

  function requestMoreIfNeeded() {
    if (targetGalleryX > galleryLimitX() - 3.2) callbacks.onNearEnd?.();
  }

  function closeInspect() {
    if (phase !== "inspect") return;
    inspected = null;
    callbacks.onInspect?.(null);
    setPhase("gallery");
  }

  function onPointerDown(event: PointerEvent) {
    if (phase === "gallery") {
      dragging = true;
      dragged = false;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
      previousPointerX = event.clientX;
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
    if (dragging && phase === "gallery") {
      const dx = event.clientX - previousPointerX;
      if (Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > 7) {
        dragged = true;
      }
      applyPan(-dx * 0.012, false);
      previousPointerX = event.clientX;
      canvas.style.cursor = "grabbing";
      return;
    }
    if (phase === "inspect" || phase === "transition" || phase === "returning" || phase === "printing") {
      canvas.style.cursor = "default";
      return;
    }
    updateRaycaster(event);
    if (phase === "camera") {
      const rect = canvas.getBoundingClientRect();
      cameraFacing.set(
        ((event.clientX - rect.left) / rect.width - 0.5) * 2,
        ((event.clientY - rect.top) / rect.height - 0.5) * 2,
      );
      canvas.style.cursor = raycaster.intersectObject(heroHit, false).length
        ? "pointer"
        : "default";
    } else if (phase === "gallery") {
      canvas.style.cursor = pickCard() ? "pointer" : "grab";
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (dragging && phase === "gallery") {
      if (!dragged) {
        updateRaycaster(event);
        const card = pickCard();
        if (card) {
          inspected = card;
          targetGalleryX = card.target.x;
          callbacks.onInspect?.(card.item);
          setPhase("inspect");
        }
      } else if (shouldReturnToCamera(targetGalleryX, galleryMinX())) {
        beginReturnToCamera();
      } else {
        targetGalleryX = settlePanX(targetGalleryX, galleryMinX(), galleryLimitX());
      }
    }
    dragging = false;
    if (phase === "gallery") canvas.style.cursor = "grab";
  }

  function onWheel(event: WheelEvent) {
    if (phase !== "gallery") return;
    event.preventDefault();
    applyPan(Math.sign(event.deltaY) * 1.35, true);
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
    composer.setSize(width, height);
    viewCamera.aspect = width / height;
    viewCamera.fov = viewCamera.aspect < 0.72 ? 42 : 33;
    viewCamera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  resize();

  let lastFrame = performance.now();
  let frameHandle = 0;

  function animate(now: number) {
    if (disposed) return;
    frameHandle = window.requestAnimationFrame(animate);
    const rawDelta = (now - lastFrame) / 1000;
    lastFrame = now;
    const delta = Math.min(0.05, rawDelta);
    const time = now / 1000;

    lights.followX(viewCamera.position.x);
    for (const card of cards) {
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
        cover.group.rotation.y = -0.07 * (1 - progress);
        cover.group.rotation.z = Math.sin(progress * Math.PI * 2) * 0.018;
        cover.group.scale.setScalar(0.94 + progress * 0.06);
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
        cover.group.position.lerpVectors(ejectedCardPosition, cover.target, progress);
        cover.group.position.y += Math.sin(progress * Math.PI) * 0.28;
        cover.group.rotation.z =
          Math.sin(progress * Math.PI) * -0.06 + cover.targetRotation * easeOut(progress);
        cover.group.rotation.y = -0.07 * (1 - easeOut(progress));
        cover.group.scale.setScalar(1 + (cover.targetScale - 1) * easeOut(progress));
      }
      cameraActor.position.x = CAMERA_REST.x - 2.4 * easeInOut(progress);
      if (progress > 0.42) {
        cameraActor.visible = false;
        heroHit.visible = false;
      }
      if (progress >= 1) finishEnterGallery();
    } else if (phase === "returning") {
      const sequenceTime = sequenceElapsed();
      const progress = easeInOut(clamp(sequenceTime / TIMING.returnDolly, 0, 1));
      viewCamera.position.lerpVectors(galleryFrom, ENTRY_POSITION, progress);
      currentTarget.lerpVectors(galleryFromTarget, ENTRY_TARGET, progress);
      viewCamera.lookAt(currentTarget);
      cameraActor.position.lerpVectors(
        new Vector3(CAMERA_REST.x - 1.1, CAMERA_REST.y, CAMERA_REST.z),
        CAMERA_REST,
        easeOut(progress),
      );
      if (progress > 0.7) {
        galleryRoot.visible = false;
        setCardsVisible(false);
      }
      if (progress >= 1) finishReturnToCamera();
    } else {
      lights.flash.intensity = Math.max(0, lights.flash.intensity - delta * 160);
    }

    if (phase === "camera") {
      desiredPosition.copy(ENTRY_POSITION);
      desiredTarget.copy(ENTRY_TARGET);
      const cameraBreath = Math.sin(time * 0.72) * 0.008;
      cameraActor.position.set(
        CAMERA_REST.x + cameraFacing.x * 0.035,
        CAMERA_REST.y + cameraFacing.y * -0.018 + cameraBreath,
        CAMERA_REST.z,
      );
      cameraActor.rotation.set(
        -0.012 + cameraFacing.y * 0.012,
        -0.07 + cameraFacing.x * 0.035,
        -0.01,
      );
    } else if (phase === "gallery") {
      const pose = galleryPose(targetGalleryX);
      desiredPosition.copy(pose.position);
      desiredTarget.copy(pose.target);
    } else if (phase === "inspect" && inspected) {
      const pose = inspectPose(inspected);
      desiredPosition.copy(pose.position);
      desiredTarget.copy(pose.target);
    }

    if (phase === "gallery" || phase === "inspect") {
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

    composer.render(delta);
  }

  setPhase("camera");
  frameHandle = window.requestAnimationFrame(animate);
  callbacks.onReady?.();

  return {
    pressShutter,
    travel,
    appendItems: addGalleryItems,
    closeInspect,
    setReducedMotion(value) {
      reducedMotion = value;
    },
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(frameHandle);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      cards.forEach((card) => {
        card.group.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        });
      });
      loadedTextures.forEach((texture) => texture.dispose());
      grain.dispose();
      Object.values(wallTexture).forEach((texture) => texture.dispose());
      studioBackground.dispose();
      composerTarget.dispose();
      environment.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}

async function buildCamera(
  scene: Scene,
  grain: Texture,
  onError?: (message: string) => void,
) {
  try {
    const gltf = await new GLTFLoader().loadAsync("/models/sisi-camera.glb");
    const model = gltf.scene;
    const group = new Group();
    group.position.copy(CAMERA_REST);
    group.rotation.set(-0.012, -0.07, -0.01);
    group.scale.setScalar(0.94);
    group.add(model);
    scene.add(group);

    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      // GLTFLoader yields MeshStandardMaterial; upgrade lacquered/glass parts so clearcoat applies.
      const upgraded = (Array.isArray(object.material) ? object.material : [object.material]).map(
        (material: Material) =>
          material instanceof MeshStandardMaterial &&
          !(material instanceof MeshPhysicalMaterial) &&
          /Shell|housing|grip|Glass|optic|Flash/i.test(material.name)
            ? toPhysical(material)
            : material,
      );
      object.material = Array.isArray(object.material) ? upgraded : upgraded[0];
      const materials = upgraded;
      for (const material of materials) {
        if (material instanceof MeshStandardMaterial) {
          if (/Shell|housing|grip|strap/i.test(material.name)) {
            material.normalMap = grain;
            material.normalScale.set(0.12, 0.12);
            material.roughness = Math.max(0.31, material.roughness);
            if (material instanceof MeshPhysicalMaterial) {
              material.clearcoat = /Shell|housing|grip/i.test(material.name)
                ? 0.42
                : 0.12;
              material.clearcoatRoughness = 0.26;
            }
          }
          if (/Glass|optic/i.test(material.name)) {
            material.envMapIntensity = 1.7;
            material.roughness = Math.min(0.11, material.roughness);
            if (material instanceof MeshPhysicalMaterial) {
              material.clearcoat = 1;
              material.clearcoatRoughness = 0.035;
            }
          }
          if (/Metal|nickel/i.test(material.name)) {
            material.envMapIntensity = 1.4;
            material.roughness = Math.min(0.2, material.roughness);
          }
          if (/Flash/i.test(material.name)) {
            material.color.offsetHSL(0, -0.05, 0.18);
            material.emissive.set("#fff4df");
            material.emissiveIntensity = 0.18;
            material.envMapIntensity = 1.2;
          }
          material.needsUpdate = true;
        }
      }
    });

    const contactShadow = new Mesh(
      new PlaneGeometry(2.6, 1.15),
      new MeshBasicMaterial({
        map: createContactShadowTexture(),
        color: "#55483f",
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0.04, -1.38, 0.18);
    group.add(contactShadow);

    return group;
  } catch (error) {
    onError?.("相机模型加载失败，请刷新重试");
    throw error;
  }
}

function createHeroHit(cameraActor: Group) {
  const hit = new Mesh(
    new BoxGeometry(3.5, 3.7, 1.55),
    new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  hit.position.copy(cameraActor.position);
  hit.position.z = 0.15;
  return hit;
}

type RoomMaps = { map: Texture; normalMap: Texture; roughnessMap: Texture };

function loadRoomTexture(
  url: string,
  color: boolean,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
) {
  const texture = new TextureLoader().load(url);
  // Only albedo is sRGB; normal/roughness stay linear data.
  if (color) texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = anisotropy;
  return texture;
}

function toPhysical(source: MeshStandardMaterial) {
  const physical = new MeshPhysicalMaterial();
  MeshStandardMaterial.prototype.copy.call(physical, source);
  physical.defines = { STANDARD: "", PHYSICAL: "" };
  source.dispose();
  return physical;
}

function createStudioBackground() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#f7f1ea");
    gradient.addColorStop(0.46, "#f3e6dc");
    gradient.addColorStop(1, "#e7d2c8");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  return texture;
}

function buildGalleryWall(scene: Scene, wallTexture: RoomMaps) {
  const root = new Group();
  scene.add(root);
  const wall = new Mesh(
    new PlaneGeometry(80, 16),
    new MeshStandardMaterial({
      color: "#ebe0d6",
      ...wallTexture,
      roughness: 1,
      normalScale: new Vector2(0.12, 0.12),
    }),
  );
  wall.position.set(18, 2.05, LAYOUT.wallZ);
  wall.receiveShadow = true;
  root.add(wall);
  return root;
}

function buildLights(scene: Scene) {
  const hemi = new HemisphereLight("#fffaf4", "#d9c7b8", 0.7);
  scene.add(hemi);

  const daylight = new DirectionalLight("#fff6ea", 2.45);
  daylight.position.set(-3.4, 5.4, 6.2);
  daylight.target.position.set(0.35, -0.35, -0.4);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  daylight.shadow.bias = -0.00012;
  daylight.shadow.normalBias = 0.024;
  daylight.shadow.radius = 3;
  daylight.shadow.blurSamples = 16;
  daylight.shadow.camera.left = -6;
  daylight.shadow.camera.right = 6;
  daylight.shadow.camera.top = 5;
  daylight.shadow.camera.bottom = -4.5;
  daylight.shadow.camera.near = 1;
  daylight.shadow.camera.far = 20;
  scene.add(daylight, daylight.target);

  const fill = new DirectionalLight("#ffe9d8", 0.42);
  fill.position.set(3.6, 2.4, 4.8);
  scene.add(fill);

  const wallWash = new SpotLight("#fff1ea", 4.2, 32, Math.PI / 4, 0.92, 1.2);
  wallWash.position.set(2.4, 6.6, 6.4);
  wallWash.target.position.set(2.4, 0.55, LAYOUT.wallZ);
  scene.add(wallWash, wallWash.target);

  const flash = new SpotLight("#fff7e6", 0, 9, Math.PI / 3, 1, 1.3);
  flash.position.set(0, 0.4, 2.2);
  flash.target.position.set(0, -0.8, 0.4);
  scene.add(flash, flash.target);

  const daylightBase = daylight.position.clone();
  const daylightTargetBase = daylight.target.position.clone();
  const washBase = wallWash.position.clone();
  const washTargetBase = wallWash.target.position.clone();
  const fillBase = fill.position.clone();
  function followX(x: number) {
    const offset = Math.max(0, x);
    daylight.position.set(daylightBase.x + offset, daylightBase.y, daylightBase.z);
    daylight.target.position.set(
      daylightTargetBase.x + offset,
      daylightTargetBase.y,
      daylightTargetBase.z,
    );
    wallWash.position.set(washBase.x + offset, washBase.y, washBase.z);
    wallWash.target.position.set(
      washTargetBase.x + offset,
      washTargetBase.y,
      washTargetBase.z,
    );
    fill.position.set(fillBase.x + offset, fillBase.y, fillBase.z);
  }

  return { wallWash, flash, followX };
}

function createCard(
  item: MomentItem,
  index: number,
  scene: Scene,
  loadedTextures: Set<Texture>,
): GalleryCard {
  const group = new Group();
  const slot = cardSlot(index);
  const target = new Vector3(slot.x, slot.y, slot.z);
  const targetRotation = slot.rotation;
  const targetScale = slot.scale;
  group.position.copy(target);
  group.rotation.z = targetRotation;
  group.scale.setScalar(targetScale);
  scene.add(group);

  const paper = new Mesh(
    new RoundedBoxGeometry(1.36, 1.84, 0.045, 3, 0.025),
    new MeshStandardMaterial({
      color: COLORS.paper,
      roughness: 0.74,
      metalness: 0,
    }),
  );
  paper.castShadow = true;
  paper.receiveShadow = true;
  group.add(paper);

  const photoTexture = createPhotoTexture(item);
  // Lit, paper-like print so room lights and shadows land on it.
  const photoMaterial = new MeshStandardMaterial({
    map: photoTexture,
    // ~80% albedo like a real print, so a well-lit wall doesn't wash it out.
    color: "#d6d0cb",
    roughness: 0.6,
    metalness: 0,
  });
  const photo = new Mesh(new PlaneGeometry(1.16, 1.5), photoMaterial);
  photo.position.set(0, 0.07, 0.027);
  photo.receiveShadow = true;
  group.add(photo);

  if (item.src) {
    void loadScaledPhotoTexture(item.src)
      .then((texture) => {
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = 4;
        loadedTextures.add(texture);
        photoMaterial.map = texture;
        photoMaterial.needsUpdate = true;
        photoTexture.dispose();
      })
      .catch(() => {
        // The designed placeholder stays visible if a private image fails.
      });
  }

  const captionTexture = createCaptionTexture(item.caption);
  const caption = new Mesh(
    new PlaneGeometry(1.12, 0.22),
    new MeshStandardMaterial({
      map: captionTexture,
      transparent: true,
      alphaTest: 0.02,
      roughness: 0.85,
      metalness: 0,
    }),
  );
  caption.position.set(0, -0.72, 0.03);
  caption.receiveShadow = true;
  group.add(caption);

  const pin = new Mesh(
    new SphereGeometry(0.055, 20, 14),
    new MeshPhysicalMaterial({
      color: "#e4a094",
      roughness: 0.3,
      clearcoat: 0.8,
      clearcoatRoughness: 0.18,
    }),
  );
  pin.scale.set(1, 1, 0.48);
  pin.position.set(0, 0.94, 0.075);
  pin.castShadow = true;
  group.add(pin);

  const hit = new Mesh(
    new PlaneGeometry(1.5, 2.02),
    new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  hit.position.z = 0.08;
  group.add(hit);

  const contact = new Mesh(
    new PlaneGeometry(1.62, 2.1),
    new MeshBasicMaterial({
      map: getCardContactTexture(),
      color: "#3c2f2a",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  contact.position.set(0.03, -0.05, -0.075);
  contact.renderOrder = -1;
  group.add(contact);

  return { item, group, hit, target, targetScale, targetRotation, contact };
}

function createPhotoTexture(item: MomentItem) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 496;
  const context = canvas.getContext("2d");
  if (context) {
    const palettes: Record<MomentItem["palette"], [string, string, string]> = {
      peach: ["#6f9e98", "#ecad89", "#c77f96"],
      sky: ["#5d8caf", "#bdc8bc", "#c77f96"],
      mint: ["#5d9e8d", "#e8c47e", "#9f8abb"],
      lilac: ["#8275ae", "#5993a4", "#d68e76"],
      butter: ["#5b91a2", "#eab64e", "#bf738a"],
    };
    const palette = palettes[item.palette];
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.5, palette[1]);
    gradient.addColorStop(1, palette[2]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const seed = item.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
    context.globalCompositeOperation = "soft-light";
    for (let index = 0; index < 12; index++) {
      const x = ((seed * (index + 5) * 41) % 780) - 30;
      const y = ((seed * (index + 7) * 29) % 900) - 40;
      const radius = 56 + ((seed + index * 53) % 148);
      const glow = context.createRadialGradient(x, y, 4, x, y, radius);
      const colors = ["#fff5d8", "#f5c6ce", "#b7d9d1", "#d8c4e1", "#f0d497"];
      glow.addColorStop(0, `${colors[index % colors.length]}e8`);
      glow.addColorStop(0.64, `${colors[index % colors.length]}78`);
      glow.addColorStop(1, `${colors[index % colors.length]}00`);
      context.fillStyle = glow;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    context.globalCompositeOperation = "source-over";

    const vignette = context.createRadialGradient(320, 390, 120, 320, 465, 610);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(0.72, "rgba(54,43,50,.06)");
    vignette.addColorStop(1, "rgba(47,35,42,.3)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createCaptionTexture(caption: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 120;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = COLORS.ink;
    context.font = "500 40px ui-rounded, Arial Rounded MT Bold, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(caption, 450, 64);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

let cardContactTexture: CanvasTexture | null = null;
function getCardContactTexture() {
  if (cardContactTexture) return cardContactTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 332;
  const context = canvas.getContext("2d");
  if (context) {
    context.filter = "blur(10px)";
    context.fillStyle = "rgba(0,0,0,.9)";
    context.beginPath();
    context.roundRect(26, 26, 204, 280, 8);
    context.fill();
  }
  cardContactTexture = new CanvasTexture(canvas);
  return cardContactTexture;
}

function createContactShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(256, 80, 12, 256, 80, 240);
    gradient.addColorStop(0, "rgba(0,0,0,.7)");
    gradient.addColorStop(0.42, "rgba(0,0,0,.28)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return new CanvasTexture(canvas);
}

async function loadScaledPhotoTexture(src: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  await image.decode();

  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  const imageAspect = canvas.width / canvas.height;
  const frameAspect = 1.16 / 1.5;
  if (imageAspect > frameAspect) {
    texture.repeat.x = frameAspect / imageAspect;
    texture.offset.x = (1 - texture.repeat.x) / 2;
  } else {
    texture.repeat.y = imageAspect / frameAspect;
    texture.offset.y = (1 - texture.repeat.y) / 2;
  }
  return texture;
}
