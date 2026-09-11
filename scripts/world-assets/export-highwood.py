"""Rebuild Area 2 through Blender MCP (or Blender --background --python).

Run this file with __file__ set via execute_blender_code. Creates an isolated scene;
never resets the open file. Shared highwood.json owns terrain/road/rock footprints.
Props reuse local CC0 KayKit geometry and the project's existing Greenhaven pines.
"""
import bpy
import json
import math
import os
import hashlib
import random
import re
import struct
import zipfile
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUTPUT = os.path.join(ROOT, 'public/assets/world/shared/models')
LOCAL = os.path.join(ROOT, 'authoring/local/highwood')
with open(os.path.join(ROOT, 'src/data/world/highwood.json')) as file:
    spec = json.load(file)
rng = random.Random(spec['seed'])
scene = bpy.data.scenes.new('Highwood_Authored')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1

def linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

def color(hex_color):
    return tuple(linear(int(hex_color[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1,)

paint = bpy.data.materials.new('Highwood_VertexPalette')
paint.use_nodes = True
shader = paint.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = 0.96
attribute = paint.node_tree.nodes.new('ShaderNodeVertexColor')
attribute.layer_name = 'Color'
paint.node_tree.links.new(attribute.outputs['Color'], shader.inputs['Base Color'])

class Batch:
    def __init__(self, name):
        self.name, self.vertices, self.faces, self.colors = name, [], [], []

    def face(self, points, tint):
        start = len(self.vertices)
        self.vertices.extend((x, -z, y) for x, y, z in points)
        self.faces.append(tuple(range(start, start + len(points))))
        self.colors.append(color(tint) if isinstance(tint, str) else tint)

    def finish(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.append(paint)
        colors = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
        for polygon, tint in zip(mesh.polygons, self.colors):
            for index in polygon.loop_indices:
                colors.data[index].color = tint
        ob = bpy.data.objects.new(self.name, mesh)
        scene.collection.objects.link(ob)
        return ob

exports = []
def export(filename, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    destination = os.path.join(OUTPUT, filename)
    bpy.ops.export_scene.gltf(filepath=destination, export_format='GLB', use_selection=True, use_active_scene=True,
                              export_yup=True, export_materials='EXPORT', export_extras=True)
    # Blender suffixes datablock names on repeated MCP runs. Keep shipped names
    # independent of whatever other authoring scenes are open in this session.
    with open(destination,'rb') as file:
        data=file.read()
    length=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+length])
    for kind in ['nodes','meshes','materials','scenes']:
        for entry in doc.get(kind,[]):
            if 'name' in entry:
                entry['name']=re.sub(r'\.\d{3}$','',entry['name'])
    encoded=json.dumps(doc,separators=(',',':')).encode()
    encoded+=b' '*((-len(encoded))%4)
    rest=data[20+length:]
    with open(destination,'wb') as file:
        file.write(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(rest)))
        file.write(struct.pack('<II',len(encoded),0x4e4f534a)+encoded+rest)
    exports.append({'file': filename, 'bytes': os.path.getsize(destination)})

def catmull(points):
    """Centripetal Catmull-Rom, matching Three's authored road interpolation."""
    result = []
    for i in range(len(points)-1):
        p1, p2 = points[i], points[i+1]
        p0 = points[i-1] if i else [2*p1[j]-p2[j] for j in range(2)]
        p3 = points[i+2] if i+2 < len(points) else [2*p2[j]-p1[j] for j in range(2)]
        dt0, dt1, dt2 = [max(0.0001, math.dist(a,b)**0.5) for a,b in [(p0,p1),(p1,p2),(p2,p3)]]
        for step in range(24):
            t, point = step/24, []
            for axis in range(2):
                a,b,c,d = p0[axis],p1[axis],p2[axis],p3[axis]
                m1 = ((b-a)/dt0 - (c-a)/(dt0+dt1) + (c-b)/dt1)*dt1
                m2 = ((c-b)/dt1 - (d-b)/(dt1+dt2) + (d-c)/dt2)*dt1
                point.append(b + m1*t + (-3*b+3*c-2*m1-m2)*t*t + (2*b-2*c+m1+m2)*t*t*t)
            result.append(point)
    return result + [points[-1]]

bins = {}
for road in spec['roads']:
    points, width = catmull(road['points']), road['width']/2
    for a,b in zip(points, points[1:]):
        for ix in range(math.floor((min(a[0],b[0])-width-2)/4), math.floor((max(a[0],b[0])+width+2)/4)+1):
            for iz in range(math.floor((min(a[1],b[1])-width-2)/4), math.floor((max(a[1],b[1])+width+2)/4)+1):
                bins.setdefault((ix,iz), []).append((a,b,width))

def path_distance(x,z):
    distance = 100
    for a,b,width in bins.get((math.floor(x/4),math.floor(z/4)), []):
        dx,dz = b[0]-a[0],b[1]-a[1]
        t = max(0,min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz or 1)))
        distance = min(distance, math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)-width)
    return distance

stonework = Batch('A02_WornStoneTrails')
cliffs = Batch('A02_FracturedRockFaces')
plants = Batch('A02_DryUndergrowth')

# The existing tiled forest material supplies fine soil detail and the playable
# fallback. Blender supplies relief, path stones and undergrowth above that floor.
g = spec['ground']

def paver(x,z,radius,tint):
    count, phase = rng.choice([5,6]), rng.random()*math.tau
    rim = [(x+math.cos(phase+i*math.tau/count)*radius*rng.uniform(.8,1.1),
            .105+rng.uniform(0,.008), z+math.sin(phase+i*math.tau/count)*radius*rng.uniform(.75,1)) for i in range(count)]
    for i in range(count):
        stonework.face([(x,.112,z),rim[(i+1)%count],rim[i]],tint)

for row in range(math.ceil((g['maxZ']-g['minZ']-2)/.76)):
    z = g['minZ']+2+row*.76
    for column in range(math.ceil((g['maxX']-g['minX']-2)/.76)):
        x = g['minX']+1+column*.76+(row%2)*.38+rng.uniform(-.15,.15)
        zz = z+rng.uniform(-.13,.13)
        d = path_distance(x,zz)
        if zz < g['maxZ']-.2 and d < -.15 and rng.random() > (.23 if d < -.5 else .52):
            paver(x,zz,rng.uniform(.26,.43),rng.choice(['81745b','91836a','736f5b','a09172','777864']))

def rock(x,z,radius,height):
    n, phase = 7, rng.random()*math.tau
    rims = [radius*rng.uniform(.77,.98) for _ in range(n)]
    rings=[]
    for level, factor in [(-.05,.8),(.3,1),(.76,.88),(1,.58)]:
        rings.append([(x+math.cos(phase+i*math.tau/n)*r*factor,
                       height*level+rng.uniform(-.025,.025)*height,
                       z+math.sin(phase+i*math.tau/n)*r*factor) for i,r in enumerate(rims)])
    for lower,upper in zip(rings,rings[1:]):
        for i in range(n):
            j=(i+1)%n
            cliffs.face([lower[j],lower[i],upper[i],upper[j]],rng.choice(['505853','626963','73786d','454e4c','838579']))
    for i in range(n):
        cliffs.face([(x,height,z),rings[-1][(i+1)%n],rings[-1][i]],rng.choice(['58603d','6a7047','757957','626956']))

ridge=spec['northRidge']
count=math.ceil(ridge['width']/4)
for i in range(count):
    left=ridge['center'][0]-ridge['width']/2+i*ridge['width']/count
    right=left+ridge['width']/count
    front=ridge['center'][1]+ridge['depth']/2
    back=ridge['center'][1]-ridge['depth']/2
    h=ridge['height']*rng.uniform(.65,1.2)
    a,b,c,d=(left,0,front),(right,0,front),(right,0,back),(left,0,back)
    aa,bb,cc,dd=(left,h,front-.4),(right,h*.8,front-.25),(right,h*1.1,back),(left,h*.9,back)
    for face in [[a,aa,bb,b],[b,bb,cc,c],[c,cc,dd,d],[d,dd,aa,a]]:
        cliffs.face(face,rng.choice(['505853','626963','73786d','454e4c']))
    cliffs.face([aa,dd,cc,bb],rng.choice(['58603d','6a7047','626956']))

for mass in spec['rockMasses']:
    x,z = mass['center']
    radius,height = mass['radius'],mass['height']
    rock(x,z,radius*.84,height)
    # Loose fragments remain entirely within the same authored solid footprint.
    for i in range(4):
        phase=rng.random()*math.tau
        rock(x+math.cos(phase)*radius*.38,z+math.sin(phase)*radius*.38,radius*.59,height*rng.uniform(.35,.72))

# Small broken stones soften the straight chunk edge without obstructing crossings.
for i in range(143):
    x=-72+i
    if path_distance(x,g['maxZ']-.2)<1.8:
        continue
    rock(x+rng.uniform(-.25,.25),g['maxZ']+rng.uniform(-.22,.22),rng.uniform(.25,.58),rng.uniform(.25,.65))

for _ in range(3400):
    x,z = rng.uniform(-72,73),rng.uniform(-24,17.5)
    if path_distance(x,z)<.5:
        continue
    height=rng.uniform(.14,.4)
    tint=rng.choice(['646748','787754','4d563b','80805b','575d42'])
    for angle in [rng.random()*math.pi, rng.random()*math.pi]:
        dx,dz=math.cos(angle)*height*.22,math.sin(angle)*height*.22
        points=[(x-dx,.03,z-dz),(x+height*.15,height,z),(x+dx,.03,z+dz)]
        plants.face(points,tint)
        plants.face(list(reversed(points)),tint)

landscape=[batch.finish() for batch in [stonework,cliffs,plants]]
export('highwood-landscape.glb',landscape)

# Extract only model dependencies and license text into the ignored source library.
source_root=os.path.join(LOCAL,'source')
os.makedirs(source_root,exist_ok=True)
with zipfile.ZipFile(os.path.join(ROOT,'source-assets/KayKit_Forest_Nature_Pack_1.0_FREE.zip')) as archive:
    for name in archive.namelist():
        if '/Assets/gltf/' in name or name.endswith('License.txt'):
            archive.extract(name,source_root)
    notice=archive.read('KayKit_Forest_Nature_Pack_1.0_FREE/License.txt')
with open(os.path.join(ROOT,'public/assets/world/shared/licenses/kaykit-highwood-cc0.txt'),'wb') as file:
    file.write(notice)
with zipfile.ZipFile(os.path.join(ROOT,'source-assets/kenney_fantasy-town-kit_2.0.zip')) as archive:
    archive.extract('Models/GLB format/roof-point.glb',os.path.join(source_root,'kenney'))
    notice=archive.read('License.txt')
with open(os.path.join(ROOT,'public/assets/world/shared/licenses/kenney-fantasy-town-cc0.txt'),'wb') as file:
    file.write(notice)

def imported_batch(source,name,scale,tint=None):
    before=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=source)
    imported=list(set(scene.objects)-before)
    bpy.context.view_layer.update()
    batch=Batch(name)
    for ob in imported:
        if ob.type!='MESH':
            continue
        mesh=ob.data
        vertex_colors=mesh.color_attributes.active_color
        for polygon in mesh.polygons:
            material=mesh.materials[polygon.material_index]
            principled=material.node_tree.nodes.get('Principled BSDF') if material.use_nodes else None
            base=tuple(principled.inputs['Base Color'].default_value) if principled else tuple(material.diffuse_color)
            if tint:
                base=color(tint)
            elif vertex_colors:
                base=tuple(vertex_colors.data[polygon.loop_start].color)
                # Cool and desaturate the already-authored Greenhaven pine palette.
                base=(base[0]*.65,base[1]*.7,base[2]*.8,1)
            points=[]
            for index in polygon.vertices:
                p=ob.matrix_world @ mesh.vertices[index].co
                points.append((p.x*scale,p.z*scale,-p.y*scale))
            batch.face(points,base)
    result=batch.finish()
    # Only disposable imports made by this invocation are removed.
    for ob in imported:
        bpy.data.objects.remove(ob,do_unlink=True)
    return result

for variant,source,scale in [('a','Tree_Bare_1_A_Color1.gltf',1.9),('b','Tree_Bare_1_B_Color1.gltf',1.75),('c','Tree_Bare_2_A_Color1.gltf',1.8)]:
    ob=imported_batch(os.path.join(source_root,'KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf',source),'Highwood_Leafless_'+variant,scale,'645844')
    export('highwood-bare-'+variant+'.glb',[ob])

for variant in ['a','b']:
    ob=imported_batch(os.path.join(OUTPUT,'greenhaven-pine-'+variant+'.glb'),'Highwood_ShadedPine_'+variant,1)
    export('highwood-pine-'+variant+'.glb',[ob])

lookout_source=os.path.join(source_root,'CygapExMf5.glb')
with open(lookout_source,'rb') as file:
    assert hashlib.sha256(file.read()).hexdigest() == '697dbc949daa279858e3e4ebed1b3039137bfb9e5be97d783be323a7786dd27f', 'Unexpected Quaternius lookout source'
watchtower=imported_batch(lookout_source,'Highwood_TimberWatchtower',6)
roof=imported_batch(os.path.join(source_root,'kenney/Models/GLB format/roof-point.glb'),'Highwood_LookoutRoof',3.3,'815b34')
roof.location.z=5.02
bpy.ops.object.select_all(action='DESELECT')
watchtower.select_set(True)
roof.select_set(True)
bpy.context.view_layer.objects.active=watchtower
bpy.ops.object.join()
export('highwood-watchtower.glb',[watchtower])

# Keep the editable terrain scene and local reusable prop sources without changing
# the user's active .blend filepath or overwriting any pre-existing scene.
source_file=os.path.join(LOCAL,'highwood.blend')
reusable=bpy.data.collections.new('Highwood_ReusableProps')
scene.collection.children.link(reusable)
for ob in list(scene.objects):
    if ob in landscape:
        continue
    for collection in list(ob.users_collection):
        collection.objects.unlink(ob)
    reusable.objects.link(ob)
reusable.hide_render=True
reusable.hide_viewport=True
bpy.data.libraries.write(source_file,{scene},fake_user=True,compress=True)
result={'scene':scene.name,'source':source_file,'exports':exports}
print(json.dumps(result))
