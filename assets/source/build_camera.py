"""Original Sisi camera. Rebuild with Blender 4.3+ (bpy) and export editable source + glTF.
Coordinates in helpers: X right, Y up, Z toward viewer. No third-party model assets.
"""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def pos(p): return (p[0],-p[2],p[1])
def mat(name,color,rough=.4,metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=(*color,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
 return m
pink=mat('Shell | satin rose polymer',(.82,.43,.47),.3)
edge=mat('Seam | deep rose',(.32,.075,.105),.6)
lightpink=mat('Lens housing | blush',(.88,.51,.54),.28)
black=mat('Rubber | charcoal',(.014,.017,.021),.63)
metal=mat('Metal | brushed nickel',(.53,.48,.42),.26,.88)
glass=mat('Glass | coated optic',(.016,.035,.05),.08,.22)
flash=mat('Flash | translucent prism',(.74,.77,.76),.19,.15)
white=mat('Lettering | warm white',(.92,.83,.73),.6)
strapmat=mat('Strap | woven rose',(.38,.13,.17),.9)
SHARP_DEG=30
def mesh(name,vs,fs,m):
 me=bpy.data.meshes.new(name);me.from_pydata([pos(v) for v in vs],[],fs);me.update()
 uv=me.uv_layers.new(name='Surface grain coordinates')
 for loop in me.loops:
  v=vs[loop.vertex_index];uv.data[loop.index].uv=(v[0]*.25,v[1]*.25)
 ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.data.materials.append(m)
 for p in me.polygons:p.use_smooth=True
 # Hard edges where the surface turns more than ~30deg (glTF export splits normals there),
 # so caps, chamfers and lips stay crisp instead of smearing one smooth normal over a corner.
 me.set_sharp_from_angle(angle=math.radians(SHARP_DEG))
 return ob
# Continuous rounded superellipse cross-sections: corners and depth are modeled, not overlaid boxes.
def refine(profiles,steps=4):
 """Catmull-Rom resample of the (z,scale) profile: 4-5 coarse rings become ~16-20 smooth ones."""
 if len(profiles)<3:return list(profiles)
 P=[profiles[0]]+list(profiles)+[profiles[-1]];out=[]
 for k in range(1,len(P)-2):
  p0,p1,p2,p3=P[k-1],P[k],P[k+1],P[k+2]
  for s in range(steps):
   t=s/steps;t2=t*t;t3=t2*t
   out.append(tuple(.5*((2*p1[d])+(-p0[d]+p2[d])*t+(2*p0[d]-5*p1[d]+4*p2[d]-p3[d])*t2+(-p0[d]+3*p1[d]-3*p2[d]+p3[d])*t3) for d in (0,1)))
 out.append(profiles[-1]);return out
# Continuous rounded superellipse cross-sections: corners and depth are modeled, not overlaid boxes.
def shell(name,w,h,profiles,m,c=(0,.35,0),n=3.7,chamfer=.014):
 vs=[];N=96
 rings=refine(profiles)
 if chamfer and len(rings)>2:
  # Small 45deg chamfer ring at each open end so the cap edge catches a highlight.
  (z0,s0),(z1,s1)=rings[0],rings[-1];ds=2*chamfer/min(w,h)
  rings=[(z0,s0-ds),(z0+chamfer,s0)]+rings[1:-1]+[(z1-chamfer,s1),(z1,s1-ds)]
 for z,scale in rings:
  for i in range(N):
   a=2*math.pi*i/N;co=math.cos(a);si=math.sin(a)
   x=w*.5*math.copysign(abs(co)**(2/n),co)*scale
   y=h*.5*math.copysign(abs(si)**(2/n),si)*scale
   vs.append((c[0]+x,c[1]+y,c[2]+z))
 fs=[];R=len(rings)
 for j in range(R-1):
  for i in range(N):fs.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
 # Triangle-fan caps around a centre vertex instead of one 96-sided n-gon.
 vs.append((c[0],c[1],c[2]+rings[0][0]));a0=len(vs)-1
 vs.append((c[0],c[1],c[2]+rings[-1][0]));a1=len(vs)-1
 for i in range(N):
  fs.append(((i+1)%N,i,a0))
  fs.append(((R-1)*N+i,(R-1)*N+(i+1)%N,a1))
 return mesh(name,vs,fs,m)
shell('Rear housing',2.85,3.05,[(-.48,.78),(-.45,.88),(-.36,.97),(-.22,1),(.04,1)],pink)
shell('Precision shell seam',2.85,3.05,[(.041,1),(.055,1)],edge)
shell('Front continuous molded shell',2.85,3.05,[(.06,1),(.25,.995),(.40,.97),(.49,.91),(.525,.82)],pink)
def rounded(name,w,h,d,r,m,c):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos(c));o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 mod=o.modifiers.new('Manufactured edge radius','BEVEL');mod.width=r;mod.segments=5
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 mod=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
# The grip is inset into the curved shell, rather than a separate rectangular slab.
shell('Sculpted grip',.57,2.28,[(-.04,.9),(.03,1),(.12,.97),(.17,.8)],lightpink,(-1.02,.35,.38),3)
def lathe(name,profile,m,c=(.29,.05,.52),N=96):
 vs=[]
 for r,z in profile:
  for i in range(N):
   a=i*2*math.pi/N;vs.append((c[0]+r*math.cos(a),c[1]+r*math.sin(a),c[2]+z))
 fs=[]
 for j in range(len(profile)-1):
  for i in range(N):fs.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
 return mesh(name,vs,fs,m)
lathe('Lens foundation fillet',[(.91,0),(.93,.035),(.93,.10),(.89,.19),(.82,.24),(.45,.24)],lightpink)
lathe('Lens extending barrel',[(.8,.20),(.8,.32),(.78,.36),(.45,.36),(.43,.33)],pink)
lathe('Lens engraved seam',[(.786,.32),(.788,.327),(.788,.337),(.78,.34)],edge)
lathe('Lens black internal barrel',[(.45,.27),(.45,.37),(.43,.40),(.32,.40),(.29,.30)],black)
lathe('Thin anodized rim',[(.421,.38),(.424,.395),(.418,.405),(.405,.405)],metal)
lathe('Optic retaining ring',[(.335,.30),(.34,.36),(.32,.38),(.26,.38),(.24,.31)],black)
# A real convex surface; no artificial white glint mesh.
lathe('Convex lens glass',[(.0,.365),(.07,.363),(.14,.351),(.21,.33),(.255,.29)],glass)
for i in range(3):lathe('Internal optical ring '+str(i),[(.27+i*.023,.32),(.272+i*.023,.33)],black)
rounded('Flash gasket',.49,.90,.06,.10,edge,(-.37,1.22,.49))
rounded('Flash reflector',.43,.84,.09,.10,metal,(-.37,1.22,.535))
rounded('Flash prismatic cover',.36,.76,.075,.08,flash,(-.37,1.22,.60))
for i in range(11):rounded('Flash prism rib %02d'%i,.29,.013,.012,.005,white,(-.37,.9+i*.061,.645))
rounded('Viewfinder gasket',.27,.33,.055,.045,black,(-1.0,1.18,.57))
rounded('Viewfinder glass',.16,.22,.035,.025,glass,(-1,1.18,.605))
for i in range(2):lathe('Meter sensor '+str(i),[(0,0),(.06,0),(.065,.02),(.04,.035),(0,.035)],black,(.22,1.46-i*.20,.535),48)
lathe('Shutter surround',[(0,0),(.245,0),(.25,.05),(.22,.10),(.17,.10)],metal,(-.97,.48,.59))
lathe('Shutter button',[(0,.08),(.175,.08),(.18,.10),(.16,.14),(0,.15)],lightpink,(-.97,.48,.59))
rounded('Self portrait mirror',.17,.25,.04,.06,metal,(-.32,.06,.91))
rounded('Ejection port outer lip',2.14,.18,.15,.045,edge,(0,-.91,.42))
rounded('Ejection port dark cavity',2.02,.105,.17,.025,black,(0,-.91,.48))
# Separate lower trim masks the portion of paper still in the body.
rounded('Ejection port lower rail',2.14,.045,.13,.018,pink,(0,-1.0,.55))
def text(name,body,loc,size,m):
 curve=bpy.data.curves.new(name,'FONT');curve.body=body;curve.size=size;curve.extrude=.0005;curve.align_x='LEFT'
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.location=pos(loc);o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(m)
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
text('Sisi wordmark','SISI',(.55,1.32,.535),.23,white)
text('Model engraving','MOMENTS',(.55,1.13,.535),.075,white)
# Flat woven strap with a rectangular ribbon cross section along a smooth spline.
curve=bpy.data.curves.new('Wrist strap centerline','CURVE');curve.dimensions='3D';curve.resolution_u=20
sp=curve.splines.new('BEZIER');points=[(-1.39,.92,0),(-1.73,.5,.08),(-1.86,-.65,.1),(-1.68,-1.14,.42),(-1.40,-1.17,.55),(-1.53,-.60,.12),(-1.58,.45,.0),(-1.39,.92,0)]
sp.bezier_points.add(len(points)-1)
for b,p in zip(sp.bezier_points,points):b.co=pos(p);b.handle_left_type='AUTO';b.handle_right_type='AUTO'
curve.bevel_depth=.035;curve.bevel_resolution=3
ob=bpy.data.objects.new('Woven wrist strap',curve);bpy.context.collection.objects.link(ob);ob.data.materials.append(strapmat)
bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)
rounded('Wrist strap slider',.14,.39,.12,.035,lightpink,(-1.77,.08,.1))
# Runtime anchors export with the model and follow its physical scale.
anchor=bpy.data.objects.new('PrintSlot',None);bpy.context.collection.objects.link(anchor);anchor.location=pos((0,-.91,.57))
# Export source for future hand sculpting; no personal data or third-party assets.
bpy.ops.object.select_all(action='SELECT')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/source/sisi-camera.blend')
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/sisi-camera.glb',export_format='GLB',use_selection=True,export_apply=True)
print('Exported original Sisi camera')
