"""Fit a small CC0 Kenney Nature Kit selection to Greenhaven; no generated source art.

Download the checksummed archive listed in ASSET-LICENSES.md first. Run with Blender
--background --python-exit-code 1 --python scripts/world-assets/prepare-greenhaven-dressing.py.
"""
import bpy
import hashlib
import math
import os
import random
import zipfile
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
LOCAL = os.path.join(ROOT, 'authoring/local/greenhaven')
ARCHIVE = os.path.join(LOCAL, 'source/kenney_nature-kit.zip')
assert hashlib.sha256(open(ARCHIVE, 'rb').read()).hexdigest() == 'fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d'
SOURCE = os.path.join(LOCAL, 'source/nature-kit')
with zipfile.ZipFile(ARCHIVE) as archive:
    for name in archive.namelist():
        if name.startswith('Models/GLTF format/') or name == 'License.txt':
            archive.extract(name, SOURCE)
OUT = os.path.join(ROOT, 'public/assets/world/shared')
os.makedirs(os.path.join(OUT, 'licenses'), exist_ok=True)
with open(os.path.join(SOURCE, 'License.txt'), encoding='utf8') as source:
    notice = '\n'.join(line.rstrip() for line in source.read().splitlines()).strip() + '\n'
with open(os.path.join(OUT, 'licenses/kenney-nature-cc0.txt'), 'w', encoding='utf8', newline='\n') as target:
    target.write(notice)

# Separate background scene; the live artist scene is never opened or overwritten.
bpy.ops.wm.read_factory_settings(use_empty=True)
palette = bpy.data.materials.new('Kenney_Nature_VertexPalette')
palette.use_nodes = True
shader = palette.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = 0.94
color = palette.node_tree.nodes.new('ShaderNodeVertexColor')
color.layer_name = 'Color'
palette.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])


def source_mesh(name, width):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SOURCE, 'Models/GLTF format', name + '.glb'))
    imported = list(set(bpy.data.objects) - before)
    meshes = [obj for obj in imported if obj.type == 'MESH']
    points = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    scale = width / max(high.x - low.x, high.y - low.y)
    vertices, faces, colors = [], [], []
    for obj in meshes:
        offset = len(vertices)
        vertices.extend(tuple((obj.matrix_world @ v.co - center) * scale) for v in obj.data.vertices)
        for face in obj.data.polygons:
            material = obj.data.materials[face.material_index]
            principled = material.node_tree.nodes.get('Principled BSDF')
            tint = list(principled.inputs['Base Color'].default_value)
            # Modest palette fitting: soften the kit's bright grass to the meadow.
            if tint[1] > tint[0] * 1.15 and tint[1] > tint[2] * 1.15:
                tint = [0.12, 0.23, 0.035, 1]
            faces.append(tuple(offset + index for index in face.vertices))
            colors.append(tint)
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    return vertices, faces, colors


def export(name, data):
    vertices, faces, colors = data
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(palette)
    attribute = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for face, tint in zip(mesh.polygons, colors):
        for index in face.loop_indices:
            attribute.data[index].color = tint
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'models', name + '.glb'), export_format='GLB', use_selection=True)
    return obj


# A reusable ring of original grass clumps leaves a hole for the tree trunk.
random.seed(12609)
vertices, faces, colors = [], [], []
grass = source_mesh('grass', 0.7)
for i in range(10):
    angle = i * math.tau / 10
    radius = 0.75 + random.random() * 0.65
    scale = random.uniform(0.7, 1.15)
    yaw = random.random() * math.tau
    offset = len(vertices)
    for x, y, z in grass[0]:
        vertices.append((math.cos(angle) * radius + (x * math.cos(yaw) - y * math.sin(yaw)) * scale,
                         math.sin(angle) * radius + (x * math.sin(yaw) + y * math.cos(yaw)) * scale, z * scale))
    faces.extend(tuple(offset + v for v in face) for face in grass[1])
    colors.extend(grass[2])
export('greenhaven-grass-patch', (vertices, faces, colors))
for source, suffix, width in [
    ('plant_bushSmall', 'shrub-a', 1.2), ('plant_bushDetailed', 'shrub-b', 1.5),
    ('mushroom_redGroup', 'mushrooms', 0.65), ('log', 'fallen-log', 2.4),
    ('stump_roundDetailed', 'stump', 1.0),
]:
    export('greenhaven-' + suffix, source_mesh(source, width))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(LOCAL, 'greenhaven-dressing.blend'))
