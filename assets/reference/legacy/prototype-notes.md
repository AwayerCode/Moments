# Three.js playroom spatial prototype

Generate with Blender 5.2:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/build-playroom.py
```

`playroom.blend` is the editable source; `public/models/playroom.glb` is the runtime asset. The script uses Y-up design coordinates and converts them to Blender Z-up before GLB export.

This first spatial prototype replaces the photographic background with mesh geometry. It contains a desk, window opening, frame, curtain folds, stacking toy, blocks and simplified outdoor foliage. Materials are solid PBR colors, without image textures. The existing camera model remains a placeholder.

Remaining visual work: detailed camera geometry, realistic cloth/wood surfaces, soft window illumination and indirect lighting, outdoor foliage, and mobile framing. Existing gallery transition and downward paper ejection need redesign for the physical desk (the paper can intersect the desk). This is not a finished photorealistic scene. Gallery bounds remain a separate known issue.
