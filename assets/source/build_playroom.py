"""Reproducible, texture-free architectural sample. Coordinates are Three.js Y-up."""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,rough=.5):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough
 return m
cream=mat('Warm plaster',(.85,.77,.65),.9); wood=mat('Honey birch',(.65,.43,.24),.48)
white=mat('Ivory painted wood',(.95,.89,.77),.42); pink=mat('Peach enamel',(.82,.39,.43),.4)
mint=mat('Sage painted wood',(.43,.65,.52),.55); blue=mat('Powder blue',(.42,.65,.78),.5); yellow=mat('Butter yellow',(.88,.69,.33),.5)
def pos(p): return (p[0],-p[2],p[1])
def box(name,p,s,m,bevel=.04):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos(p)); o=bpy.context.object; o.name=name; o.dimensions=(s[0],s[2],s[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Manufactured rounded edges','BEVEL'); mod.width=bevel; mod.segments=4
  mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 return o
def ball(name,p,s,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=pos(p)); o=bpy.context.object;o.name=name;o.scale=(s[0],s[2],s[1]);o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 return o
# Actual desk surface, frame, and legs. Camera shell rests at y=-1.35.
box('Desk solid rounded top',(0,-1.47,.05),(8,.24,4.4),wood,.10)
box('Desk ivory apron',(0,-1.85,.05),(7.55,.5,3.95),white,.06)
for x in [-3.4,3.4]:
 for z in [-1.65,1.75]:box('Desk tapered leg',(x,-3,z),(.25,2.2,.25),white,.045)
box('Room floor',(0,-4,0),(20,.15,22),wood)
# Window opening is geometry, not a background image.
box('Wall left',(-6,3,-3),(7,20,.22),cream)
box('Wall right',(6,3,-3),(7,20,.22),cream)
box('Wall below window',(0,-2,-3),(5,3,.22),cream)
box('Wall above window',(0,9,-3),(5,11,.22),cream)
for x in [-2.5,2.5]:box('Window jamb',(x,1.5,-2.83),(.16,4,.27),white,.025)
for y in [-.5,3.5]:box('Window frame',(0,y,-2.83),(5.15,.16,.27),white,.025)
box('Window mullion',(0,1.5,-2.8),(.09,4,.17),white,.015)
box('Window crossbar',(0,1.6,-2.8),(5,.09,.17),white,.015)
box('Deep window sill',(0,-.59,-2.58),(5.5,.15,.8),white,.04)
# Pleated curtains, each fold is mesh geometry.
for side in [-1,1]:
 for i in range(9):
  x=side*(2.45+i*.095)
  ball('Linen curtain fold',(x,1.48,-2.48),(.09,2.22,.10),white)
# Small wooden houses and blocks.
for i,(x,z,m) in enumerate([(1.6,.1,mint),(2.13,.2,yellow),(2.65,-.15,pink),(1.9,-.5,blue)]):
 box('Rounded toy block '+str(i),(x,-1.10,z),(.48,.5,.48),m,.035)
box('Toy house',(2.5,-.82,-.75),(.65,1.06,.65),white,.035)
roof=box('House roof',(2.25,-.17,-.75),(.7,.12,.74),pink,.025);roof.rotation_euler[1]=-math.pi/4
roof=box('House roof second',(2.75,-.17,-.75),(.7,.12,.74),pink,.025);roof.rotation_euler[1]=math.pi/4
# Stacking rings on the left, real rounded geometry.
box('Stacking toy base',(-2.05,-1.27,-.2),(.85,.16,.85),white,.06)
for i,m in enumerate([pink,yellow,mint,blue]):
 bpy.ops.mesh.primitive_torus_add(major_radius=.32-i*.045,minor_radius=.085,major_segments=40,minor_segments=12,location=pos((-2.05,-1.1+i*.16,-.2)))
 o=bpy.context.object;o.name='Stacking ring';o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
ball('Stacking toy finial',(-2.05,-.38,-.2),(.13,.13,.13),wood)
# Outdoors: sculptural distant foliage catches actual light through the window.
for x,y,z,s in [(-3,0,-7,1.8),(2,-.4,-8,2.1),(.7,-1,-6,1.5)]:ball('Distant garden canopy',(x,y,z),(s,s,s),mint)
def anchor(name, location, scale=1):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos(location);o.scale=(scale,scale,scale)
anchor('CameraMount',(-.04,-.76,0),.5)
anchor('EntryView',(0,2.3,7.4))
anchor('EntryPortrait',(0,2.8,7.8))
anchor('EntryTarget',(0,-.35,0))
anchor('GalleryOrigin',(12,0,-2.89))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/source/playroom.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models/playroom.glb'),export_format='GLB',export_apply=True)
print('PLAYROOM_EXPORT_OK')
