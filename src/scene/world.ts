import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3, type Object3D, type Scene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LAYOUT } from './galleryLayout.ts';
import { SceneResources } from './resources.ts';

function required(root: Object3D, name: string) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Missing Blender anchor: ${name}`);
  return node;
}
export async function loadWorld(scene: Scene, resources: SceneResources) {
  const loader = new GLTFLoader();
  const playroom = (await loader.loadAsync('/models/playroom.glb')).scene;
  if (!resources.active) { new SceneResources(playroom).dispose(); throw new Error("Scene cancelled"); }
  scene.add(playroom);
  const cameraActor = new Group();
  scene.add(cameraActor);
  const model = (await loader.loadAsync('/models/sisi-camera.glb')).scene;
  if (!resources.active) { new SceneResources(model).dispose(); throw new Error("Scene cancelled"); }
  cameraActor.add(model);
  const mount = required(playroom, 'CameraMount');
  playroom.updateMatrixWorld(true);
  mount.matrixWorld.decompose(cameraActor.position, cameraActor.quaternion, cameraActor.scale);
  const markers = {
    PrintSlot: required(model, 'PrintSlot'),
    EntryView: required(playroom, 'EntryView'),
    EntryPortrait: required(playroom, 'EntryPortrait'),
    EntryTarget: required(playroom, 'EntryTarget'),
    GalleryOrigin: required(playroom, 'GalleryOrigin'),
  };
  const galleryOrigin = markers.GalleryOrigin.getWorldPosition(new Vector3());
  if (Math.abs(galleryOrigin.x - LAYOUT.startX) > .01 || Math.abs(galleryOrigin.z - LAYOUT.wallZ) > .01) {
    throw new Error('Gallery anchor does not match the exported layout contract');
  }
  scene.traverse(object => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true; } });
  if (!resources.active) throw new Error('Scene disposed while loading');
  return { playroom, cameraActor, markers };
}
export function createHeroHit(cameraActor: Group) {
  const hit = new Mesh(new BoxGeometry(3.5, 3.7, 1.55), new MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  hit.position.copy(cameraActor.position); hit.scale.copy(cameraActor.scale).multiplyScalar(1.12);
  return hit;
}
/** Repeated wall sections share geometry/material, and stay in the same room. */
export function buildGalleryWall(scene: Scene) {
  const root = new Group(); scene.add(root);
  const geometry = new BoxGeometry(6, 12, .2);
  const material = new MeshStandardMaterial({color:'#e9dfd1',roughness:.9});
  const floorGeometry = new BoxGeometry(6, .15, 22);
  const sourceFloor = scene.getObjectByName('Room_floor');
  const floorMaterial = sourceFloor instanceof Mesh ? sourceFloor.material : new MeshStandardMaterial({color:'#d6b68f',roughness:.8});
  let right = 9.5;
  return { ensure(x: number) {
    while (right < x + 8) {
      const wall = new Mesh(geometry, material);
      wall.position.set(right + 3, 2, LAYOUT.wallZ - .1);
      wall.receiveShadow = true;
      root.add(wall);
      const floor = new Mesh(floorGeometry, floorMaterial);
      floor.position.set(right + 3, -4, 0);
      floor.receiveShadow = true;
      root.add(floor); right += 6;
    }
  }};
}
