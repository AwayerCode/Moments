import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { easeOutBack, mountWebGL } from "../core.ts";

export type CardScreenRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: number;
};

export type InstaxScene = {
  setEject: (amount: number) => void;
  setShake: (amount: number) => void;
  projectCard: () => CardScreenRect | null;
  dispose: () => void;
};

type Options = {
  onFrame?: () => void;
};

const BLOSSOM = new Color("#f7c4d2");
const BLOSSOM_DEEP = new Color("#eeadc0");

export function createInstaxScene(
  canvas: HTMLCanvasElement,
  options: Options = {},
): InstaxScene {
  const host = mountWebGL(canvas, { alpha: true });
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 40);
  camera.position.set(0, -0.15, 8.4);

  const hemi = new HemisphereLight("#fff7fb", "#f4c4d4", 1.15);
  const sun = new DirectionalLight("#fff6ee", 1.35);
  sun.position.set(-3.2, 4.4, 5.2);
  const fill = new DirectionalLight("#cfe6ff", 0.45);
  fill.position.set(3.4, -1.2, 2.4);
  scene.add(new AmbientLight("#ffffff", 0.28), hemi, sun, fill);

  const root = new Group();
  scene.add(root);

  const body = buildCameraBody();
  root.add(body);

  const card = buildFilmCard();
  root.add(card);

  let eject = 0;
  let shake = 0;
  let elapsed = 0;

  const slotHidden = { y: 0.02, scaleY: 0.12 };
  const slotShown = { y: -1.62, scaleY: 1 };

  function applyCardPose() {
    const t = easeOutBack(eject);
    card.position.set(0, lerp(slotHidden.y, slotShown.y, t), 0.18);
    card.scale.set(1, lerp(slotHidden.scaleY, slotShown.scaleY, t), 1);
    card.rotation.z = Math.sin(elapsed * 28) * shake * 0.08;
    card.visible = eject > 0.02;
  }

  function resizeCamera() {
    const { width, height } = host.resize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resizeCamera();
  const onResize = () => resizeCamera();
  window.addEventListener("resize", onResize);

  host.start((delta, time) => {
    elapsed = time;
    shake = Math.max(0, shake - delta * 2.4);
    root.rotation.y = Math.sin(time * 0.55) * 0.07;
    root.position.y = Math.sin(time * 0.9) * 0.045;
    applyCardPose();
    host.renderer.render(scene, camera);
    options.onFrame?.();
  });

  return {
    setEject(amount) {
      eject = amount;
    },
    setShake(amount) {
      shake = amount;
    },
    projectCard() {
      if (eject < 0.55) {
        return null;
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        return null;
      }
      card.updateMatrixWorld(true);
      const corners = [
        new Vector3(-0.62, 0.72, 0.03),
        new Vector3(0.62, 0.72, 0.03),
        new Vector3(-0.62, -0.72, 0.03),
        new Vector3(0.62, -0.72, 0.03),
      ].map((point) => point.applyMatrix4(card.matrixWorld).project(camera));
      const xs = corners.map((point) => (point.x * 0.5 + 0.5) * canvas.clientWidth);
      const ys = corners.map((point) => (-point.y * 0.5 + 0.5) * canvas.clientHeight);
      const left = Math.min(...xs);
      const right = Math.max(...xs);
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);
      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        visible: eject,
      };
    },
    dispose() {
      window.removeEventListener("resize", onResize);
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const material of materials) {
            if ("map" in material && material.map) {
              material.map.dispose();
            }
            material.dispose();
          }
        }
      });
      host.dispose();
    },
  };
}

function buildCameraBody(): Group {
  const group = new Group();
  const plastic = new MeshPhysicalMaterial({
    color: BLOSSOM,
    roughness: 0.32,
    metalness: 0.04,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
  });
  const plasticDeep = plastic.clone();
  plasticDeep.color = BLOSSOM_DEEP;

  const shell = new Mesh(new BoxGeometry(2.35, 2.72, 0.92), plastic);
  shell.position.y = 0.42;
  group.add(shell);

  const face = new Mesh(new BoxGeometry(2.12, 2.48, 0.18), plasticDeep);
  face.position.set(0, 0.42, 0.42);
  group.add(face);

  const strap = new Mesh(
    new TorusGeometry(1.18, 0.075, 12, 28, Math.PI * 1.05),
    plastic,
  );
  strap.position.set(-1.28, 0.15, 0);
  strap.rotation.set(1.15, 0, 1.2);
  group.add(strap);

  const flash = new Mesh(
    new BoxGeometry(0.34, 0.16, 0.12),
    new MeshStandardMaterial({
      color: "#efe8ec",
      roughness: 0.2,
      metalness: 0.35,
    }),
  );
  flash.position.set(-0.78, 1.48, 0.5);
  group.add(flash);

  const viewfinder = new Mesh(
    new CylinderGeometry(0.07, 0.07, 0.1, 20),
    new MeshStandardMaterial({ color: "#222", roughness: 0.4 }),
  );
  viewfinder.rotation.x = Math.PI / 2;
  viewfinder.position.set(-0.42, 1.48, 0.5);
  group.add(viewfinder);

  const lamp = new Mesh(
    new SphereGeometry(0.045, 16, 16),
    new MeshStandardMaterial({
      color: "#ff8a3d",
      emissive: "#ff7a2d",
      emissiveIntensity: 0.85,
    }),
  );
  lamp.position.set(-0.18, 1.5, 0.5);
  group.add(lamp);

  const label = new Mesh(
    new BoxGeometry(0.55, 0.28, 0.01),
    new MeshStandardMaterial({ map: brandTexture(), roughness: 0.6 }),
  );
  label.position.set(0.78, 1.46, 0.51);
  group.add(label);

  const ring = new Mesh(
    new CylinderGeometry(0.78, 0.78, 0.16, 40),
    plastic,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.34, 0.55);
  group.add(ring);

  const ringInner = new Mesh(
    new CylinderGeometry(0.58, 0.58, 0.1, 40),
    plasticDeep,
  );
  ringInner.rotation.x = Math.PI / 2;
  ringInner.position.set(0, 0.34, 0.62);
  group.add(ringInner);

  const glass = new Mesh(
    new SphereGeometry(0.42, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new MeshPhysicalMaterial({
      color: "#111",
      roughness: 0.08,
      metalness: 0.55,
      clearcoat: 1,
    }),
  );
  glass.rotation.x = Math.PI;
  glass.position.set(0, 0.34, 0.62);
  group.add(glass);

  const core = new Mesh(
    new CylinderGeometry(0.16, 0.16, 0.08, 24),
    new MeshStandardMaterial({ color: "#050505", roughness: 0.25 }),
  );
  core.rotation.x = Math.PI / 2;
  core.position.set(0, 0.34, 0.78);
  group.add(core);

  const shutter = new Mesh(
    new SphereGeometry(0.16, 24, 24),
    new MeshStandardMaterial({
      color: "#ff8a4a",
      roughness: 0.25,
      metalness: 0.12,
    }),
  );
  shutter.position.set(-0.72, 0.86, 0.58);
  group.add(shutter);

  const shutterRing = new Mesh(
    new TorusGeometry(0.17, 0.03, 10, 24),
    new MeshStandardMaterial({ color: "#f4c2b0", roughness: 0.35 }),
  );
  shutterRing.position.copy(shutter.position);
  group.add(shutterRing);

  const slot = new Mesh(
    new BoxGeometry(1.42, 0.1, 0.22),
    new MeshStandardMaterial({ color: "#e7a9bb", roughness: 0.45 }),
  );
  slot.position.set(0, -0.88, 0.28);
  group.add(slot);

  return group;
}

function buildFilmCard(): Group {
  const group = new Group();
  const paper = new Mesh(
    new BoxGeometry(1.28, 1.52, 0.045),
    new MeshStandardMaterial({ color: "#ffffff", roughness: 0.55 }),
  );
  group.add(paper);
  return group;
}

function brandTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 42px Fredoka, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("instax", 240, 58);
    ctx.font = "500 28px Fredoka, sans-serif";
    ctx.fillText("mini 13", 240, 96);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
