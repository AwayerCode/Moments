import { Vector3, DirectionalLight, HemisphereLight, PMREMGenerator, SpotLight, type Scene, type WebGLRenderer } from 'three';
/** Stable world lights; no screen-following studio rigs. */
export function buildLights(scene: Scene, shadowMapSize: number) {
  scene.add(new HemisphereLight('#f6f5ff', '#c6a382', 1.2));
  const sun = new DirectionalLight('#fff1dd', 2.4);
  sun.position.set(-3.4, 5.4, -4.2); sun.target.position.set(0, -1, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  Object.assign(sun.shadow.camera, {left:-8,right:8,top:8,bottom:-8,near:.1,far:30});
  sun.shadow.bias = -.0001; sun.shadow.normalBias = .015; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new DirectionalLight('#e8efff', 1.15); fill.position.set(3,4,8); scene.add(fill);
  const flash = new SpotLight('#fff7e6', 0, 9, Math.PI/3, 1, 1.3);
  flash.position.set(0,.1,.5); flash.target.position.set(0,-1,2); scene.add(flash,flash.target);
  return {flash};
}
/** Capture the actual static room once, not a painted backdrop or gradient sphere. */
export function buildEnvironment(renderer: WebGLRenderer, scene: Scene) {
  const generator = new PMREMGenerator(renderer);
  const environment = generator.fromScene(scene, .015, .05, 60, {position: new Vector3(0, -.35, 1.4)});
  generator.dispose();
  return environment;
}
