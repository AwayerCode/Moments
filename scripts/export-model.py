"""Export the opened source blend without changing or regenerating it."""
import bpy
import os
import sys
output = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', use_selection=False)
