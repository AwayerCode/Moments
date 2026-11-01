import { Plane, Vector3 } from 'three';
export const easeInOut = (v:number) => v<.5?2*v*v:1-(-2*v+2)**2/2;
export const easeOut = (v:number) => 1-(1-v)**3;
export const clamp = (v:number,min:number,max:number) => Math.max(min,Math.min(max,v));
export const lerp = (a:number,b:number,t:number) => a+(b-a)*t;
/** The paper exits horizontally, face up. Its thickness clears the desk. */
export function printPath(slot:Vector3, modelScale:number) {
  const scale=modelScale*1.04;
  const half=.92*scale;
  return {
    scale,
    start:slot.clone().add(new Vector3(0,.015,-half)),
    end:slot.clone().add(new Vector3(0,.015,half)),
    clip:new Plane().setFromNormalAndCoplanarPoint(new Vector3(0,0,1),slot),
  };
}
