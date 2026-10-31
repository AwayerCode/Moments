# Sisi camera model

Original project asset, covered by the repository MIT license. No downloaded camera model or personal media is included.

- `sisi-camera.blend`: editable Blender source (generated with Blender 5.0.1).
- `build_camera.py`: reproducible geometry/material authoring script.
- `../../public/models/sisi-camera.glb`: browser asset loaded by Three.js.

Rebuild using Blender 5.0.1:

```sh
blender --background --python assets/source/build_camera.py
```

Alternatively, run the script with Python 3.11 and `bpy==5.0.1`. Rebuilding replaces the `.blend` and `.glb`, so preserve manual Blender edits separately first.

The design is a Sisi-branded fictional instant camera with a front ejection slot, not a replica of a Fujifilm model. The current pass establishes a stable front-facing camera and paper plane, layered optical housing, distinct material surfaces and scene lighting. Further art direction and paper bending are separate iterations.
