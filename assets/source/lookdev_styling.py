"""Additional modeled props for the Cycles composition; called by render_lookdev.py."""
def style_scene(ctx):
 import bpy, math, random, os
 from mathutils import Vector, Matrix
 pos,material,ell,line=[ctx[k] for k in ('pos','material','ell','line')]
 rng=random.Random(51)
 def box(name,p,s,m,r=.015):
  bpy.ops.mesh.primitive_cube_add(size=1,location=pos(p));o=bpy.context.object;o.name=name;o.dimensions=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
  bevel=o.modifiers.new('Soft manufactured edge','BEVEL');bevel.width=r;bevel.segments=4
  o.modifiers.new('Face normals','WEIGHTED_NORMAL');return o
 cream=material('Book paper ivory',(.82,.77,.66),.85)
 salmon=material('Book cloth peach',(.52,.19,.16),.85)
 blue=material('Book cloth dusty blue',(.24,.42,.43),.8)
 brass=material('Warm brushed brass',(.48,.31,.12),.32);brass.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.82
 enamel=material('Lamp painted butter',(.84,.65,.34),.27)
 # Replace the tall cropped block-house with a warm reading corner.
 for o in list(bpy.context.scene.objects):
  if o.name.startswith(('Toy house','House roof')):o.hide_render=True
 for i,(m,w) in enumerate([(salmon,1.25),(blue,1.13)]):
  cy=-1.35+i*.16
  box('Storybook pages',(2.18,cy+.08,-.82),(w,.115,.85),cream,.012)
  for y in [cy+.012,cy+.148]:box('Cloth bound book cover',(2.18,y,-.82),(w+.06,.025,.9),m,.012)
  box('Book rounded spine',(2.18,cy+.08,-.355),(w+.06,.14,.04),m,.015)
  for j in range(8):box('Paper leaf edges',(2.18,cy+.026+j*.012,-.386),(w-.06,.001,.008),cream,.001)
 # Mushroom bedside lamp, with a hollow metal shade and warm underside.
 ell('Lamp weighted base',(2.3,-.98,-.85),(.32,.065,.28),enamel)
 line('Lamp stem',[(2.3,-.94,-.85),(2.3,.15,-.85)],.035,brass)
 verts=[];faces=[];segments=96;rings=18
 for j in range(rings):
  t=j/(rings-1);r=.06+.52*math.sin(t*math.pi/2);y=.62-.47*t
  for k in range(segments):
   a=k*math.tau/segments;verts.append(pos((2.3+r*math.cos(a),y,-.85+r*math.sin(a))))
 for j in range(rings-1):
  for k in range(segments):a=j*segments+k;b=j*segments+(k+1)%segments;faces.append((a,b,b+segments,a+segments))
 mesh=bpy.data.meshes.new('Spun mushroom shade');mesh.from_pydata(verts,[],faces);mesh.update();ob=bpy.data.objects.new('Mushroom shade',mesh);bpy.context.collection.objects.link(ob);mesh.materials.append(enamel)
 for face in mesh.polygons:face.use_smooth=True
 solid=ob.modifiers.new('Metal thickness','SOLIDIFY');solid.thickness=.012
 glow=material('Warm lamp diffuser',(.95,.76,.48),.4);bs=glow.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.64,.29,1);bs.inputs['Emission Strength'].default_value=2
 ell('Lamp opal diffuser',(2.3,.155,-.85),(.5,.018,.5),glow)
 # Loose blank instant prints: no personal images or fabricated family photos.
 edge=material('Photo paper edge',(.92,.89,.8),.55);image=material('Unexposed silver film',(.09,.13,.14),.19)
 for i in range(3):
  group=bpy.data.objects.new('Loose print '+str(i),None);bpy.context.collection.objects.link(group);group.location=pos((.8,-1.34+i*.011,1.03));group.rotation_euler.z=.18-i*.14
  for name,p,s,m in [('Paper',(0,0,0),(.48,.008,.64),edge),('Film',(0,.005,-.035),(.40,.002,.46),image)]:
   ob=box(name,p,s,m,.003);ob.parent=group
 # Small stitched cloth at the lower left introduces soft foreground depth.
 textile=material('Woven muslin peach',(.66,.36,.29),.94);bs=textile.node_tree.nodes.get('Principled BSDF');bs.inputs['Sheen Weight'].default_value=.5
 n=textile.node_tree.nodes;l=textile.node_tree.links;c=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=260;l.new(c.outputs['Object'],noise.inputs['Vector']);b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=.3;b.inputs['Distance'].default_value=.002;l.new(noise.outputs['Fac'],b.inputs['Height']);l.new(b.outputs['Normal'],bs.inputs['Normal'])
 vs=[];fs=[];N=55
 for j in range(N):
  v=j/(N-1)
  for i in range(N):
   u=i/(N-1);x=-3.3+u*1.6;length=v*2.3
   ripple=.004*(1+math.sin(u*25+v*12))
   if length<=1.6:
    z=.65+length;y=-1.337+ripple
   else:
    arc=min((length-1.6)/.12,math.pi/2)
    z=2.25+.12*math.sin(arc)
    y=-1.337-.12*(1-math.cos(arc))-max(0,length-1.6-.12*math.pi/2)+ripple
   vs.append(pos((x,y,z)))
 for j in range(N-1):
  for i in range(N-1):a=j*N+i;fs.append((a,a+1,a+N+1,a+N))
 me=bpy.data.meshes.new('Muslin folds');me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('Draped muslin cloth',me);bpy.context.collection.objects.link(o);me.materials.append(textile)
 for f in me.polygons:f.use_smooth=True
 mod=o.modifiers.new('Thin woven fabric','SOLIDIFY');mod.thickness=.004
 # A woven flat wrist ribbon replaces the round cord placeholder.
 original=bpy.data.objects.get('Woven wrist strap')
 if original:original.hide_render=True
 ribbonmat=material('Rose woven wrist ribbon',(.42,.16,.19),.86)
 bs=ribbonmat.node_tree.nodes.get('Principled BSDF');bs.inputs['Sheen Weight'].default_value=.4
 ns=ribbonmat.node_tree.nodes;ls=ribbonmat.node_tree.links;coord=ns.new('ShaderNodeTexCoord');wave=ns.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction='Z';wave.inputs['Scale'].default_value=160;ls.new(coord.outputs['Generated'],wave.inputs['Vector']);bump=ns.new('ShaderNodeBump');bump.inputs['Distance'].default_value=.0008;bump.inputs['Strength'].default_value=.3;ls.new(wave.outputs['Color'],bump.inputs['Height']);ls.new(bump.outputs[0],bs.inputs['Normal'])
 pts=[Vector(p) for p in [(-.81,-.3,.02),(-1.00,-.65,.16),(-1.12,-1.12,.42),(-1.07,-1.29,.60),(-.91,-1.29,.64),(-.89,-.95,.34),(-.86,-.5,.12),(-.81,-.3,.02)]]
 pts=[pts[0]]+pts+[pts[-1]];points=[]
 for j in range(1,len(pts)-2):
  a,b,c,d=pts[j-1:j+3]
  for k in range(16):
   t=k/16;points.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
 verts=[];faces=[]
 for j,p in enumerate(points):
  tangent=(points[min(j+1,len(points)-1)]-points[max(j-1,0)]).normalized();width=Vector((0,0,1)).cross(tangent).normalized()*.025
  for sign in [-1,1]:verts.append(pos(p+sign*width))
 for j in range(len(points)-1):faces.append((j*2,j*2+1,j*2+3,j*2+2))
 me=bpy.data.meshes.new('Flat ribbon weave');me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new('Woven ribbon replacement',me);bpy.context.collection.objects.link(ob);me.materials.append(ribbonmat)
 mod=ob.modifiers.new('Woven thickness','SOLIDIFY');mod.thickness=.003
 for f in me.polygons:f.use_smooth=True
 ctx['transforms'].append((ob,ob.matrix_world.copy()))
 # Polycarbonate flash cover with transparent ribs over the reflector.
 for m in bpy.data.materials:
  if 'translucent prism' in m.name.lower():
   bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.87,.91,.95,1);bs.inputs['Transmission Weight'].default_value=.75;bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.12;bs.inputs['IOR'].default_value=1.49
 # Lens lettering is geometry on the physical barrel.
 labelmat=material('Lens grey lettering',(.56,.56,.52),.65)
 for text,px,py in [('60 mm',.09,-.91),('SISI OPTICS',.08,-.36)]:
  c=bpy.data.curves.new('Lens markings','FONT');c.body=text;c.size=.029;c.align_x='CENTER';c.extrude=.0001
  ob=bpy.data.objects.new('Lens printed specification',c);bpy.context.collection.objects.link(ob);ob.location=pos((px,py,.445));ob.rotation_euler=(math.pi/2,0,0);c.materials.append(labelmat)
  bpy.context.view_layer.update();ctx['transforms'].append((ob,ob.matrix_world.copy()))
 # Small functional details at the correct world scale on the camera body.
 seam=material('Battery door seam',(.2,.07,.08),.7)
 for points in [[(.63,-1.07,-.08),(.66,-1.07,.08),(.66,-.49,.08),(.63,-.49,-.08)]]:
  ob=line('Side battery door joint',points,.003,seam);ob.hide_render=True;bpy.context.view_layer.update();ctx['transforms'].append((ob,ob.matrix_world.copy()))
 for k in range(9):
  y=-.87+k*.038
  ob=line('Fine molded grip rib',[(-.59,y,.275),(-.49,y,.285)],.0018,ctx['blush']);bpy.context.view_layer.update();ctx['transforms'].append((ob,ob.matrix_world.copy()))
 for k in range(64):
  a=k*math.tau/64;r=.209
  ob=line('Optical retaining knurl',[(.105+r*math.cos(a),-.735+r*math.sin(a),.46),(.105+(r+.005)*math.cos(a),-.735+(r+.005)*math.sin(a),.46)],.0008,labelmat);bpy.context.view_layer.update();ctx['transforms'].append((ob,ob.matrix_world.copy()))
 # Optional courtyard study; excluded from the selected composition.
 before_courtyard=set(bpy.context.scene.objects)
 # Distant full-geometry courtyard; softly out of focus behind the room.
 facade=material('Courtyard limewash',(.76,.69,.54),.94)
 roofmat=material('Courtyard clay roof',(.38,.19,.12),.85)
 shutter=material('Courtyard sage shutters',(.22,.34,.28),.65)
 glazing=material('Distant blue window glass',(.18,.29,.35),.18)
 ground=material('Courtyard sandstone',(.52,.49,.35),.9)
 box('Courtyard ground',(0,-4.15,-25),(80,.2,60),ground,.01)
 for hx,hz,h in [(-9,-32,6),(-1,-39,7.5),(9,-35,6.8)]:
  box('Distant courtyard house',(hx,h/2-4,hz),(6,h,4),facade,.04)
  # Solid triangular roof prism.
  vs=[pos((hx+x,h-4+y,hz+z)) for x,y,z in [(-3.25,0,-2.3),(3.25,0,-2.3),(0,1.9,-2.3),(-3.25,0,2.3),(3.25,0,2.3),(0,1.9,2.3)]]
  me=bpy.data.meshes.new('Pitched roof');me.from_pydata(vs,[],[(0,2,1),(3,4,5),(0,1,4,3),(0,3,5,2),(1,2,5,4)]);me.update();o=bpy.data.objects.new('Clay courtyard roof',me);bpy.context.collection.objects.link(o);me.materials.append(roofmat)
  for x in [-1.7,1.7]:
   for y in [-2,.3,2.5]:
    if y>h-4-.4:continue
    box('Distant window glass',(hx+x,y,hz+2.04),(1.15,1.35,.04),glazing,.01)
    for sx in [-.72,.72]:box('Sage window shutter',(hx+x+sx,y,hz+2.08),(.27,1.48,.07),shutter,.015)
    for sx in [-.6,0,.6]:box('Window frame',(hx+x+sx,y,hz+2.1),(.055,1.45,.07),cream,.008)
    for sy in [-.7,0,.7]:box('Window transom',(hx+x,y+sy,hz+2.1),(1.22,.045,.07),cream,.008)
 if os.environ.get("LOOKDEV_COURTYARD") != "1":
  for ob in set(bpy.context.scene.objects)-before_courtyard:ob.hide_render=True
 # Keep complete assemblies above support surfaces; avoid coplanar faces.
 for ob in bpy.context.scene.objects:
  if ob.name.startswith(('Bunny','Peach stitched','Embroidered','Cotton seam')):
   ob.location.x += .15;ob.location.z += .035
  if ob.name.startswith(('Rounded toy block','Stacking toy','Stacking ring')):ob.location.z += .001
  if ob.name.startswith(('Cloth bound book','Storybook','Book rounded','Paper leaf')):ob.location.z += .002;ob.location.y += .65
  if ob.name.startswith(('Lamp weighted','Lamp stem','Mushroom shade','Lamp opal')):ob.location.z += .024;ob.location.y += .65
 # A small attachment eye joins the ribbon to the body; only this joint is embedded.
 eye=line('Wrist attachment eye',[(-.73,-.3,.01),(-.80,-.28,.01),(-.84,-.30,.01),(-.80,-.33,.01),(-.73,-.3,.01)],.009,brass)
 bpy.context.view_layer.update();ctx['transforms'].append((eye,eye.matrix_world.copy()))
 # Turn the camera slightly so side thickness and joinery become visible.
 center=Vector(pos((-.04,-1.35,0)));transform=Matrix.Translation(center) @ Matrix.Rotation(math.radians(-9),4,'Z') @ Matrix.Translation(-center)
 for ob,_ in ctx['transforms']:ob.matrix_world=transform @ ob.matrix_world
 for ob in bpy.context.scene.objects:
  if ob.name.startswith(('Recessed camera fastener','Fastener slot')):ob.matrix_world=transform @ ob.matrix_world
