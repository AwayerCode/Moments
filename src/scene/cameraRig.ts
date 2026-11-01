import { Vector3, type PerspectiveCamera, type Object3D } from 'three';
import { LAYOUT } from './galleryLayout.ts';
export function entryPose(markers: {EntryView:Object3D;EntryPortrait:Object3D;EntryTarget:Object3D}, aspect:number) {
  // Blend framing across portrait/tablet widths; no abrupt camera jump at .72.
  const t = Math.max(0, Math.min(1, (aspect - .6) / .6));
  const position = markers.EntryPortrait.getWorldPosition(new Vector3())
    .lerp(markers.EntryView.getWorldPosition(new Vector3()), t * t * (3 - 2 * t));
  return {position, target:markers.EntryTarget.getWorldPosition(new Vector3())};
}
export function galleryPose(x:number, camera:PerspectiveCamera) {
  return {position:new Vector3(x,1.05,camera.aspect<.72?7.65:9.2),target:new Vector3(x,1.05,LAYOUT.wallZ)};
}
export function inspectPose(target:Vector3, scale:number, camera:PerspectiveCamera) {
  const v=Math.tan(camera.fov*Math.PI/360);
  const distance=Math.max(1.84*scale/(2*v*.78),1.36*scale/(2*v*camera.aspect*.78));
  return {position:new Vector3(target.x,target.y,target.z+distance),target:target.clone()};
}
