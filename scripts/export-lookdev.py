"""Bake the editable Cycles scene onto real geometry and export the runtime scene.
No camera-projected backgrounds. Static diffuse GI is UV-baked; optics stay PBR.
"""
import bpy, os, math
import numpy as np
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/assets/lookdev/entry-lookdev.blend')
scene=bpy.context.scene
out=ROOT+'/public/models'
os.makedirs(out,exist_ok=True)
# Remove hidden studies and reduce sub-pixel cotton strands for realtime geometry.
for ob in list(scene.objects):
 if ob.hide_render or ob.type=='CAMERA': bpy.data.objects.remove(ob,do_unlink=True)
for ob in list(scene.objects):
 if ob.name.startswith('Bunny tactile'):
  for i in range(len(ob.data.splines)-1,-1,-1):
   if i%24:ob.data.splines.remove(ob.data.splines[i])
  ob.data.bevel_resolution=0
# Evaluate bevel, thickness, font and curve geometry before UV unwrapping.
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
 if ob.type in {'MESH','CURVE','FONT'}:ob.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in scene.objects if o.select_get())
bpy.ops.object.convert(target='MESH')
meshes=[o for o in scene.objects if o.type=='MESH']
groups={'Room':[], 'Tabletop':[]};live=[]
for ob in meshes:
 mats=list(ob.data.materials)
 if any(m and m.use_nodes and (p:=m.node_tree.nodes.get('Principled BSDF')) and (p.inputs['Metallic'].default_value>.5 or p.inputs['Transmission Weight'].default_value>.2 or p.inputs['Emission Strength'].default_value>0) for m in mats):
  live.append(ob);continue
 if ob.name.startswith(('Garden','Individual garden','Leaf petiole','Bunny tactile')):
  live.append(ob);continue
 group='Room' if ob.name.startswith(('Room','Wall','Window','Deep window','Continuous linen','Desk tapered','Desk side','Desk ivory')) else 'Tabletop'
 groups[group].append(ob)
scene.render.engine='CYCLES';scene.cycles.samples=64
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=True
scene.render.bake.margin=12
# Preserve each object's procedural coordinate frame before joining meshes.
# Implicit Object coordinates would otherwise become the joined mesh's coordinates.
for ob in meshes:
 frame=None
 for slot in ob.material_slots:
  mat=slot.material
  if not mat or not mat.use_nodes:continue
  if not any(n.type=='TEX_COORD' for n in mat.node_tree.nodes):continue
  slot.material=mat.copy()
  if frame is None:
   frame=bpy.data.objects.new('Material coordinate frame',None)
   scene.collection.objects.link(frame);frame.matrix_world=ob.matrix_world.copy()
  for n in slot.material.node_tree.nodes:
   if n.type=='TEX_COORD' and n.object is None:n.object=frame
# Bake groups separately to give hero props sufficient texel density.
baked=[]
for name,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objects:ob.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.object.join();ob=bpy.context.object;ob.name='Baked '+name
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 while ob.data.uv_layers:ob.data.uv_layers.remove(ob.data.uv_layers[0])
 ob.data.uv_layers.new(name='BakedSurface')
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
 bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.006)
 bpy.ops.object.mode_set(mode='OBJECT')
 size=2048 if name=='Room' else 4096
 im=bpy.data.images.new(name+' diffuse GI',width=size,height=size,alpha=False,float_buffer=True)
 im.colorspace_settings.name='sRGB'
 # Copies avoid assigning the atlas to shared live materials.
 for i,slot in enumerate(ob.material_slots):
  if not slot.material:continue
  slot.material=slot.material.copy();mat=slot.material
  node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;mat.node_tree.nodes.active=node
 print('BAKING',name,len(ob.data.polygons),flush=True)
 bpy.ops.object.bake(type='DIFFUSE')
 # Preserve highlight headroom instead of clipping diffuse radiance to 1.
 pixels=np.empty(len(im.pixels),dtype=np.float32);im.pixels.foreach_get(pixels)
 pixels.reshape(-1,4)[:,:3]/=4
 im.pixels.foreach_set(pixels);im.update()
 im.filepath_raw=ROOT+'/assets/lookdev/'+name.lower()+'-diffuse.png';im.file_format='PNG';im.save()
 normal=bpy.data.images.new(name+' surface normal',width=1024 if name=='Room' else 2048,height=1024 if name=='Room' else 2048,alpha=False)
 normal.colorspace_settings.name='Non-Color'
 for mat in ob.data.materials:
  if not mat:continue
  node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=normal;mat.node_tree.nodes.active=node
 bpy.ops.object.bake(type='NORMAL')
 normal.filepath_raw=ROOT+'/assets/lookdev/'+name.lower()+'-normal.png';normal.file_format='PNG';normal.save()
 baked.append((ob,im,normal))
# Keep the scene lighting unchanged until every bake finishes.
for ob,im,normal in baked:
 for mat in ob.data.materials:
  if not mat:continue
  nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
  rough=p.inputs['Roughness'].default_value
  coat=p.inputs['Coat Weight'].default_value;coat_rough=p.inputs['Coat Roughness'].default_value
  # The emission slot stores diffuse radiance; a dielectric lobe remains live.
  nodes.clear();p=nodes.new('ShaderNodeBsdfPrincipled');p.inputs['Base Color'].default_value=(0,0,0,1)
  p.inputs['Roughness'].default_value=rough;p.inputs['Emission Strength'].default_value=4
  p.inputs['Coat Weight'].default_value=coat;p.inputs['Coat Roughness'].default_value=coat_rough
  surface=nodes.new('ShaderNodeTexImage');surface.image=normal
  normal_node=nodes.new('ShaderNodeNormalMap');links.new(surface.outputs['Color'],normal_node.inputs['Color']);links.new(normal_node.outputs['Normal'],p.inputs['Normal'])
  tex=nodes.new('ShaderNodeTexImage');tex.image=im
  links.new(tex.outputs['Color'],p.inputs['Emission Color'])
  output=nodes.new('ShaderNodeOutputMaterial');links.new(p.outputs[0],output.inputs['Surface'])
# Undo the optical scale conversion, maintaining the existing gallery world contract.
for ob in scene.objects:
 if ob.parent is None:
  ob.location/=.15
  if ob.type not in {'LIGHT','CAMERA'}:ob.scale/=.15
for ob in list(scene.objects):
 if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
# Existing source anchors stay available for printing and gallery navigation.
def pos(p):return (p[0],-p[2],p[1])
bpy.data.objects['EntryView'].location=pos((1.6,1.55,7.5))
bpy.data.objects['EntryTarget'].location=pos((0,-.45,0))
bpy.data.objects['EntryPortrait'].location=pos((.55,1.5,8.8))
bpy.data.objects['CameraMount'].rotation_euler.z=math.radians(-9)
# Batch repeated outdoor parts by material to avoid thousands of draw calls.
for prefix in ['Garden','Individual garden','Leaf petiole']:
 objects=[o for o in scene.objects if o.type=='MESH' and o.name.startswith(prefix)]
 if not objects:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
for ob in list(scene.objects):
 if ob.name.startswith('Material coordinate frame'):bpy.data.objects.remove(ob,do_unlink=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=ROOT+'/assets/lookdev/runtime-staging.glb',export_format='GLB',export_apply=True,export_cameras=False,export_lights=False,export_image_format='AUTO')
print('LOOKDEV_RUNTIME_EXPORTED',flush=True)

# Denoise and compress only the UV light atlases; retain the actual scene geometry.
import runpy
runpy.run_path(ROOT+'/scripts/finish-lookdev.py',run_name='__main__',init_globals={'INPUT_GLB':ROOT+'/assets/lookdev/runtime-staging.glb'})
