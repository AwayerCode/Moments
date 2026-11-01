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
 const room=glb('playroom'),camera=glb('sisi-camera');
 for(const name of ['CameraMount','EntryView','EntryPortrait','EntryTarget','GalleryOrigin']) assert.ok(room.nodes.some(n=>n.name===name),name);
 assert.ok(camera.nodes.some(n=>n.name==='PrintSlot'));
});
test('printed paper clears the desk and emerges across the slot clip plane',()=>{
 const slot=new Vector3(-.04,-.76-.91*.5,.57*.5);
 const path=printPath(slot,.5);
 assert.ok(path.start.y>-1.35 && path.end.y>-1.35);
 assert.ok(path.clip.distanceToPoint(path.start)<0);
 assert.ok(path.clip.distanceToPoint(path.end)>0);
 assert.equal(path.start.y,path.end.y);
});
