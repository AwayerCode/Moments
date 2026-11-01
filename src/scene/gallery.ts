import { Group, Mesh, PlaneGeometry, MeshBasicMaterial, MeshStandardMaterial, MeshPhysicalMaterial, SphereGeometry, CanvasTexture, Vector3, SRGBColorSpace, type Texture } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { MomentItem } from "../../shared/moments.ts";
import type { SceneResources } from "./resources.ts";
import type { Scene } from "three";
import { cardSlot } from "./galleryLayout.ts";
export type GalleryCard = {
  item: MomentItem;
  group: Group;
  hit: Mesh;
  target: Vector3;
  targetScale: number;
  contact: Mesh<PlaneGeometry, MeshBasicMaterial>;
  visuals: Mesh[];
  targetRotation: number;
  setResident: (wanted: boolean) => void;
};
const COLORS = {
  ink: "#463b38",
  paper: "#fffaf0",
};

export function createCard(
  item: MomentItem,
  index: number,
  scene: Scene,
  resources: SceneResources,
  photoTextureWidth: number,
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
    color: "#ffffff",
    roughness: 0.68,
    metalness: 0,
  });
  const photo = new Mesh(new PlaneGeometry(1.16, 1.5), photoMaterial);
  photo.position.set(0, 0.07, 0.027);
  photo.receiveShadow = true;
  group.add(photo);

  let generation = 0;
  let resident: Texture | undefined;
  let requested = false;
  let retryAfter = 0;
  function setResident(wanted: boolean) {
    if (!item.src || !resources.active) return;
    if (!wanted) {
      generation++;
      requested = false;
      if (resident) { resources.release(resident); resident = undefined; }
      photoMaterial.map = photoTexture;
      return;
    }
    if (requested || performance.now() < retryAfter) return;
    requested = true;
    const token = ++generation;
    void loadScaledPhotoTexture(item.src, photoTextureWidth).then((texture) => {
      if (!resources.active || token !== generation) { texture.dispose(); return; }
      resources.track(texture);
      resident = texture;
      photoMaterial.map = texture;
      photoMaterial.needsUpdate = true;
    }).catch(() => { if (token === generation) { requested = false; retryAfter = performance.now() + 30_000; } });
  }
  resources.track(photoTexture);

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
  caption.position.set(0, -0.80, 0.03);
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
  // The wall pin belongs to the wall, not to the paper emerging from the camera.
  const mount = new Group();
  mount.position.copy(target); mount.rotation.z = targetRotation;
  mount.scale.setScalar(targetScale); mount.add(pin); scene.add(mount);
  const visuals: Mesh[] = [paper, photo, caption];

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

  return {
    item,
    setResident,
    group,
    hit,
    target,
    targetScale,
    targetRotation,
    contact,
    visuals,
  };
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
  canvas.width = 1200;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = COLORS.ink;
    context.font = "500 80px ui-rounded, Arial Rounded MT Bold, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(caption, 600, 84, 1120);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function getCardContactTexture() {
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
  return new CanvasTexture(canvas);
}

async function loadScaledPhotoTexture(src: string, maxWidth: number) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  await image.decode();

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
