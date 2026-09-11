"""Rebuild Greenhaven's sculpted landscape and stonework in background Blender.

Run: blender --background --python scripts/world-assets/export-greenhaven.py
The renderer-neutral greenhaven.json owns paths, lake and solid rock footprints.
All exported roots are local meters; the runtime applies the A01 root once.
"""
import bpy
import json
import math
import os
import random

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
with open(os.path.join(ROOT, 'src/data/world/greenhaven.json')) as file:
    spec = json.load(file)
random.seed(spec['seed'])
bpy.ops.wm.read_factory_settings(use_empty=True)

def linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4

def color(hex_color):
    return tuple(linear(int(hex_color[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1,)

paint = bpy.data.materials.new('Greenhaven_EarthStoneAndLeaves')
paint.use_nodes = True
shader = paint.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = 0.94
attribute = paint.node_tree.nodes.new('ShaderNodeVertexColor')
attribute.layer_name = 'Color'
paint.node_tree.links.new(attribute.outputs['Color'], shader.inputs['Base Color'])

class Batch:
    def __init__(self, name):
        self.name, self.vertices, self.faces, self.colors = name, [], [], []

    def face(self, points, tint):
        start = len(self.vertices)
        # Blender Z up -> runtime Y up, north is negative runtime Z.
        self.vertices.extend((x, -z, y) for x, y, z in points)
        self.faces.append(tuple(range(start, start + len(points))))
        self.colors.append(color(tint))

    def finish(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.append(paint)
        colors = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
        for polygon, tint in zip(mesh.polygons, self.colors):
            for index in polygon.loop_indices:
                colors.data[index].color = tint
        ob = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(ob)
        return ob

cliffs = Batch('A01_SculptedCliffs')
stones = Batch('A01_HandLaidStonework')
plants = Batch('A01_MeadowAndGardens')
rock_colors = ['63675d', '777a6b', '8c8a77', '555d58', '9c9880', '6d7066']
moss_colors = ['778343', '879048', '626f3c', '9a9b52']
paver_colors = ['998565', 'ac956f', '8f8169', 'b8a27c', '9b9077', 'ab9c7c']

def rock(batch, x, z, radius, base, height, moss=True):
    count = random.choice([6, 7, 8])
    phase = random.random() * math.tau
    rim = [radius * random.uniform(0.8, 1) for _ in range(count)]
    rings = []
    for level, factor in [(0, 0.88), (0.37, 1), (0.83, 0.9), (1, 0.68)]:
        rings.append([(x + math.cos(phase + i * math.tau/count) * r * factor,
                       base + height * level + random.uniform(-0.08, 0.08) * height,
                       z + math.sin(phase + i * math.tau/count) * r * factor) for i, r in enumerate(rim)])
    for lower, upper in zip(rings, rings[1:]):
        for i in range(count):
            j = (i+1) % count
            batch.face([lower[j], lower[i], upper[i], upper[j]], random.choice(rock_colors))
    top = (x, base + height, z)
    for i in range(count):
        batch.face([top, rings[-1][(i+1) % count], rings[-1][i]], random.choice(moss_colors if moss else rock_colors))

# Large fractured rock faces frame the west gate. Each stays within its semantic
# footprint, including its smaller loose fragments.
for mass in spec['westRocks']:
    x, z = mass['center']
    r, h = mass['radius'], mass['height']
    rock(cliffs, x, z, r, -1.5, h)
    for _ in range(4):
        theta = random.random() * math.tau
        rock(cliffs, x + math.cos(theta)*r*0.58, z + math.sin(theta)*r*0.58, r*0.36, -0.4, h*random.uniform(0.3, 0.55))

# The southern escarpment drops away from the playable plateau. Its future bridge
# is only scenery; the existing world boundary still closes this edge.
edge = spec['plateau']['southEdge']
bottom = spec['plateau']['bottomHeight']
for index in range(39):
    x = -37 + index * 1.9
    if abs(x - spec['southBridge']['center'][0]) < spec['southBridge']['width']/2 + 0.7:
        continue
    rock(cliffs, x, edge + 1.3 + random.uniform(-0.2, 0.5), random.uniform(1.5, 2.2), bottom, -bottom + random.uniform(-0.25, 0.4))
    if index % 2 == 0:
        rock(cliffs, x, edge + 4.5, random.uniform(1.1, 1.8), bottom - 0.3, random.uniform(1.6, 3.7))

# Shore stones remain on the water side of the circular impassable footprint.
lake = spec['lake']
cx, cz = lake['center']
for index in range(52):
    theta = math.tau * index / 52
    r = lake['radius'] - 0.65
    x, z = cx + math.cos(theta)*r, cz + math.sin(theta)*r
    if z < lake['channelEdgeZ'] + 0.6 or x < -35:
        continue
    rock(cliffs, x, z, random.uniform(0.5, 0.95), -0.8, random.uniform(1, 2.25))

def catmull(points):
    """Centripetal Catmull-Rom, matching the production path interpolation."""
    result = []
    for i in range(len(points)-1):
        p1, p2 = points[i], points[i+1]
        p0 = points[i-1] if i else [2*p1[j]-p2[j] for j in range(2)]
        p3 = points[i+2] if i+2 < len(points) else [2*p2[j]-p1[j] for j in range(2)]
        dt0, dt1, dt2 = [max(0.0001, math.dist(a,b)**0.5) for a,b in [(p0,p1),(p1,p2),(p2,p3)]]
        for step in range(24):
            t = step / 24
            point = []
            for axis in range(2):
                a,b,c,d = p0[axis],p1[axis],p2[axis],p3[axis]
                m1 = ((b-a)/dt0 - (c-a)/(dt0+dt1) + (c-b)/dt1)*dt1
                m2 = ((c-b)/dt1 - (d-b)/(dt1+dt2) + (d-c)/dt2)*dt1
                point.append(b + m1*t + (-3*b+3*c-2*m1-m2)*t*t + (2*b-2*c+m1+m2)*t*t*t)
            result.append(point)
    return result + [points[-1]]

paths = [(catmull(road['points']), road['width']/2) for road in spec['roads']]
plaza = spec['plaza']

def distance_to_segment(x, z, a, b):
    dx, dz = b[0]-a[0], b[1]-a[1]
    t = max(0, min(1, ((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz or 1)))
    return math.hypot(x-a[0]-t*dx, z-a[1]-t*dz)

segments = [(a, b, width) for points, width in paths for a, b in zip(points, points[1:])]
# Spatial bins keep repeatable dense paving/foliage export quick.
bins = {}
for a,b,width in segments:
    for ix in range(math.floor((min(a[0],b[0])-width-2)/4), math.floor((max(a[0],b[0])+width+2)/4)+1):
        for iz in range(math.floor((min(a[1],b[1])-width-2)/4), math.floor((max(a[1],b[1])+width+2)/4)+1):
            bins.setdefault((ix,iz), []).append((a,b,width))

def path_distance(x,z):
    value = math.hypot(x-plaza['center'][0], z-plaza['center'][1]) - plaza['radius']
    for a,b,width in bins.get((math.floor(x/4),math.floor(z/4)), []):
        value = min(value, distance_to_segment(x,z,a,b)-width)
    return value

def paver(x,z,radius,tint):
    count = random.choice([5,6])
    angle = random.random() * math.tau
    rim = [(x+math.cos(angle+i*math.tau/count)*radius*random.uniform(0.8,1.1),
            0.1+random.uniform(0,0.012), z+math.sin(angle+i*math.tau/count)*radius*random.uniform(0.75,1)) for i in range(count)]
    for i in range(count):
        stones.face([(x,0.11,z),rim[(i+1)%count],rim[i]],tint)

for row in range(114):
    z = -28 + row*0.57
    for column in range(133):
        x = -39 + column*0.57 + (row%2)*0.285
        x += random.uniform(-0.13,0.13)
        zz = z+random.uniform(-0.1,0.1)
        if x < -36 or zz > 36:
            continue
        d = path_distance(x,zz)
        if d < -0.15 and random.random() > (0.06 if d < -0.5 else 0.3):
            paver(x,zz,random.uniform(0.23,0.37),random.choice(paver_colors))

# A continuous circular edging makes the fountain the organizing landmark.
for i in range(88):
    theta = i*math.tau/88
    paver(plaza['center'][0]+math.cos(theta)*plaza['radius'], plaza['center'][1]+math.sin(theta)*plaza['radius'],0.28,'b9a582')

def grass(x,z,height,tint):
    for angle in [random.random()*math.pi, random.random()*math.pi]:
        dx,dz = math.cos(angle)*height*0.24, math.sin(angle)*height*0.24
        plants.face([(x-dx,0.025,z-dz),(x+height*0.18,height,z),(x+dx,0.025,z+dz)],tint)
        plants.face([(x+dx,0.025,z+dz),(x+height*0.18,height,z),(x-dx,0.025,z-dz)],tint)

for _ in range(4200):
    x,z = random.uniform(-34,32),random.uniform(-29,35)
    if path_distance(x,z)<0.6 or math.hypot(x-cx,z-cz)<lake['radius']+0.6:
        continue
    grass(x,z,random.uniform(0.12,0.38),random.choice(['68733b','84914a','a4a359','596c37']))

for garden in spec['gardens']:
    x,z = garden['center']
    w,d = garden['width'],garden['depth']
    plants.face([(x-w/2,0.035,z-d/2),(x-w/2,0.035,z+d/2),(x+w/2,0.035,z+d/2),(x+w/2,0.035,z-d/2)],'68573c')
    for row in range(5):
        for column in range(7):
            gx,gz = x-w*0.4+column*w*0.8/6,z-d*0.4+row*d*0.8/4
            grass(gx,gz,0.45,random.choice(['7f9c46','a3af50','5e803b']))

def box(batch, x,y,z, w,h,d, tint):
    v=[(x+sx*w/2,y+sy*h/2,z+sz*d/2) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    for indices in [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7),(3,2,1,0)]:
        batch.face([v[i] for i in reversed(indices)],tint)

timber = ['71502e','89623a','a27c45','62482e']
# Small wayfinding lanterns follow the same authored lanes as the paving.
for road_index in [0,1,2,3]:
    points,width=paths[road_index]
    for index in range(30,len(points)-20,80):
        x,z=points[index]
        dx,dz=points[index+1][0]-points[index-1][0],points[index+1][1]-points[index-1][1]
        length=math.hypot(dx,dz)
        x,z=x-dz/length*(width+0.8),z+dx/length*(width+0.8)
        if abs(x)>34 or abs(z)>30 or math.hypot(x-plaza['center'][0],z-plaza['center'][1])<8:
            continue
        box(stones,x,1.35,z,0.15,2.7,0.15,'62482e')
        box(stones,x+0.25,2.6,z,0.75,0.14,0.18,'89623a')
        box(stones,x+0.5,2.25,z,0.34,0.46,0.34,'b29045')
        box(stones,x+0.5,2.51,z,0.46,0.13,0.46,'584631')
        box(stones,x+0.5,1.99,z,0.43,0.1,0.43,'584631')

# Closed scenic bridge at the southern world boundary; no walk-surface or unlock
# semantics are added for future areas.
future_bridge=Batch('A01_FutureBridge_South')
sx,sz=0,0
sw,sl=spec['southBridge']['width'],spec['southBridge']['length']
for i in range(21):
    box(future_bridge,sx,0.01,sz-sl/2+i*sl/20,sw,0.22,sl/22,random.choice(timber))
for sign in [-1,1]:
    x=sx+sign*sw/2
    box(future_bridge,x,-0.35,sz,0.25,0.45,sl+0.3,'62482e')
    for i in range(4):
        box(future_bridge,x,0.65,sz-sl/2+i*sl/3,0.25,1.8,0.25,'71502e')
    for h in [0.55,1.1]:
        box(future_bridge,x,h,sz,0.12,0.12,sl,'a27c45')
for i in range(9):
    box(future_bridge,sx-sw/2+0.2+i*(sw-0.4)/8,0.75,sz-sl/2,0.22,1.45,0.2,'71502e')

def export_objects(filename, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    output=os.path.join(ROOT,'public/assets/world/shared/models',filename)
    bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT',export_extras=True)
    print('GREENHAVEN_EXPORT', filename, os.path.getsize(output), flush=True)

landscape=[batch.finish() for batch in [cliffs,stones,plants]]
export_objects('greenhaven-landscape.glb',landscape)
export_objects('greenhaven-south-bridge.glb',[future_bridge.finish()])

boulder=Batch('Greenhaven_MossyBoulders')
rock(boulder,0,0,0.9,-0.2,1.3)
rock(boulder,0.5,0.25,0.42,-0.1,0.5)
export_objects('greenhaven-boulder.glb',[boulder.finish()])

for gate in [False,True]:
    batch=Batch('Greenhaven_LowTimberGate' if gate else 'Greenhaven_LowTimberFence')
    intervals=[(-2.7,-1.15),(1.15,2.7)] if gate else [(-2.7,0),(0,2.7)]
    posts=sorted(set(v for interval in intervals for v in interval))
    for x in posts:
        box(batch,x,0.55,0,0.22,1.1,0.22,'71502e')
        box(batch,x,1.12,0,0.27,0.1,0.27,'a27c45')
    for a,b in intervals:
        for h in [0.38,0.83]:
            box(batch,(a+b)/2,h,0,b-a,0.14,0.12,'89623a')
    export_objects('greenhaven-fence-gate.glb' if gate else 'greenhaven-fence.glb',[batch.finish()])

for variant,height in [('a',5.9),('b',7.1)]:
    batch=Batch('Greenhaven_LayeredPine_'+variant)
    box(batch,0,height*0.4,0,0.27,height*0.8,0.27,'62482e')
    # Open, asymmetric whorls leave the trunk visible between branch tiers.
    for tier in range(7):
        y=1.1+tier*(height-2)/6
        radius=(1-tier/8)*1.65*(height/6)
        count=10
        phase=tier*0.71
        rim=[]
        inner=[]
        for i in range(count):
            theta=phase+i*math.tau/count
            r=radius*(1 if i%2==0 else 0.62)*random.uniform(0.86,1.07)
            rim.append((math.cos(theta)*r,y+random.uniform(-0.16,0.06),math.sin(theta)*r))
            inner.append((math.cos(theta)*r*0.55,y+0.38,math.sin(theta)*r*0.55))
        tip=(0,y+1.65*(height/6),0)
        for i in range(count):
            j=(i+1)%count
            batch.face([rim[j],rim[i],inner[i],inner[j]],random.choice(['485d30','586d34','6f7938']))
            batch.face([inner[j],inner[i],tip],random.choice(['637438','7c8541','536934']))
            batch.face([rim[i],rim[j],(0,y+0.05,0)],'394e2c')
    export_objects('greenhaven-pine-'+variant+'.glb',[batch.finish()])

# Warm roof variants of the existing CC0 KayKit homes. Their geometry, pivots and
# normalized scale remain unchanged, so the existing semantic proxies apply.
for variant in ['a','b']:
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'public/assets/world/shared/models/keep-home-red-'+variant+'.glb'))
    imported=list(set(bpy.data.objects)-before)
    palette_images={node.image for ob in imported if ob.type=='MESH' for mat in ob.data.materials if mat and mat.use_nodes for node in mat.node_tree.nodes if node.type=='TEX_IMAGE' and node.image}
    for source_image in palette_images:
        pixels=list(source_image.pixels[:])
        for i in range(0,len(pixels),4):
            r,g,b=pixels[i:i+3]
            if r>0.35 and r>g*1.65 and r>b*1.6:
                pixels[i:i+3]=[r*0.72,max(g,r*0.38),max(b,r*0.14)]
        replacement=bpy.data.images.new('Greenhaven_WarmOak_'+variant,width=source_image.size[0],height=source_image.size[1],alpha=True)
        replacement.pixels.foreach_set(pixels)
        replacement.pack()
        for ob in imported:
            if ob.type!='MESH':
                continue
            for mat in ob.data.materials:
                if mat and mat.use_nodes:
                    for node in mat.node_tree.nodes:
                        if node.type=='TEX_IMAGE' and node.image==source_image:
                            node.image=replacement
    export_objects('greenhaven-home-'+variant+'.glb',imported)

source=os.path.join(ROOT,'authoring/local/greenhaven/greenhaven.blend')
os.makedirs(os.path.dirname(source),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=source)
print('GREENHAVEN_SOURCE',source,flush=True)
