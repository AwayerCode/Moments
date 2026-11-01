import { BoxGeometry, SpotLight, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, MeshPhysicalMaterial, Vector3, type Object3D, type Scene } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
  const playroom = (await loader.loadAsync('/models/entry-scene.glb')).scene;
  if (!resources.active) { new SceneResources(playroom).dispose(); throw new Error("Scene cancelled"); }
  scene.add(playroom);
  const cameraActor = new Group();
  scene.add(cameraActor);
  const mount = required(playroom, 'CameraMount');
  playroom.updateMatrixWorld(true);
  mount.matrixWorld.decompose(cameraActor.position, cameraActor.quaternion, cameraActor.scale);
  const markers = {
    PrintSlot: required(playroom, 'PrintSlot'),
    EntryView: required(playroom, 'EntryView'),
    EntryPortrait: required(playroom, 'EntryPortrait'),
    EntryTarget: required(playroom, 'EntryTarget'),
    GalleryOrigin: required(playroom, 'GalleryOrigin'),
  };
  const galleryOrigin = markers.GalleryOrigin.getWorldPosition(new Vector3());
  if (Math.abs(galleryOrigin.x - LAYOUT.startX) > .01 || Math.abs(galleryOrigin.z - LAYOUT.wallZ) > .01) {
    throw new Error('Gallery anchor does not match the exported layout contract');
  }
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    // Diffuse radiance is baked into geometry; avoid adding the same shadows twice.
    const baked = materials.every(m => m instanceof MeshStandardMaterial && m.emissiveMap);
    object.castShadow = !baked; object.receiveShadow = !baked;
    if (object.name.replaceAll('_', ' ').startsWith('Bunny tactile')) {
      // Sub-pixel cotton strands must not become bright specular sparkles.
      object.castShadow = false;
      for (const material of materials) if (material instanceof MeshStandardMaterial) {
        material.roughness = 1; material.envMapIntensity = .1;
        material.color.multiplyScalar(.75);
        if (material instanceof MeshPhysicalMaterial) material.specularIntensity = 0;
      }
    }
  });
  if (!resources.active) throw new Error('Scene disposed while loading');
  return { playroom, cameraActor, markers };
}
export function createHeroHit(cameraActor: Group) {
  const hit = new Mesh(new BoxGeometry(3.5, 3.7, 1.55), new MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  hit.quaternion.copy(cameraActor.quaternion);
  hit.position.copy(cameraActor.position); hit.scale.copy(cameraActor.scale).multiplyScalar(1.12);
  return hit;
}
/** Repeated wall sections share geometry/material, and stay in the same room. */
export function buildGalleryWall(scene: Scene) {
  const root = new Group(); scene.add(root);
  const geometry = new BoxGeometry(6, 12, .2);
  const material = new MeshStandardMaterial({color:'#e9dfd1',roughness:.9});
  const lampGeometry = new RoundedBoxGeometry(1.1, .12, .25, 3, .04);
  const lampMaterial = new MeshStandardMaterial({color:"#fff0da",roughness:.32,metalness:.15});
  const floorGeometry = new BoxGeometry(6, .15, 22);
  const sourceFloor = scene.getObjectByName('Room_floor');
  const floorMaterial = sourceFloor instanceof Mesh ? sourceFloor.material : new MeshStandardMaterial({color:'#d6b68f',roughness:.8});
  let right = 9.5;
  const lamps: SpotLight[] = [];
  return { update(x: number) {
    for (const lamp of lamps) lamp.visible = Math.abs(lamp.position.x - x) < 10;
  }, ensure(x: number) {
    while (right < x + 8) {
      const wall = new Mesh(geometry, material);
      wall.position.set(right + 3, 2, LAYOUT.wallZ - .1);
      wall.receiveShadow = true;
      root.add(wall);
      const lamp = new Mesh(lampGeometry, lampMaterial);
      lamp.position.set(right + 3, 4.8, LAYOUT.wallZ + .65);
      root.add(lamp);
      const light = new SpotLight('#fff1da', 9, 11, 1.1, 1, 2);
      light.position.copy(lamp.position); light.position.y -= .08;
      light.target.position.set(right + 3, 1, LAYOUT.wallZ);
      light.castShadow = true;
      light.shadow.mapSize.set(512,512);
      light.shadow.normalBias = .008;
      lamps.push(light);
      root.add(light, light.target);
      const floor = new Mesh(floorGeometry, floorMaterial);
      floor.position.set(right + 3, -4, 0);
      floor.receiveShadow = true;
      root.add(floor); right += 6;
    }
  }};
}
