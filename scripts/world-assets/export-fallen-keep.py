"""Export the Fallen Keep through Blender MCP, in an isolated editable scene.

The shared fallen-keep.json supplies every masonry footprint and terrain lane.
Existing KayKit rubble is placed by the runtime; Kenney's demolished catapult is
the only new upstream model. No open scene or original asset is overwritten.
"""
import bpy
import hashlib
import json
import math
import os
import random
import re
import struct
import sys
import zipfile
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUTPUT = os.path.join(ROOT, 'public/assets/world/shared/models')
LOCAL = os.path.join(ROOT, 'authoring/local/fallen-keep')
with open(os.path.join(ROOT, 'src/data/world/fallen-keep.json')) as file:
    spec = json.load(file)
with open(os.path.join(ROOT, 'src/data/world/area4-blockout.json')) as file:
    area4 = json.load(file)
rift_north = area4['rift']['seamZ'] - area4['rift']['depth'] / 2
landscape_only = '--landscape-only' in sys.argv
scene = bpy.data.scenes.new('FallenKeep_Authored')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
rng = random.Random(spec['seed'])

def linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

def color(hex_color):
    return tuple(linear(int(hex_color[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1,)

paint = bpy.data.materials.new('FallenKeep_WeatheredStone')
paint.use_nodes = True
shader = paint.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = 0.96
attribute = paint.node_tree.nodes.new('ShaderNodeVertexColor')
attribute.layer_name = 'Color'
paint.node_tree.links.new(attribute.outputs['Color'], shader.inputs['Base Color'])
STONE = ['696d68', '767c76', '83867c', '8a8b80', '73786f', '949386', '646b68']
MOSS = ['58613f', '646947', '71754e', '4b573b']
PAVING = ['82867c', '7b8076', '8b8d80', '757c73', '929184']

class Batch:
    def __init__(self, name):
        self.name, self.vertices, self.faces, self.colors = name, [], [], []

    def face(self, points, tint):
        if self.name in ['A03_WornPavingAndCourts', 'A03_MossAndDryWeeds'] and max(p[2] for p in points) >= rift_north:
            return
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
    if landscape_only and filename != 'fallen-keep-landscape.glb':
        return
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    destination = os.path.join(OUTPUT, filename)
    bpy.ops.export_scene.gltf(filepath=destination, export_format='GLB', use_selection=True,
                              use_active_scene=True, export_yup=True, export_extras=True)
    # Stable names on repeated MCP runs, regardless of other open datablocks.
    with open(destination, 'rb') as file:
        data = file.read()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+length])
    for kind in ['nodes', 'meshes', 'materials', 'scenes']:
        for entry in doc.get(kind, []):
            if 'name' in entry:
                entry['name'] = re.sub(r'\.\d{3}$', '', entry['name'])
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    rest = data[20+length:]
    with open(destination, 'wb') as file:
        file.write(struct.pack('<III', 0x46546c67, 2, 20+len(encoded)+len(rest)))
        file.write(struct.pack('<II', len(encoded), 0x4e4f534a)+encoded+rest)
    exports.append({'file': filename, 'bytes': os.path.getsize(destination)})

def transform(point, center, angle):
    x, y, z = point
    return (center[0]+x*math.cos(angle)+z*math.sin(angle), y,
            center[1]-x*math.sin(angle)+z*math.cos(angle))

def brick(batch, x, y, z, width, height, depth, tint, angle=0, center=(0, 0)):
    """Small chamfered masonry, batched without per-brick scene objects."""
    bevel = min(.08, width*.12, depth*.12)
    a, b = width/2, depth/2
    ring = [(-a+bevel,-b),(a-bevel,-b),(a,-b+bevel),(a,b-bevel),
            (a-bevel,b),(-a+bevel,b),(-a,b-bevel),(-a,-b+bevel)]
    low = [transform((x+u, y, z+v), center, angle) for u,v in ring]
    high = [transform((x+u*.94+rng.uniform(-.025,.025), y+height+rng.uniform(-.028,.028), z+v*.94), center, angle) for u,v in ring]
    batch.face(high[::-1], tint)
    batch.face(low, tint)
    for i in range(8):
        j = (i+1)%8
        batch.face([low[i], high[i], high[j], low[j]], tint)

def flagstone(batch, x, z, width, depth, elevation=.088):
    """Thin irregular polygons avoid the regular tiles of the first iteration."""
    angle=rng.uniform(-.12,.12)
    corners=[(-.48,-.32),(-.33,-.49),(.38,-.47),(.5,-.24),(.46,.35),(.25,.5),(-.39,.45),(-.5,.18)]
    points=[]
    for u,v in corners:
        u=(u+rng.uniform(-.055,.055))*width
        v=(v+rng.uniform(-.055,.055))*depth
        points.append((x+u*math.cos(angle)-v*math.sin(angle),elevation,z+u*math.sin(angle)+v*math.cos(angle)))
    batch.face(points[::-1],rng.choice(PAVING))

def masonry(batch, segment, seed=1):
    """Footprint comes directly from the semantic collision segment."""
    local = random.Random(seed)
    width, depth, height = segment['width'], segment['depth'], segment['height']
    angle, center = segment.get('rotation', 0), segment.get('center', [0, 0])
    phase = local.random()*6
    def crest(x):
        wave = .78+.14*math.sin(x*.73+phase)+.08*math.cos(x*2.1-phase)
        breach = max(0, 1-abs(x-width*.12)/max(1,width*.28))*.48
        return max(.95, height*(wave-breach))
    course = .46
    rows = math.ceil(height/course)
    for row in range(rows):
        x = -width/2
        while x < width/2-.03:
            length = min(width/2-x, local.uniform(.65,1.04) if x != -width/2 else (.4 if row%2 else .85))
            middle = x+length/2
            y = row*course
            top = min(y+course-.024, crest(middle))
            window = False
            if segment.get('windows') and 1.45 < y < min(4.5,height*.72):
                # Narrow lancet openings with stepped, pointed heads.
                aperture = .5 if y < 2.9 else max(.12, .5-(y-2.9)*.5)
                window = abs((middle+1.65)%3.3-1.65) < aperture
            if top-y > .12 and not window:
                tint = local.choice(MOSS if row < 2 and local.random() < .28 else STONE)
                brick(batch, middle, y, 0, max(.05,length-.018), top-y, depth, tint, angle, center)
            x += length

def tower(batch):
    data = spec['corner']['tower']
    cx, cz = data['center']
    radius = data['radius']
    for row in range(math.ceil(data['height']/.55)):
        count = 14
        for i in range(count):
            angle = 2*math.pi*(i+(row%2)*.5)/count
            height = data['height']*(.75+.17*math.sin(angle*3)+.08*math.cos(angle*7))
            if row*.55 > height or (row>3 and row<8 and i in [2,7,11]):
                continue
            outer, inner = radius, radius-.65
            start, end = angle-math.pi/count+.006, angle+math.pi/count-.006
            points = [(cx+math.cos(a)*r, cz+math.sin(a)*r) for r,a in
                      [(inner,start),(outer,start),(outer,end),(inner,end)]]
            low = [(x,row*.55,z) for x,z in points]
            high = [(x,row*.55+.52,z) for x,z in points]
            tint = rng.choice(STONE)
            batch.face(high[::-1],tint)
            for j in range(4):
                k=(j+1)%4
                batch.face([low[j],high[j],high[k],low[k]],tint)

reusable = []
for variant, seed in [('a',731),('b',284)]:
    batch=Batch('FallenKeep_CollapsedCurtain_'+variant)
    masonry(batch,{**spec['wall'],'center':[0,0]},seed)
    ob=batch.finish(); reusable.append(ob)
    export('fallen-keep-wall-'+variant+'.glb',[ob])

batch=Batch('FallenKeep_ShatteredCornerTower')
for index, arm in enumerate(spec['corner']['arms']):
    # Normalize the narrow arm to a wall along local X without changing its proxy.
    segment={**arm,'height':5.8}
    if arm['width']<arm['depth']:
        segment.update(width=arm['depth'],depth=arm['width'],rotation=arm['rotation']+math.pi/2)
    masonry(batch,segment,830+index)
tower(batch)
ob=batch.finish(); reusable.append(ob); export('fallen-keep-corner.glb',[ob])

batch=Batch('FallenKeep_BreachedGatehouse')
gate=spec['gate']; wing=(gate['width']-gate['opening'])/2
for side in [-1,1]:
    center=[side*(gate['opening']+wing)/2,0]
    masonry(batch,{'center':center,'width':wing,'depth':gate['depth'],'height':gate['height']},910+side)
    # Blue, ragged remnants of the castle's livery on both faces.
    x=center[0]
    for z in [-.57,.57]:
        batch.face([(x-.38,3.5,z),(x+.38,3.5,z),(x+.35,1.95,z),(x+.06,2.13,z),(x-.31,1.86,z)],'355777')
        brick(batch,x,3.5,z,.95,.12,.13,'82765a')
# The surviving arch sits above the actual walkable opening.
for i in range(11):
    a=math.pi*i/11; b=math.pi*(i+1)/11
    r=gate['opening']/2
    front=[(math.cos(a)*r,2.2+math.sin(a)*r,-.56),(math.cos(b)*r,2.2+math.sin(b)*r,-.56),
           (math.cos(b)*(r+.43),2.2+math.sin(b)*(r+.43),-.56),(math.cos(a)*(r+.43),2.2+math.sin(a)*(r+.43),-.56)]
    back=[(x,y,.56) for x,y,z in front]
    tint=rng.choice(STONE)
    batch.face(front,tint); batch.face(back[::-1],tint)
    for j in range(4): batch.face([front[j],back[j],back[(j+1)%4],front[(j+1)%4]],tint)
ob=batch.finish(); reusable.append(ob); export('fallen-keep-gate.glb',[ob])

for index,(key,shell) in enumerate(spec['shells'].items()):
    batch=Batch('FallenKeep_Roofless_'+key)
    for j,segment in enumerate(shell['segments']): masonry(batch,segment,1050+index*30+j*4)
    # Flush floors remain at the simulation floor; no decorative stairs to climb.
    w,d=shell['floor']
    for ix in range(math.ceil(w/1.2)):
        for iz in range(math.ceil(d/1.2)):
            x=-w/2+(ix+.5)*w/math.ceil(w/1.2)
            z=-d/2+(iz+.5)*d/math.ceil(d/1.2)
            if rng.random()<.12: continue
            flagstone(batch,x,z,w/math.ceil(w/1.2)-.025,d/math.ceil(d/1.2)-.025,.095)
    ob=batch.finish(); reusable.append(ob); export('fallen-keep-'+key+'.glb',[ob])

# Terrain detail: eroded paving, open courts, moss seams and an outer cliff plinth.
# Base cobblestone terrain remains available if the cosmetic export fails to load.
paving=Batch('A03_WornPavingAndCourts')
plants=Batch('A03_MossAndDryWeeds')
cliffs=Batch('A03_OuterRockPlinth')
# Reuse the project's accepted cobblestone texture as a cool, desaturated soil
# dressing. This disposable image copy never edits the source JPEG.
soil_image=bpy.data.images.load(os.path.join(ROOT,'public/assets/world/shared/textures/terrain-cobble-color.jpg'),check_existing=False)
soil_image.name='FallenKeep_AshenCobblestone'
soil_image.scale(512,512)
pixels=list(soil_image.pixels)
for i in range(0,len(pixels),4):
    luminance=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722
    value=.10+.64*luminance
    pixels[i:i+3]=[value*.94,value,value*.91]
soil_image.pixels.foreach_set(pixels)
soil_image.pack()
soil_material=bpy.data.materials.new('FallenKeep_AshSoil')
soil_material.use_nodes=True
soil_shader=soil_material.node_tree.nodes.get('Principled BSDF')
soil_shader.inputs['Roughness'].default_value=.98
soil_texture=soil_material.node_tree.nodes.new('ShaderNodeTexImage')
soil_texture.image=soil_image
soil_material.node_tree.links.new(soil_texture.outputs['Color'],soil_shader.inputs['Base Color'])
ground_batch=Batch('A03_AshenGround')
ground_batch.face([(-35.5,.077,-33.4),(-35.5,.077,rift_north),(37,.077,rift_north),(37,.077,-33.4)],'ffffff')
ground=ground_batch.finish()
ground.data.materials.clear(); ground.data.materials.append(soil_material)
uv=ground.data.uv_layers.new(name='UVMap')
for loop in ground.data.loops:
    p=ground.data.vertices[loop.vertex_index].co
    uv.data[loop.index].uv=(p.x/5,p.y/5)
def distance_to_path(x,z):
    distance=100
    for road in spec['roads']:
        for a,b in zip(road['points'],road['points'][1:]):
            dx,dz=b[0]-a[0],b[1]-a[1]
            t=max(0,min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)))
            distance=min(distance,math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)-road['width']/2)
    for court in spec['courts']:
        distance=min(distance,math.hypot(x-court['center'][0],z-court['center'][1])-court['radius'])
    return distance

for ix in range(57):
    for iz in range(55):
        x=-34+ix*1.2+rng.uniform(-.08,.08); z=-32+iz*1.2+rng.uniform(-.08,.08)
        path=distance_to_path(x,z)
        if path<0 and rng.random()>.13:
            # Flat tops avoid implying unsupported changes in walkable elevation.
            flagstone(paving,x,z,rng.uniform(1.04,1.25),rng.uniform(1.02,1.22))
        elif path>1 and rng.random()<.11:
            r=rng.uniform(.3,.8)
            points=[(x+math.cos(i*math.pi/3)*r,.08,z+math.sin(i*math.pi/3)*r) for i in range(6)]
            plants.face(points[::-1],rng.choice(MOSS))
            for j in range(3):
                dx=rng.uniform(-.2,.2); dz=rng.uniform(-.2,.2); h=rng.uniform(.15,.4)
                plants.face([(x+dx-.06,.08,z+dz),(x+dx,h,z+dz),(x+dx+.06,.08,z+dz)],'77734d')

# The south cliff follows the shared rift edge and leaves its bridge lane clear.
for side in ['east','south']:
    cliff=spec['outerCliff']
    for i in range(cliff['rockCount']):
        along=cliff['rockStart']+i*cliff['rockStep']
        if side == 'east' and along > rift_north:
            continue
        if side == 'south' and abs(along - area4['crossings']['fallenKeepLocalX']) < area4['bridge']['width']/2 + 2.2:
            continue
        x,z=(cliff['rockCenter'],along) if side=='east' else (along,rift_north + cliff['rockCenter'] - cliff['edge'])
        rx,rz=(2.7,1.7) if side=='east' else (1.7,2.7)
        ring=[(x+math.cos(j*math.pi/4)*rx*rng.uniform(.85,1.1),z+math.sin(j*math.pi/4)*rz*rng.uniform(.85,1.1)) for j in range(8)]
        top=[(u,rng.uniform(-.18,.32),v) for u,v in ring]
        middle=[(x+(u-x)*rng.uniform(.8,1.1),-2.1+rng.uniform(-.4,.3),z+(v-z)*rng.uniform(.85,1.1)) for u,v in ring]
        low=[(x+(u-x)*.82,cliff['base']-.2,z+(v-z)*.82) for u,v in ring]
        cliffs.face(top[::-1],rng.choice(MOSS))
        for lower,upper in [(low,middle),(middle,top)]:
            for j in range(8):
                k=(j+1)%8
                cliffs.face([lower[j],upper[j],upper[k],lower[k]],rng.choice(STONE))
landscape=[ground,paving.finish(),plants.finish(),cliffs.finish()]
export('fallen-keep-landscape.glb',landscape)
if landscape_only:
    source_file = os.path.join(LOCAL, 'fallen-keep-landscape.blend')
    bpy.data.libraries.write(source_file, {scene}, fake_user=True, compress=True)
    print('FALLEN_KEEP_LANDSCAPE_EXPORT', exports, flush=True)
    sys.exit(0)

# Reuse the free asset found during the source review, with its actual UV palette.
archive_path=os.path.join(LOCAL,'source/kenney_castle-kit.zip')
with open(archive_path,'rb') as file:
    assert hashlib.sha256(file.read()).hexdigest()=='921f3f73927bb23106cae34bc21d5ab4b033a9fc120475e96f714a406e3169df', 'Unexpected Kenney source'
with zipfile.ZipFile(archive_path) as archive:
    for name in ['Models/GLB format/siege-catapult-demolished.glb','Models/GLB format/Textures/colormap.png']:
        archive.extract(name,os.path.join(LOCAL,'source/kenney'))
    with open(os.path.join(ROOT,'public/assets/world/shared/licenses/kenney-castle-cc0.txt'),'wb') as file:
        file.write(archive.read('License.txt'))
before=set(scene.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(LOCAL,'source/kenney/Models/GLB format/siege-catapult-demolished.glb'))
imported=list(set(scene.objects)-before)
for ob in imported:
    if ob.parent is None: ob.scale*=2
reusable.extend(imported)
export('fallen-keep-siege-debris.glb',imported)

collection=bpy.data.collections.new('FallenKeep_ReusableMasonry')
scene.collection.children.link(collection)
for ob in reusable:
    for original in list(ob.users_collection): original.objects.unlink(ob)
    collection.objects.link(ob)
collection.hide_render=True
collection.hide_viewport=True
source_file=os.path.join(LOCAL,'fallen-keep.blend')
bpy.data.libraries.write(source_file,{scene},fake_user=True,compress=True)
result={'scene':scene.name,'source':source_file,'exports':exports}
