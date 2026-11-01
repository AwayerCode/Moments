import { HalfFloatType, WebGLRenderTarget, Mesh, Material, type Scene, type PerspectiveCamera, type WebGLRenderer } from "three";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import type { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import type { SceneResources } from "./resources.ts";
import type { RenderQuality } from "./renderQuality.ts";
export async function createRendering(renderer: WebGLRenderer, scene: Scene, viewCamera: PerspectiveCamera, quality: RenderQuality, resources: SceneResources) {
  let composer: EffectComposer | null = null;
  let composerTarget: WebGLRenderTarget | null = null;
  let bokehPass: BokehPass | null = null;
  if (quality.usePostProcessing) {
    const [
      { EffectComposer },
      { RenderPass },
      { GTAOPass },
      { BokehPass },
      { OutputPass },
      { SMAAPass },
    ] = await Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/GTAOPass.js"),
      import("three/addons/postprocessing/BokehPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
      import("three/addons/postprocessing/SMAAPass.js"),
    ]);
    if (!resources.active) throw new Error("Scene initialization cancelled");
    const renderPass = new RenderPass(scene, viewCamera);
    composerTarget = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      samples: quality.samples,
    });
    composer = new EffectComposer(renderer, composerTarget);
    resources.track(composer);
    composer.addPass(renderPass);

    const aoPass = new GTAOPass(scene, viewCamera, 512, 512);
    aoPass.output = GTAOPass.OUTPUT.Default;
    aoPass.blendIntensity = 0.35;
    aoPass.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.4, thickness: 1, scale: 1 });
    aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    // Keep invisible hit planes / soft decals out of the AO depth-normal prepass,
    // otherwise their rectangles show up as AO outlines on the wall.
    const ao = aoPass as unknown as {
      _overrideVisibility: () => void;
      _restoreVisibility: () => void;
    };
    const hiddenForAo: Mesh[] = [];
    const baseOverride = ao._overrideVisibility.bind(aoPass);
    const baseRestore = ao._restoreVisibility.bind(aoPass);
    ao._overrideVisibility = () => {
      baseOverride();
      scene.traverse((object) => {
        if (!(object instanceof Mesh) || !object.visible) return;
        const material = object.material as Material;
        if (material.transparent && !material.depthWrite) {
          object.visible = false;
          hiddenForAo.push(object);
        }
      });
    };
    ao._restoreVisibility = () => {
      baseRestore();
      hiddenForAo.forEach((object) => (object.visible = true));
      hiddenForAo.length = 0;
    };
    composer.addPass(aoPass);
    resources.track(aoPass);

    bokehPass = new BokehPass(scene, viewCamera, {
      focus: 6.8,
      aperture: 0.000055,
      maxblur: 0.002,
    });
    composer.addPass(bokehPass);
    resources.track(bokehPass);
    composer.addPass(resources.track(new OutputPass()));
    // SMAA cleans alpha-tested captions after tone mapping and bokeh.
    composer.addPass(resources.track(new SMAAPass()));
  }

  return {composer,bokehPass};
}
