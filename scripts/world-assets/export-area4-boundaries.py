"""Normalize supplied fence/gate in an isolated scene; Blender CLI or MCP.

Sources stay unchanged in authoring/local/area4/boundaries/source/.
Run optimize-area4-boundaries.mjs afterward, then the normal asset promotion.
"""
import bpy
import hashlib
import json
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
LOCAL = os.path.join(ROOT, 'authoring/local/area4/boundaries')
with open(os.path.join(ROOT, 'src/data/world/area4-boundaries.json')) as file:
    spec = json.load(file)
sources = [
    ('Fence', '33d212cbb39396e61de24901215ee5524adb9f104c0314ec6e9376403a346167', 4000),
    ('Gate', '6874379789b8ecec538477d04794655487530e1d5d99432c98b9ff85192ba2a4', 9000),
]
previous = bpy.context.window.scene
scene = bpy.data.scenes.new('Area4_EasternBoundary')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
reports = []
source_images = set()
try:
    for label, expected_hash, target in sources:
        source = os.path.join(LOCAL, 'source', label + '-area4.glb')
        with open(source, 'rb') as file:
            source_hash = hashlib.sha256(file.read()).hexdigest()
        assert source_hash == expected_hash, 'Unexpected supplied ' + label
        bpy.ops.object.select_all(action='DESELECT')
        before = set(scene.objects)
        images_before = set(bpy.data.images)
        bpy.ops.import_scene.gltf(filepath=source)
        source_images.update(set(bpy.data.images) - images_before)
        imported = [obj for obj in scene.objects if obj not in before]
        meshes = [obj for obj in imported if obj.type == 'MESH']
        assert len(meshes) == 1 and len(imported) == 1, 'Expected one static mesh'
        obj = meshes[0]
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        obj.name = 'Area4_East' + label
        obj.data.name = obj.name + '_Mesh'
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        source_triangles = sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
        modifier = obj.modifiers.new('BrowserMeshBudget', 'DECIMATE')
        modifier.ratio = target / source_triangles
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        # glTF Y-up becomes Blender Z-up. Bake uniform scale and ground-centre.
        vertices = [v.co.copy() for v in obj.data.vertices]
        low = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
        high = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
        center = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
        scale = spec[label.lower()]['width'] / (high.x - low.x)
        for vertex in obj.data.vertices:
            vertex.co = (vertex.co - center) * scale
        obj.location = (0, 0, 0)
        obj.data.update()
        bpy.context.view_layer.update()
        print(json.dumps({'asset': label, 'dimensions': list(obj.dimensions)}))
        assert obj.dimensions.z <= spec[label.lower()]['height'] + .001
        assert obj.dimensions.y <= spec[label.lower()]['depth'] + .001
        obj.data.materials[0].name = 'Area4_East' + label + '_PBR'
        output = os.path.join(ROOT, 'public/assets/world/shared/models/area4-east-' + label.lower() + '.glb')
        bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', use_selection=True, use_active_scene=True,
                                  export_yup=True, export_apply=True, export_animations=False,
                                  export_cameras=False, export_lights=False, export_extras=True)
        reports.append({'asset': label, 'sourceSha256': source_hash, 'sourceTriangles': source_triangles,
                        'triangles': sum(len(p.vertices) - 2 for p in obj.data.polygons),
                        'uniformScale': scale, 'sizeBlenderXYZ': list(obj.dimensions)})
    for image in source_images:
        if image.users and image.source == 'FILE' and not image.packed_file:
            image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(LOCAL, 'area4-boundaries.blend'), copy=True)
    with open(os.path.join(LOCAL, 'blender-report.json'), 'w') as file:
        json.dump(reports, file, indent=2)
finally:
    bpy.context.window.scene = previous

result = {'assets': reports, 'scene': scene.name}
