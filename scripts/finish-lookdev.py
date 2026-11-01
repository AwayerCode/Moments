"""Denoise the baked UV atlases and pack JPEGs into the GLB (no geometry changes)."""
import bpy, os, struct, json
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path=ROOT+'/public/models/entry-scene.glb'
data=open(globals().get('INPUT_GLB',path),'rb').read();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);blob=data[28+length:]
scene=bpy.context.scene
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
cam=bpy.data.cameras.new('Bake post camera');o=bpy.data.objects.new('Bake post camera',cam);scene.collection.objects.link(o);scene.camera=o
scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.film_transparent=True
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
replacements={}
# Denoising normal maps corrupts tangent vectors. Only diffuse GI is color data.
light_images={doc['textures'][m['emissiveTexture']['index']]['source'] for m in doc.get('materials',[]) if 'emissiveTexture' in m}
for i,entry in enumerate(doc.get('images',[])):
 if i not in light_images or entry.get('mimeType')!='image/png':continue
 view=doc['bufferViews'][entry['bufferView']];start=view.get('byteOffset',0)
 source=ROOT+'/assets/lookdev/runtime-atlas-'+str(i)+'.png'
 open(source,'wb').write(blob[start:start+view['byteLength']])
 image=bpy.data.images.load(source)
 scene.render.resolution_x=image.size[0];scene.render.resolution_y=image.size[1];scene.render.resolution_percentage=100
 tree=bpy.data.node_groups.new('Atlas denoise','CompositorNodeTree');scene.compositing_node_group=tree
 tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
 src=tree.nodes.new('CompositorNodeImage');src.image=image
 denoise=tree.nodes.new('CompositorNodeDenoise')
 output=tree.nodes.new('NodeGroupOutput');tree.links.new(src.outputs['Image'],denoise.inputs['Image']);tree.links.new(denoise.outputs['Image'],output.inputs['Image'])
 scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=92
 dest=ROOT+'/assets/lookdev/runtime-atlas-'+str(i)+'.jpg'
 scene.render.filepath=dest
 bpy.ops.render.render(write_still=True)
 replacements[entry['bufferView']]=open(dest,'rb').read();entry['mimeType']='image/jpeg'
 scene.compositing_node_group=None;bpy.data.node_groups.remove(tree)
packed=bytearray()
for i,view in enumerate(doc['bufferViews']):
 while len(packed)%4:packed.append(0)
 source=replacements.get(i,blob[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
 view['byteOffset']=len(packed);view['byteLength']=len(source);packed.extend(source)
while len(packed)%4:packed.append(0)
doc['buffers'][0]['byteLength']=len(packed)
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
temporary=path+'.tmp'
with open(temporary,'wb') as f:
 f.write(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(packed)))
 f.write(struct.pack('<II',len(encoded),0x4e4f534a));f.write(encoded)
 f.write(struct.pack('<II',len(packed),0x004e4942));f.write(packed)
os.replace(temporary,path)
print('PACKED',os.path.getsize(path),flush=True)
