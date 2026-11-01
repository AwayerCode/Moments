import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { printPath } from '../src/scene/sequence.ts';
function glb(name) {
 const b=readFileSync(new URL(`../public/models/${name}.glb`,import.meta.url));
 assert.equal(b.readUInt32LE(0),0x46546c67);
 return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
}
test('exported models retain named interaction anchors',()=>{
 const room=glb('entry-scene');
 for(const name of ['CameraMount','PrintSlot','EntryView','EntryPortrait','EntryTarget','GalleryOrigin']) assert.ok(room.nodes.some(n=>n.name===name),name);
 assert.ok(room.materials.some(m=>m.emissiveTexture), 'baked surface lighting is exported');
 assert.ok(room.meshes.length>1, 'scene retains real meshes');
 assert.ok(room.materials.some(m=>m.normalTexture), 'procedural surface normals survive export');
 assert.ok(room.materials.some(m=>m.extensions?.KHR_materials_clearcoat), 'camera coating survives export');
});
test('printed paper clears the desk and emerges across the slot clip plane',()=>{
 const slot=new Vector3(-.04,-.76-.91*.5,.57*.5);
 const path=printPath(slot,.5);
 assert.ok(path.start.y>-1.35 && path.end.y>-1.35);
 assert.ok(path.clip.distanceToPoint(path.start)<0);
 assert.ok(path.clip.distanceToPoint(path.end)>0);
 assert.equal(path.start.y,path.end.y);
});

test('paper flight keeps its full rectangle above the desk and crosses props at height', async()=>{
 const {flightPosition,easeInOut,clamp}=await import('../src/scene/sequence.ts');
 const start=printPath(new Vector3(-.04,-1.215,.285),.5).end;
 const end=new Vector3(11.688,-1.248,-2.805);
 assert.deepEqual(flightPosition(start,end,0).toArray(),start.toArray());
 assert.ok(flightPosition(start,end,1).distanceTo(end)<1e-10);
 for(let i=0;i<=300;i++) {
  const t=i/300,center=flightPosition(start,end,t);
  const turn=easeInOut(clamp((t-.3)/.45,0,1));
  const scale=.52+(1-.52)*turn;
  for(const x of [-.68,.68])for(const y of [-.92,.92]) {
   const corner=new Vector3(x*scale,y*scale,0).applyAxisAngle(new Vector3(1,0,0),-Math.PI/2*(1-turn)).add(center);
   if(Math.abs(corner.x)<4 && Math.abs(corner.z-.05)<2.2) assert.ok(corner.y>-1.35,`desk collision at ${t}`);
  }
  if(t>=.3 && t<=.75) assert.ok(center.y-.92*scale>1.2);
 }
});

test('rotated camera prints along its own slot normal',()=>{
 const yaw=-Math.PI/20, slot=new Vector3(-.04,-1.215,.285);
 const path=printPath(slot,.5,yaw);
 const direction=path.end.clone().sub(path.start).normalize();
 assert.ok(direction.distanceTo(new Vector3(Math.sin(yaw),0,Math.cos(yaw)))<1e-9);
 assert.ok(path.clip.distanceToPoint(path.start)<0);
 assert.ok(path.clip.distanceToPoint(path.end)>0);
});
