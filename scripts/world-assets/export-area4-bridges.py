"""Author the approved S2/W2 bridges and gates in isolated Blender scenes.

Metres in the renderer-neutral X/Y/Z convention; exported roots stay local.
No terrain, throne or existing masonry asset is rewritten. Run through Blender
MCP or blender --background --python scripts/world-assets/export-area4-bridges.py.
"""
import bpy
import bmesh
import hashlib
import json
import math
import os
import random
import re
import struct
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LOCAL = os.path.join(ROOT, 'authoring/local/area4/models')
OUTPUT = os.path.join(ROOT, 'public/assets/world/shared/models')
os.makedirs(LOCAL, exist_ok=True)
os.makedirs(OUTPUT, exist_ok=True)
with open(os.path.join(ROOT, 'src/data/world/area4-blockout.json')) as f:
    world = json.load(f)
with open(os.path.join(ROOT, 'src/data/world/area4-bridges.json')) as f:
    detail = json.load(f)
with open(os.path.join(ROOT, 'src/data/world/fallen-keep.json')) as f:
    keep = json.load(f)
bridge = world['bridge']
HALF = bridge['deckLength'] / 2
END = HALF + bridge['approachLength']
WIDTH = bridge['width']
DECK = bridge['deckHeight']
rng = random.Random(240913)
created_scenes, reports = [], []


def xyz(point):
    x, y, z = point
    return (x, -z, y)


def rgba(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values) + (1,)


def material(name, roughness, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'Color'
    mat.node_tree.links.new(vertex.outputs['Color'], shader.inputs['Base Color'])
    return mat


PAINT = material('Area4_BoneAndTimber', .92)
IRON = material('Area4_ForgedIron', .72, .3)
BONE = ['c4b79d', 'd1c3a8', 'bbae96', 'd8ccb5', 'b1a58f', 'e0d2b6']
METAL = ['343b3d', '414747', '4c5150', '292f32', '50524c']
WOOD = ['665b4c', '766956', '89775f', '94816a', '5d5549', 'a08c70']
CHAR = ['363836', '42443e', '4e4d44', '555348', '3e403c']
ROPE = ['a18f70', 'b4a07b', '8a7b62']


def scene_for(name):
    scene = bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    created_scenes.append(scene)
    return scene


def empty(name, parent=None, position=(0, 0, 0), occluder=False):
    ob = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    ob.location = xyz(position)
    if occluder:
        ob['cameraOccluder'] = True
    return ob


class Batch:
    def __init__(self, name, mat=PAINT):
        self.name, self.mat = name, mat
        self.vertices, self.faces, self.colors = [], [], []

    def face(self, points, tint):
        start = len(self.vertices)
        self.vertices.extend(points)
        self.faces.append(tuple(range(start, start + len(points))))
        self.colors.append(rgba(tint))

    def finish(self, parent, pivot=(0, 0, 0)):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata([xyz(tuple(p[i] - pivot[i] for i in range(3))) for p in self.vertices], [], self.faces)
        mesh.materials.append(self.mat)
        colors = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
        for poly, tint in zip(mesh.polygons, self.colors):
            for i in poly.loop_indices:
                colors.data[i].color = tint
        # Join identical corners so closed components get consistent outward normals.
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        ob = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = parent
        return ob


def box(batch, center, size, tint, angle=0):
    x, y, z = center
    a, b, c = [v / 2 for v in size]
    corners = [(-a,-b,-c),(a,-b,-c),(a,-b,c),(-a,-b,c),(-a,b,-c),(a,b,-c),(a,b,c),(-a,b,c)]
    points = [(x+u*math.cos(angle)+w*math.sin(angle), y+v, z-u*math.sin(angle)+w*math.cos(angle)) for u,v,w in corners]
    for face in [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]:
        batch.face([points[i] for i in face], tint)


def tube(batch, points, radii, palette, sides=8, irregular=False):
    rings = []
    for i, p in enumerate(points):
        p = Vector(p)
        tangent = (Vector(points[min(i+1,len(points)-1)]) - Vector(points[max(0,i-1)])).normalized()
        guide = Vector((0,0,1)) if abs(tangent.z) < .92 else Vector((0,1,0))
        a = tangent.cross(guide).normalized()
        b = tangent.cross(a).normalized()
        radius = radii[i] if isinstance(radii, list) else radii
        rings.append([tuple(p + (a*math.cos(j*2*math.pi/sides) + b*math.sin(j*2*math.pi/sides))*radius*(rng.uniform(.90,1.10) if irregular else 1)) for j in range(sides)])
    batch.face(rings[0][::-1], palette[0])
    batch.face(rings[-1], palette[-1])
    for i in range(len(rings)-1):
        for j in range(sides):
            k = (j+1) % sides
            batch.face([rings[i][j], rings[i][k], rings[i+1][k], rings[i+1][j]], rng.choice(palette))


def ellipsoid(batch, center, scale, palette, segments=8):
    x,y,z = center
    points, radii = [], []
    for i in range(7):
        a = -.5*math.pi + i*math.pi/6
        points.append((x,y+math.sin(a)*scale[1],z))
        radii.append(max(.01,math.cos(a)))
    # A Y-axis tube, anisotropically stretched in its rings.
    start = len(batch.vertices)
    tube(batch, points, radii, palette, segments, True)
    for i in range(start, len(batch.vertices)):
        u,v,w = batch.vertices[i]
        batch.vertices[i] = (x+(u-x)*scale[0],v,z+(w-z)*scale[2])


def bezier(points, count=18):
    p = [Vector(v) for v in points]
    return [tuple(p[0]*(1-t)**3+p[1]*3*t*(1-t)**2+p[2]*3*t*t*(1-t)+p[3]*t**3) for t in [i/(count-1) for i in range(count)]]


def floor(z):
    return DECK * min(1, max(0, (END-abs(z))/bridge['approachLength']))


def deck_tile(batch, x, z0, z1, width, tint, depth=.14, top_offset=0):
    a=width/2
    bevel=.025
    ring=[(-a+bevel,z0), (a-bevel,z0), (a,z0+bevel), (a,z1-bevel), (a-bevel,z1), (-a+bevel,z1), (-a,z1-bevel), (-a,z0+bevel)]
    top=[(x+u, floor(z)+top_offset, z) for u,z in ring]
    low=[(u,y-depth,z) for u,y,z in top]
    batch.face(top[::-1],tint)
    batch.face(low,tint)
    for j in range(8):
        k=(j+1)%8
        batch.face([low[j],top[j],top[k],low[k]],tint)


def deck(batch, metal=False):
    for start,end in [(-END,-HALF),(-HALF,HALF),(HALF,END)]:
        # Thin seams have a continuous support layer directly beneath them.
        deck_tile(batch,0,start,end,WIDTH, METAL[0] if metal else CHAR[0],.20,-.012)
        count=round((end-start)/(.6 if metal else .36))
        for i in range(count):
            z0=start+i*(end-start)/count+.008
            z1=start+(i+1)*(end-start)/count-.008
            if metal:
                for j in range(3):
                    deck_tile(batch,(j-1)*WIDTH/3,z0,z1,WIDTH/3-.012,rng.choice(METAL),.105)
            else:
                deck_tile(batch,0,z0,z1,WIDTH-.006,rng.choice(WOOD if i%6 not in [0,1] else CHAR),.14)
                for j in range(2):
                    u=rng.uniform(-1.5,1.5)
                    length=rng.uniform(.35,.9)
                    zz=rng.uniform(z0+.04,z1-.04)
                    batch.face([(u,floor(zz)+.002,zz),(min(1.68,u+length),floor(zz)+.002,zz),(u+.1,floor(zz+.012)+.002,zz+.012)],rng.choice(CHAR))


def rivet(batch, x,y,z, radius=.045):
    tube(batch,[(x,y,z-.017),(x,y,z+.017)],radius,[METAL[2]],6)


def vertebrae(batch, zs, height):
    for i,z in enumerate(zs):
        ellipsoid(batch,(0,height,z),(.30,.23,.34),BONE)
        for side in [-1,1]:
            tube(batch,[(0,height,z),(side*.42,height+.11,z+.035)], [.19,.075],BONE,7,True)
        tube(batch,[(0,height+.1,z),(0,height+.48,z-.1),(0,height+.54,z-.23)],[.15,.09,.025],BONE,7,True)


def export(scene, root, filename):
    bpy.context.window.scene=scene
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [root]+list(root.children_recursive):
        ob.select_set(True)
    bpy.context.view_layer.objects.active=root
    destination=os.path.join(OUTPUT,filename)
    bpy.ops.export_scene.gltf(filepath=destination,export_format='GLB',use_selection=True,
        use_active_scene=True,export_yup=True,export_extras=True,export_animations=False,
        export_materials='EXPORT',export_normals=True)
    with open(destination,'rb') as f:
        data=f.read()
    length=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+length])
    for kind in ['nodes','meshes','materials','scenes']:
        for item in doc.get(kind,[]):
            if 'name' in item:
                item['name']=re.sub(r'\.\d{3}$','',item['name'])
    encoded=json.dumps(doc,separators=(',',':')).encode()
    encoded+=b' '*((-len(encoded))%4)
    rest=data[20+length:]
    with open(destination,'wb') as f:
        f.write(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(rest)))
        f.write(struct.pack('<II',len(encoded),0x4e4f534a)+encoded+rest)
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    reports.append({'file':filename,'triangles':triangles,'materials':len(doc['materials']),'bytes':os.path.getsize(destination),
        'nodes':[n.get('name') for n in doc['nodes']],'textures':len(doc.get('images',[]))})


# S2: a long rib cage with clear space beneath widely spaced arches.
scene=scene_for('Area4_S2_Bridge')
root=empty('S2_RibVaultBridge')
body=Batch('S2_IronDeckAndRails',IRON)
deck(body,True)
for side in [-1,1]:
    x=side*(WIDTH/2+bridge['railThickness']/2)
    for start,end in [(-END,-HALF),(-HALF,HALF),(HALF,END)]:
        tube(body,[(x,floor(start)-.12,start),(x,floor(end)-.12,end)],.15,[METAL[0]],4)
        tube(body,[(x,floor(start)+.9,start),(x,floor(end)+.9,end)],.075,METAL,4)
    for z in [-HALF,-3,0,3,HALF]:
        box(body,(x,DECK+.44,z),(.13,.95,.15),METAL[1])
body.finish(root)
vault=empty('S2_RibVault_Occluder',root,occluder=True)
bones=Batch('S2_AncientRibs')
bands=Batch('S2_RibIronBindings',IRON)
spec=detail['skeletal']
for index in range(spec['ribPairs']):
    z=-HALF+index*bridge['deckLength']/(spec['ribPairs']-1)
    height=spec['crownHeight']-(.22 if index in [0,spec['ribPairs']-1] else 0)
    for side in [-1,1]:
        points=bezier([(side*spec['ribHalfWidth'],DECK-.05,z),
            (side*2.52,2.8,z+.06),(side*1.24,height,z-.09),(0,height,z)])
        radii=[spec['ribRadius']*(1.12-.42*i/(len(points)-1)) for i in range(len(points))]
        tube(bones,points,radii,BONE,9,True)
        ellipsoid(bones,(side*spec['ribHalfWidth'],DECK+.15,z),(.35,.31,.32),BONE)
        for j in [1,3]:
            a,b=points[j],points[j+1]
            tube(bands,[a,b],[radii[j]+.05,radii[j+1]+.05],METAL,8)
        box(bands,(side*spec['ribHalfWidth'],DECK+.13,z),(.70,.47,.68),METAL[0])
        for dx in [-.23,.23]:
            rivet(bands,side*spec['ribHalfWidth']+dx,DECK+.17,z-.35,.052)
        # A broad worn fracture mark on the front face, not high-frequency texture.
        p,q=points[5],points[8]
        bones.face([(p[0]-.025,p[1],p[2]-.24),(q[0],q[1],q[2]-.22),(p[0]+.025,p[1]+.03,p[2]-.24)],BONE[4])
vertebrae(bones,[-HALF+.18+i*.72 for i in range(17)],spec['crownHeight']-.02)
bones.finish(vault)
bands.finish(vault)
export(scene,root,'area4-s2-rib-vault.glb')


def gate_leaves(root, prefix, hinge_x, hinge_z, bottom, top_at, thickness, bone=False):
    for side,label in [(-1,'Left'),(1,'Right')]:
        pivot=(side*hinge_x,0,hinge_z)
        hinge=empty(prefix+'_Gate'+label,root,pivot)
        wood=Batch(prefix+'_'+label+'_Bone' if bone else prefix+'_'+label+'_Timber')
        iron=Batch(prefix+'_'+label+'_Iron',IRON)
        x0,x1=sorted((side*hinge_x,side*.024))
        if bone:
            # Substantial lower plate with barred upper half.
            box(iron,((x0+x1)/2,bottom+.44,hinge_z),(x1-x0,.88,thickness),METAL[1])
            for i in range(7):
                x=x0+(i+.5)*(x1-x0)/7
                ytop=top_at(x)
                box(iron,(x,(bottom+.72+ytop)/2,hinge_z),(.073,ytop-bottom-.72,.09),METAL[1])
            points=bezier([(x0+.12,bottom+1.55,hinge_z-.12),(x0+.6,bottom+1.03,hinge_z-.18),
                (x1-.4,bottom+1.08,hinge_z-.18),(x1-.12,bottom+1.54,hinge_z-.12)],10)
            tube(wood,points,[.095-i*.003 for i in range(10)],BONE,7,True)
        else:
            count=7
            for i in range(count):
                a=x0+i*(x1-x0)/count+.008
                b=x0+(i+1)*(x1-x0)/count-.008
                # Individually shaped plank tops follow the existing round arch.
                corners=[(a,bottom,hinge_z-thickness/2),(b,bottom,hinge_z-thickness/2),
                    (b,top_at(b),hinge_z-thickness/2),(a,top_at(a),hinge_z-thickness/2)]
                back=[(x,y,hinge_z+thickness/2) for x,y,z in corners]
                tint=rng.choice(CHAR+WOOD[:2])
                wood.face(corners,tint)
                wood.face(back[::-1],tint)
                for k in range(4):
                    n=(k+1)%4
                    wood.face([corners[k],back[k],back[n],corners[n]],tint)
        for x in [x0+.045,x1-.045]:
            box(iron,(x,(bottom+top_at(x))/2,hinge_z-.035),(.09,top_at(x)-bottom,.13),METAL[0])
        top_points=[(x0+i*(x1-x0)/10,top_at(x0+i*(x1-x0)/10)-.045,hinge_z-.045) for i in range(11)]
        tube(iron,top_points,.063,METAL,4)
        for y in [bottom+.18,bottom+.86,bottom+1.73]:
            box(iron,((x0+x1)/2,y,hinge_z-.1),(x1-x0,.12,.07),METAL[1])
            for i in range(5):
                rivet(iron,x0+.12+i*(x1-x0-.24)/4,y,hinge_z-.145,.036)
        for y in [bottom+.27,bottom+1.78]:
            tube(iron,[(side*hinge_x,y-.13,hinge_z),(side*hinge_x,y+.13,hinge_z)],.115,METAL,8)
        # Handle ring / latch stays on the inner edge of each door.
        x=side*.24
        ring=[(x+.09*math.cos(i*2*math.pi/12),bottom+1.34+.13*math.sin(i*2*math.pi/12),hinge_z-.2) for i in range(13)]
        tube(iron,ring,.022,METAL,6)
        wood.finish(hinge,pivot)
        iron.finish(hinge,pivot)


scene=scene_for('Area4_S2_LandGate')
root=empty('S2_LandGate')
bones=Batch('S2_GateBoneFrame')
bands=Batch('S2_GateFrameIron',IRON)
spec=detail['landGate']
for side in [-1,1]:
    x=side*spec['jambHalfWidth']
    points=bezier([(x,0,0),(side*2.55,2,0),(side*1.55,spec['height'],0),(0,spec['height'],0)],19)
    tube(bones,points,[.30-i*.005 for i in range(19)],BONE,9,True)
    box(bands,(x,.17,0),(.68,.34,.74),METAL[0])
    for i in [4,12]:
        tube(bands,[points[i],points[i+1]],[.33-i*.005,.33-(i+1)*.005],METAL,8)
    for xoff in [-.22,.22]:
        rivet(bands,x+xoff,.18,-.39,.053)
ellipsoid(bones,(0,spec['height'],0),(.26,.24,.31),BONE)
bones.finish(root)
bands.finish(root)
gate_leaves(root,'S2',spec['hingeHalfWidth'],spec['hingeZ'],spec['groundGap'],
    lambda x: spec['leafHeight']-.28*(abs(x)/spec['hingeHalfWidth'])**2,spec['leafThickness'],True)
export(scene,root,'area4-s2-land-gate.glb')


# W2: flush replacement boards, charred structural timbers and outboard damage.
scene=scene_for('Area4_W2_Bridge')
root=empty('W2_ScorchedTimberBridge')
timber=Batch('W2_CharredTimberAndRepairs')
rope=Batch('W2_RopeLashings')
deck(timber)
post_x=detail['timber']['postHalfWidth']
for side in [-1,1]:
    x=side*post_x
    for start,end in [(-END,-HALF),(-HALF,HALF),(HALF,END)]:
        tube(timber,[(side*1.48,floor(start)-.24,start),(side*1.48,floor(end)-.24,end)],.235,CHAR,4)
    # No raised approach rails where the wall doors park on the inland side.
    zs=[-HALF+.72,-2.5,.7,3.5,HALF+.65,END-.3]
    tops=[]
    for i,z in enumerate(zs):
        h=detail['timber']['railHeight']+rng.uniform(-.13,.17)
        top=(x+side*rng.uniform(0,.09),floor(z)+h,z+rng.uniform(-.09,.09))
        tops.append(top)
        tube(timber,[(x,floor(z)-.25,z),top],[.20,.17],CHAR,5,True)
        # A few large splinters at each broken rail top.
        for off in [-.07,.075]:
            tube(timber,[(top[0]+off,top[1]-.14,top[2]),(top[0]+off*1.4,top[1]+rng.uniform(.08,.27),top[2]+.055)],[.052,.008],CHAR,4)
        for coil in range(4):
            y=floor(z)+.75+coil*.065
            pts=[(x+.24*math.cos(a),y, z+.24*math.sin(a)) for a in [k*2*math.pi/12 for k in range(13)]]
            tube(rope,pts,.034,ROPE,5)
    for i,(a,b) in enumerate(zip(tops,tops[1:])):
        a=Vector(a); b=Vector(b)
        points=[tuple(a.lerp(b,j/9)-Vector((0,.16*math.sin(j*math.pi/9)+.18,0))) for j in range(10)]
        tube(rope,points,.045,ROPE,6)
        if i in [0,2,3]:
            tube(timber,[tuple(a-Vector((0,.28,0))),tuple(b-Vector((0,.30,0)))],.085,CHAR,5,True)
    for z in [-3.6,1.5,4.65]:
        # Broken ends and hanging fragments lie entirely beyond the walking deck.
        tube(timber,[(x,DECK-.03,z),(x+side*.13,-.58,z+.3)],[.13,.075],CHAR,5,True)
        tube(rope,[(x,DECK+.06,z-.1),(x+side*.18,DECK-.32,z+.02),(x,DECK-.25,z+.2)],.038,ROPE,5)
for z in [-4.5,0,4.5]:
    tube(timber,[(-2.09,DECK-.30,z),(2.09,DECK-.30,z)],.17,CHAR,4)
timber.finish(root)
rope.finish(root)
export(scene,root,'area4-w2-timber-bridge.glb')


# W2 gate: keep the exact shipped masonry and add independently hinged leaves.
scene=scene_for('Area4_W2_WallGate')
root=empty('W2_WallGate')
source_path=os.path.join(OUTPUT,'fallen-keep-gate.glb')
before=set(scene.objects)
bpy.ops.import_scene.gltf(filepath=source_path)
imported=set(scene.objects)-before
for ob in imported:
    if ob.parent not in imported:
        ob.parent=root
spec=detail['wallGate']
hinge_x=keep['gate']['opening']/2+spec['hingeOffset']
bottom=floor(-HALF+spec['hingeZ']+spec['leafThickness']/2)+spec['groundGap']
radius=keep['gate']['opening']/2
def wall_top(x):
    return spec['archSpringHeight']+math.sqrt(max(0,radius*radius-x*x))-.06
gate_leaves(root,'W2',hinge_x,spec['hingeZ'],bottom,wall_top,spec['leafThickness'])
export(scene,root,'area4-w2-wall-gate.glb')


bpy.data.libraries.write(os.path.join(LOCAL,'area4-s2-w2.blend'),set(created_scenes),fake_user=True)
with open(source_path,'rb') as f:
    masonry_hash=hashlib.sha256(f.read()).hexdigest()
with open(os.path.join(LOCAL,'source-manifest.json'),'w') as f:
    json.dump({'units':'metres','gltfUp':'+Y','bridgeForward':'+Z','bridgeRoot':'midspan at ground Y=0',
        'wallSource':'fallen-keep-gate.glb','wallSourceSha256':masonry_hash,'exports':reports},f,indent=2)
print(json.dumps(reports,indent=2))
