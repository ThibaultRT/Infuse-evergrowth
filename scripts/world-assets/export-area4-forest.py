"""Small reusable forest props. Blender --background --python this-file.

Dimensions come from the renderer-neutral spec; meshes never define collision.
Run prepare-area4-forest.mjs --download first to recover the CC0 source maps.
"""
import bpy
import hashlib
import json
import math
import os
import random
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LOCAL = os.path.join(ROOT, 'authoring/local/area4/forest')
OUTPUT = os.path.join(ROOT, 'public/assets/world/shared/models')
with open(os.path.join(ROOT, 'src/data/world/area4-forest.json')) as file:
    spec = json.load(file)['props']
with open(os.path.join(ROOT, 'scripts/world-assets/area4-forest-sources.json')) as file:
    sources = json.load(file)
for source in sources:
    with open(os.path.join(LOCAL, 'textures', source['file']), 'rb') as file:
        assert hashlib.sha256(file.read()).hexdigest() == source['sha256'], source['file']

scene = bpy.data.scenes.new('Area4_BurnedForest')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
os.makedirs(OUTPUT, exist_ok=True)


def material(name, color, normal):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .96
    shader.inputs['Specular IOR Level'].default_value = .18
    for filename, is_normal in [(color, False), (normal, True)]:
        image = bpy.data.images.load(os.path.join(LOCAL, 'textures', filename), check_existing=True)
        image.colorspace_settings.name = 'Non-Color' if is_normal else 'sRGB'
        image.scale(512, 512)
        image.pack()
        texture = result.node_tree.nodes.new('ShaderNodeTexImage')
        texture.image = image
        if is_normal:
            node = result.node_tree.nodes.new('ShaderNodeNormalMap')
            node.inputs['Strength'].default_value = .65
            result.node_tree.links.new(texture.outputs['Color'], node.inputs['Color'])
            result.node_tree.links.new(node.outputs['Normal'], shader.inputs['Normal'])
        else:
            result.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    return result


bark = material('Area4_ScorchedBark', 'bark-willow-diff.jpg', 'bark-willow-nor_gl.jpg')
rock = material('Area4_Basalt', 'dark-rock-Diffuse.jpg', 'dark-rock-nor_gl.jpg')


class Mesh:
    def __init__(self, seed):
        self.verts, self.faces, self.uvs = [], [], []
        self.rng = random.Random(seed)

    def face(self, indices, uvs):
        self.faces.append(indices)
        self.uvs.append(uvs)

    def tube(self, path, sides=10, jagged=True):
        """Uneven tapered rings with bark UVs following the length of each limb."""
        start, distance = len(self.verts), 0
        lengths = []
        for j, (x, y, z, radius) in enumerate(path):
            point = Vector((x, y, z))
            before = Vector(path[max(0, j - 1)][:3])
            after = Vector(path[min(len(path) - 1, j + 1)][:3])
            tangent = (after - before).normalized()
            side = tangent.cross(Vector((0, 0, 1)))
            if side.length < .01:
                side = tangent.cross(Vector((0, 1, 0)))
            side.normalize()
            up = tangent.cross(side).normalized()
            if j:
                distance += (point - before).length
            lengths.append(distance)
            for k in range(sides):
                angle = k / sides * math.tau
                ridge = 1 + .10 * math.sin(k * 4.1) + .07 * math.cos(k * 2.7)
                vertex = point + (side * math.cos(angle) + up * math.sin(angle)) * radius * ridge
                if jagged and j == len(path) - 1:
                    vertex -= tangent * self.rng.uniform(0, radius * 1.4)
                self.verts.append(tuple(vertex))
        for j in range(len(path) - 1):
            for k in range(sides):
                a = start + j * sides + k
                b = start + j * sides + (k + 1) % sides
                self.face((a, b, b + sides, a + sides), ((k / sides, lengths[j]), ((k + 1) / sides, lengths[j]), ((k + 1) / sides, lengths[j + 1]), (k / sides, lengths[j + 1])))
        # A recessed, uneven fracture rather than a smooth saw-cut cap.
        for ring, reverse in [(0, True), (len(path) - 1, False)]:
            ids = [start + ring * sides + k for k in range(sides)]
            center = sum((Vector(self.verts[i]) for i in ids), Vector()) / sides
            if not reverse:
                direction = Vector(path[-1][:3]) - Vector(path[-2][:3])
                center -= direction.normalized() * path[-1][3] * .55
            ci = len(self.verts)
            self.verts.append(tuple(center))
            for k in range(sides):
                face = (ci, ids[k], ids[(k + 1) % sides])
                uv = ((.5, .5), (.5 + .4 * math.cos(k / sides * math.tau), .5 + .4 * math.sin(k / sides * math.tau)), (.5 + .4 * math.cos((k + 1) / sides * math.tau), .5 + .4 * math.sin((k + 1) / sides * math.tau)))
                self.face(tuple(reversed(face)) if reverse else face, tuple(reversed(uv)) if reverse else uv)

    def object(self, name, dimensions, mat, trunk=False):
        low, high = min(v[1] for v in self.verts), max(v[1] for v in self.verts)
        vertices = []
        for x, y, z in self.verts:
            y = (y - low) / (high - low) * dimensions['height']
            radial = math.hypot(x, z)
            limit = dimensions['radius'] if 'radius' in dimensions and (not trunk or y < 1.3) else dimensions['visualRadius']
            if radial > limit:
                x, z = x * limit / radial, z * limit / radial
            if 'width' in dimensions:
                x = max(-dimensions['width'] / 2, min(dimensions['width'] / 2, x))
                z = max(-dimensions['depth'] / 2, min(dimensions['depth'] / 2, z))
            vertices.append((x, -z, y))  # Blender Z-up -> glTF Y-up on export.
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], self.faces)
        mesh.update()
        uv = mesh.uv_layers.new(name='BarkOrStone')
        for poly, coords in zip(mesh.polygons, self.uvs):
            poly.use_smooth = mat == bark
            for index, value in zip(poly.loop_indices, coords):
                uv.data[index].uv = value
        obj = bpy.data.objects.new(name, mesh)
        scene.collection.objects.link(obj)
        obj.data.materials.append(mat)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        # Recalculate once so all limb caps and basalt facets face outwards.
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        return obj


assets = []
for variant, key in enumerate(['trunkA', 'trunkB']):
    m, h = Mesh(604 + variant), spec[key]['height']
    lean = .12 if variant == 0 else -.35
    m.tube([(0, 0, 0, .38), (.02, .4, .02, .32), (lean, h * .35, .04, .27), (lean * .6, h * .65, -.06, .21), (lean * 2, h * .9, .07, .13), (lean * 1.7, h, .10, .12)], 14)
    for i in range(5):
        angle = i * 2.4 + variant
        dx, dz = math.cos(angle), math.sin(angle)
        level = h * (.35 + i * .115)
        reach = 1.15 + (i % 2) * .35
        m.tube([(lean, level, 0, .17 - i * .018), (dx * .65, level + .28, dz * .65, .10), (dx * reach, level + .64, dz * reach, .048)], 8)
        if i % 2 == variant:
            m.tube([(dx * .63, level + .27, dz * .63, .07), (dx * 1.05 - dz * .3, level + .7, dz * 1.05 + dx * .3, .022)], 7)
    for i in range(5):
        a = i * math.tau / 5
        m.tube([(0, .32, 0, .18), (math.cos(a) * .43, .08, math.sin(a) * .43, .12), (math.cos(a) * .57, .03, math.sin(a) * .57, .035)], 7, False)
    assets.append((m.object('A04_Scorched_Trunk_' + 'AB'[variant], spec[key], bark, True), 'area4-charred-trunk-' + 'ab'[variant]))

m = Mesh(610)
m.tube([(0, 0, 0, .52), (.02, .18, 0, .42), (-.04, .55, .04, .35), (.01, .85, .03, .36)], 16)
for i in range(5):
    a = i * 2.4
    m.tube([(0, .2, 0, .19), (math.cos(a) * .56, .06, math.sin(a) * .56, .1)], 7)
assets.append((m.object('A04_Splintered_Stump', spec['stump'], bark), 'area4-charred-stump'))

m = Mesh(611)
m.tube([(-1.9, .45, 0, .36), (-1.3, .4, -.04, .4), (-.3, .39, .02, .37), (.8, .42, .05, .30), (1.9, .44, 0, .23)], 14)
m.tube([(-.4, .49, .07, .17), (-.2, .68, .35, .09), (.12, .76, .48, .03)], 8)
assets.append((m.object('A04_Fallen_Charred_Log', spec['log'], bark), 'area4-charred-log'))

for variant, key in enumerate(['basaltA', 'basaltB']):
    m, sides = Mesh(620 + variant), 9
    for level, radius in [(0, .83), (.32, 1), (.75, .78), (1, .40)]:
        for i in range(sides):
            angle = i / sides * math.tau + level * .17
            r = spec[key]['radius'] * radius * m.rng.uniform(.78, 1)
            m.verts.append((r * math.cos(angle), level * spec[key]['height'] + (m.rng.random() - .5) * .1, r * math.sin(angle)))
    for ring in range(3):
        for i in range(sides):
            a, b = ring * sides + i, ring * sides + (i + 1) % sides
            for face in [(a, b, b + sides), (a, b + sides, a + sides)]:
                m.face(face, tuple((m.verts[j][0] + m.verts[j][2] * .4, m.verts[j][1] + m.verts[j][2] * .5) for j in face))
    for ring in [0, 3]:
        face = tuple(ring * sides + i for i in range(sides))
        m.face(face, tuple((m.verts[j][0], m.verts[j][2]) for j in face))
    assets.append((m.object('A04_Fractured_Basalt_' + 'AB'[variant], spec[key], rock), 'area4-basalt-' + 'ab'[variant]))

for obj, filename in assets:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUTPUT, filename + '.glb'), export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True, export_materials='EXPORT', export_extras=True, export_animations=False, export_image_format='JPEG', export_image_quality=85)
    print('FOREST_EXPORT', filename, len(obj.data.polygons), 'faces')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(LOCAL, 'area4-forest.blend'))
