import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
} from "three";
import type { FridgeViewState } from "./types.ts";

export type FridgeSceneHandle = {
  scene: Scene;
  camera: OrthographicCamera;
  /** Polaroid meshes attach here when the wall moves fully into WebGL. */
  polaroidLayer: Group;
  applyView: (view: FridgeViewState, viewportWidth: number, viewportHeight: number) => void;
  dispose: () => void;
};

/**
 * 3D-ready fridge host. v1 still composites the Polaroid wall in CSS so
 * pinch-zoom / pan stay crisp; mount this scene when photos become meshes
 * (R2 textures, depth, gentle parallax).
 */
export function createFridgeScene(): FridgeSceneHandle {
  const scene = new Scene();
  scene.background = new Color("#f3f3f3");

  const camera = new OrthographicCamera(-8.5, 8.5, 6, -6, 0.1, 80);
  camera.position.set(0, 0, 20);

  const door = new Mesh(
    new PlaneGeometry(17, 12),
    new MeshStandardMaterial({ color: "#fbfbfb", roughness: 0.85 }),
  );
  scene.add(door);

  const polaroidLayer = new Group();
  polaroidLayer.name = "polaroid-layer";
  scene.add(polaroidLayer);

  scene.add(new AmbientLight("#ffffff", 0.9));
  const key = new DirectionalLight("#fff7f2", 0.55);
  key.position.set(-4, 8, 10);
  scene.add(key);

  function applyView(
    view: FridgeViewState,
    viewportWidth: number,
    viewportHeight: number,
  ) {
    const aspect = viewportWidth / Math.max(1, viewportHeight);
    const halfH = 6 / view.scale;
    const halfW = halfH * aspect;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.position.x = -view.x / 100;
    camera.position.y = view.y / 100;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials) {
          material.dispose();
        }
      }
    });
  }

  return { scene, camera, polaroidLayer, applyView, dispose };
}
