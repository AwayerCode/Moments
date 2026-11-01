import assert from 'node:assert/strict';
import test from 'node:test';
import { Scene, Mesh, BoxGeometry, MeshStandardMaterial, Texture } from 'three';
import { SceneResources } from '../src/scene/resources.ts';
test('shared model resources dispose once, including texture maps',()=>{
 const scene=new Scene(),geometry=new BoxGeometry(),texture=new Texture();
 const material=new MeshStandardMaterial({map:texture,normalMap:texture});
 scene.add(new Mesh(geometry,material),new Mesh(geometry,material));
 const counts={geometry:0,material:0,texture:0};
 for(const [key,value] of Object.entries({geometry,material,texture}))value.addEventListener('dispose',()=>counts[key]++);
 const resources=new SceneResources(scene);resources.track(texture);resources.dispose();resources.dispose();
 assert.deepEqual(counts,{geometry:1,material:1,texture:1});assert.equal(scene.children.length,0);
});
test('late resources dispose immediately and pending callbacks are cancelled', async()=>{
 const resources=new SceneResources(new Scene());let calls=0;
 resources.timeout(()=>calls++,5);resources.dispose();
 resources.track({dispose:()=>calls++});
 await new Promise(resolve=>setTimeout(resolve,15));assert.equal(calls,1);
});
