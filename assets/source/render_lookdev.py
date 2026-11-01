"""Non-destructive Cycles look-development assembly. Does not replace runtime assets."""
import bpy, math, os, random, runpy
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/assets/source/playroom.blend')
def pos(p):return (p[0],-p[2],p[1])
with bpy.data.libraries.load(ROOT+'/assets/source/sisi-camera.blend',link=False) as (src,dst):dst.objects=list(src.objects)
mount=bpy.data.objects['CameraMount']
for o in dst.objects:
 if o:bpy.context.collection.objects.link(o)
bpy.context.view_layer.update()
transforms=[(o,o.matrix_world.copy()) for o in dst.objects if o]
for o,matrix in transforms:o.matrix_world=mount.matrix_world @ matrix
bpy.context.view_layer.update()
# Correct the two roof slopes so their ridge meets over the house.
for o in bpy.data.objects:
 if o.name=='House roof':o.rotation_euler[1]=-math.pi/4
 if o.name=='House roof second':o.rotation_euler[1]=math.pi/4
# Fine-scale material variation, not large painted noise.
for m in bpy.data.materials:
 if not m.use_nodes:continue
 n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
 if not p:continue
 name=m.name.lower();tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=180;tex.inputs['Detail'].default_value=2
 coord=n.new('ShaderNodeTexCoord');l.new(coord.outputs['Object'],tex.inputs['Vector'])
 bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=.002;l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
 if 'birch' in name:
  mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1,35,14);l.new(coord.outputs['Object'],mapping.inputs[0]);l.new(mapping.outputs[0],tex.inputs['Vector']);tex.inputs['Scale'].default_value=3
  ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[0].color=(.38,.22,.10,1);ramp.color_ramp.elements[1].position=.82;ramp.color_ramp.elements[1].color=(.76,.56,.32,1);l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],p.inputs['Base Color']);p.inputs['Roughness'].default_value=.36
 elif 'polymer' in name or 'blush' in name:
  p.inputs['Coat Weight'].default_value=.22;p.inputs['Coat Roughness'].default_value=.28
 elif 'optic' in name:
  p.inputs['Transmission Weight'].default_value=.65;p.inputs['IOR'].default_value=1.48;bump.inputs['Strength'].default_value=0
 elif 'plaster' in name:bump.inputs['Distance'].default_value=.006;p.inputs['Roughness'].default_value=.92
# Soft plush companion with seams and embroidered face.
def material(name,color,rough=.7):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
fur=material('Cotton bunny oatmeal',(.78,.64,.49));dark=material('Embroidered cocoa',(.08,.035,.02));blush=material('Ear lining peach',(.76,.36,.34))
def ell(name,p,s,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=28,location=pos(p));o=bpy.context.object;o.name=name;o.scale=(s[0],s[2],s[1]);o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 return o
ell('Bunny body',(-1.48,-.96,-.38),(.29,.4,.23),fur)
ell('Bunny head',(-1.48,-.47,-.35),(.3,.28,.24),fur)
for x in [-1.76,-1.2]:ell('Bunny soft arm',(x,-.91,-.33),(.09,.23,.12),fur)
for x in [-1.62,-1.34]:
 ell('Bunny ear',(x,-.08,-.38),(.085,.32,.075),fur);ell('Peach stitched ear',(x,-.07,-.309),(.045,.23,.012),blush)
 ell('Bunny foot',(x,-1.29,-.2),(.12,.08,.17),fur)
 ell('Embroidered eye',(x,-.43,-.119),(.018,.023,.012),dark)
ell('Bunny nose',(-1.48,-.51,-.105),(.026,.018,.012),blush)
# Separate linen from painted wood and introduce gravity-shaped uneven folds.
linen=material('Warm woven linen',(.83,.77,.66),.87)
n=linen.node_tree.nodes;l=linen.node_tree.links;bs=n.get('Principled BSDF');bs.inputs['Sheen Weight'].default_value=.35
coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=210;noise.inputs['Detail'].default_value=2;l.new(coord.outputs['Object'],noise.inputs['Vector'])
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.0015;l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],bs.inputs['Normal'])
for ob in list(bpy.context.scene.objects):
 if ob.name.startswith('Continuous linen'):
  ob.data.materials.clear();ob.data.materials.append(linen)
  for v in ob.data.vertices:
   height=(3.7-v.co.z)/4.45
   v.co.y+=.055*math.sin(height*math.pi)*math.sin(v.co.x*11+height*3)
   v.co.x+=.035*math.sin(height*math.pi*1.4)
   if height>.85:v.co.z+=.018*math.sin(v.co.x*24)*(height-.85)/.15
 if ob.name.startswith('Curtain weighted hem'):ob.hide_render=True
# Lens coatings and differing plastic finishes establish material hierarchy.
for m in bpy.data.materials:
 if not m.use_nodes:continue
 bs=m.node_tree.nodes.get('Principled BSDF')
 if not bs:continue
 if 'polymer' in m.name.lower():bs.inputs['Roughness'].default_value=.24;bs.inputs['Coat Weight'].default_value=.32
 if 'blush' in m.name.lower():bs.inputs['Roughness'].default_value=.34
 if 'optic' in m.name.lower():bs.inputs['Base Color'].default_value=(.025,.05,.075,1);bs.inputs['Roughness'].default_value=.045
# Applied lettering on toy blocks: the objects now have identifiable scale.
letter=material('Toy printed cream',(.93,.85,.68),.65)
for body,location in [('A',(1.6,-1.12,.346)),('B',(2.13,-1.12,.446))]:
 c=bpy.data.curves.new('Toy letter '+body,'FONT');c.body=body;c.size=.25;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.001
 o=bpy.data.objects.new('Toy letter '+body,c);bpy.context.collection.objects.link(o);o.location=pos(location);o.rotation_euler=(math.pi/2,0,0);c.materials.append(letter)
# Short individual cotton fibers catch grazing light without a painted backdrop.
rng=random.Random(17)
fur.node_tree.nodes['Principled BSDF'].inputs['Sheen Weight'].default_value=.45
fiber=bpy.data.curves.new('Short cotton pile','CURVE');fiber.dimensions='3D';fiber.bevel_depth=.00065;fiber.bevel_resolution=0;fiber.resolution_u=1
bpy.context.view_layer.update()
for ob in list(bpy.context.scene.objects):
 if ob.type!='MESH' or not ob.data.materials or ob.data.materials[0]!=fur:continue
 for j in range(6500):
  z=rng.uniform(-1,1);a=rng.uniform(0,math.tau);v=Vector((math.sqrt(1-z*z)*math.cos(a),math.sqrt(1-z*z)*math.sin(a),z))
  start=ob.matrix_world @ v
  normal=(ob.matrix_world.to_3x3().inverted().transposed() @ v).normalized()
  sp=fiber.splines.new('POLY');sp.points.add(1)
  sp.points[0].co=(*start,1);sp.points[1].co=(*(start+normal*rng.uniform(.004,.009)),1)
o=bpy.data.objects.new('Bunny tactile cotton fibers',fiber);bpy.context.collection.objects.link(o);fiber.materials.append(fur)
# Physical joinery, screw heads and small rubber feet on the camera.
def line(name,points,radius,m):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=2
 sp=c.splines.new('POLY');sp.points.add(len(points)-1)
 for v,p in zip(sp.points,points):v.co=(*pos(p),1)
 ob=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(ob);c.materials.append(m)
 return ob
nickel=material('Satin nickel fasteners',(.35,.32,.28),.3);nickel.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.8
for x in [-.43,.43]:
 ell('Recessed camera fastener',(x,-1.12,.28),(.023,.023,.009),nickel)
 line('Fastener slot',[(x-.012,-1.12,.291),(x+.012,-1.12,.291)],.002,dark)
# Fine stitched center line on the plush body.
for j in range(17):
 y=-1.22+j*.021
 line('Cotton seam stitch',[(-1.487,y,-.151),(-1.473,y+.007,-.151)],.0015,fur)
# Distant garden: branching stems and individual leaves, all geometry.
leafm=[material('Garden leaf '+str(i),c,.7) for i,c in enumerate([(.16,.32,.12),(.28,.43,.18),(.38,.5,.23)])]
bark=material('Garden fine branches',(.19,.12,.06),.9)
# Smooth tapered branches with leaf blades attached by petioles.
for tx in [-5.8,-4.3,4.5,6.1]:
 trunk=[]
 for k in range(25):
  t=k/24;trunk.append((tx+.22*math.sin(t*3),-3+8*t,-9-.8*t))
 branch=line('Garden stem',trunk,.035,bark)
 for k,v in enumerate(branch.data.splines[0].points):v.radius=1-.7*k/24
 for j in range(8):
  t=.22+j*.085;base=Vector((tx+.22*math.sin(t*3),-3+8*t,-9-.8*t))
  side=(-1)**j;tip=base+Vector((side*rng.uniform(.65,1.3),rng.uniform(.35,.65),-.3))
  branchpts=[base.lerp(tip,k/16)+Vector((0,.10*math.sin(k/16*math.pi),0)) for k in range(17)]
  branch=line('Garden branch',branchpts,.008,bark)
  for k,v in enumerate(branch.data.splines[0].points):v.radius=1-.85*k/16
  for k in range(2,16):
   root=branchpts[k];direction=Vector((side*.10,.08,(-1)**k*.12));leafbase=root+direction
   line('Leaf petiole',[root,leafbase],.002,bark)
   axis=Vector((side*rng.uniform(.08,.18),rng.uniform(.10,.23),(-1)**k*rng.uniform(.06,.15)));cross=axis.cross(Vector((0,0,1))).normalized()*rng.uniform(.035,.065)
   vertices=[];faces=[]
   for q in range(9):
    f=q/8;mid=leafbase+axis*f+Vector((0,0,.022*math.sin(f*math.pi)))
    for sign in [-1,1]:vertices.append(pos(mid+cross*math.sin(f*math.pi)*sign))
   for q in range(8):faces.append((q*2,q*2+1,q*2+3,q*2+2))
   mesh=bpy.data.meshes.new('Curved leaf blade');mesh.from_pydata(vertices,[],faces);mesh.update()
   ob=bpy.data.objects.new('Individual garden leaf',mesh);bpy.context.collection.objects.link(ob);mesh.materials.append(rng.choice(leafm))
   for face in mesh.polygons:face.use_smooth=True
# Hide geometric placeholder garden; the window receives a soft daylight field.
for o in bpy.data.objects:
 if o.name.startswith('Distant garden'):o.hide_render=True
runpy.run_path(ROOT+'/assets/source/lookdev_styling.py')['style_scene'](globals())
scene=bpy.context.scene
world=bpy.data.worlds.new('Daylight studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.69,.82,1,1);world.node_tree.nodes['Background'].inputs[1].default_value=.2;scene.world=world
# Bright sky seen through the window, modest ambient illumination inside.
n=world.node_tree.nodes;l=world.node_tree.links;sky=n.new('ShaderNodeBackground');sky.inputs[0].default_value=(.7,.83,1,1);sky.inputs[1].default_value=1.25;path=n.new('ShaderNodeLightPath');mix=n.new('ShaderNodeMixShader');l.new(path.outputs['Is Camera Ray'],mix.inputs[0]);l.new(n['Background'].outputs[0],mix.inputs[1]);l.new(sky.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],n.get('World Output').inputs['Surface'])
for o in list(scene.objects):
 if o.type in {'LIGHT','CAMERA'}:bpy.data.objects.remove(o,do_unlink=True)
def area(name,p,target,power,size,color):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos(p);o.rotation_euler=(Vector(pos(target))-o.location).to_track_quat('-Z','Y').to_euler()
area('Large soft window',(-3,3.6,-1.8),(0,-1,0),1050,2.3,(1,.88,.73))
area('Cool room bounce',(3,2.5,4),(0,-.7,0),35,4,(.84,.9,1))
area('Front reflected daylight',(-3,1.8,4),(0,-.7,0),65,3,(1,.91,.83))
area('Narrow window reflection',(-2.6,2.2,2),(0,-.5,0),95,1.4,(1,.96,.88))
if os.environ.get('LOOKDEV_COURTYARD') == '1':area('Outdoor daylight',(-10,16,-12),(0,0,-32),12000,9,(1,.94,.81))
area('Mushroom warm pool',(2.3,.154,-1.5),(2.3,-1.35,-1.5),18,.45,(1,.65,.32))
d=bpy.data.cameras.new('Lookdev camera');camera=bpy.data.objects.new('Lookdev camera',d);scene.collection.objects.link(camera);camera.location=pos((1.6,1.55,7.5));target=Vector(pos((0,-.45,0)));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();d.lens=46;d.dof.use_dof=True;d.dof.focus_distance=(target-camera.location).length;d.dof.aperture_fstop=5.6;scene.camera=camera
# Convert the modeling units into real furniture scale for optical depth of field.
bpy.context.view_layer.update()
for ob in scene.objects:
 if ob.parent is None:
  ob.location *= .15
  if ob.type not in {'LIGHT','CAMERA'}:ob.scale *= .15
 if ob.type=='LIGHT':ob.data.energy *= .15**2
 if ob.type=='LIGHT' and ob.data.type=='AREA':ob.data.size *= .15
camera.data.dof.focus_distance *= .15
camera.data.clip_start=.005
scene.render.engine='CYCLES';scene.cycles.samples=int(os.environ.get("LOOKDEV_SAMPLES","128"));scene.cycles.use_denoising=True
scene.render.resolution_x=1800;scene.render.resolution_y=1286;scene.render.resolution_percentage=int(os.environ.get("LOOKDEV_PERCENT","100"))
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.render.image_settings.file_format='PNG';scene.render.filepath=ROOT+'/assets/lookdev/entry-cycles.png'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/lookdev/entry-lookdev.blend')
bpy.ops.render.render(write_still=True)
