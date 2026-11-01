"""Triangle-surface checks on the rendered (modifier-evaluated) geometry."""
import bpy, os, json
from mathutils.bvhtree import BVHTree
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/assets/lookdev/entry-lookdev.blend')
dg=bpy.context.evaluated_depsgraph_get()
def tree(o):
 e=o.evaluated_get(dg);m=e.to_mesh();m.calc_loop_triangles()
 verts=[e.matrix_world@v.co for v in m.vertices];faces=[tuple(t.vertices) for t in m.loop_triangles]
 out=BVHTree.FromPolygons(verts,faces,all_triangles=True);e.to_mesh_clear();return out
objects={o.name:o for o in bpy.context.scene.objects if not o.hide_render and o.type in {'MESH','CURVE'}}
desk=tree(objects['Desk solid rounded top']);results=[]
for name,o in objects.items():
 if name.startswith(('Desk','Room','Wall','Window','Garden','Individual garden','Distant','Courtyard','Clay','Sage','Continuous linen','Cotton seam','Bunny tactile')):continue
 hits=desk.overlap(tree(o))
 if hits:results.append({'object':name,'desk_triangle_intersections':len(hits)})
# Other surfaces most likely to cross during arrangement.
pairs=[('Woven ribbon replacement','Front continuous molded shell'),('Woven ribbon replacement','Sculpted grip'),('Lamp weighted base','Cloth bound book cover.003'),('Bunny body','Stacking ring'),('Bunny soft arm.001','Front continuous molded shell')]
for a in objects:
 for b in objects:
  if a.startswith('Woven ribbon replacement') and b.startswith(('Bunny','Peach stitched','Embroidered')) and 'tactile' not in b:pairs.append((a,b))
  if a.startswith('Rounded toy block') and b.startswith(('Lamp','Mushroom','Cloth bound','Storybook','Book rounded')):pairs.append((a,b))
  if a=='Draped muslin cloth' and b.startswith(('Desk ivory','Desk front')):pairs.append((a,b))
checks=[]
for a,b in pairs:
 if a in objects and b in objects:checks.append({'a':a,'b':b,'triangle_intersections':len(tree(objects[a]).overlap(tree(objects[b])))})
report={'desk_crossings':results,'other_pairs':checks,'note':'Surface intersection diagnostic; intentional joints require review, and containment is not detected.'}
with open(ROOT+'/assets/lookdev/collision-audit.json','w') as f:json.dump(report,f,indent=2)
print(json.dumps(report))
