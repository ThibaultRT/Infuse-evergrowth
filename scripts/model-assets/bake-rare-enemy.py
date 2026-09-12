"""Blender background authoring: decimate two LODs and bake high-poly normals.

blender --background --factory-startup --python scripts/model-assets/bake-rare-enemy.py -- source.glb lods.glb
Then package lods.glb with optimize-rare-enemy.mjs.
"""
import bpy
import bmesh
import sys

source_path, output_path = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source_path)
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if len(meshes) != 1 or meshes[0].animation_data or meshes[0].modifiers:
    raise RuntimeError('Expected one static rare-enemy mesh; review changed source art.')
source = meshes[0]
source.name = 'Rare_Source'
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
scene.render.bake.use_selected_to_active = True
scene.render.bake.cage_extrusion = max(source.dimensions) * .025
scene.render.bake.margin = 8
lods = []
for index, ratio in enumerate([.015, .005]):
    low = source.copy()
    low.data = source.data.copy()
    scene.collection.objects.link(low)
    low.name = f'Rare_LOD{index}'
    bpy.ops.object.select_all(action='DESELECT')
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    mesh = bmesh.new()
    mesh.from_mesh(low.data)
    bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=0.000001)
    mesh.to_mesh(low.data)
    mesh.free()
    modifier = low.modifiers.new('Runtime reduction', 'DECIMATE')
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in low.data.polygons:
        polygon.use_smooth = True
    material = source.data.materials[0].copy()
    low.data.materials.clear()
    low.data.materials.append(material)
    image = bpy.data.images.new(f'Rare_Normal_LOD{index}', width=1024, height=1024)
    image.colorspace_settings.name = 'Non-Color'
    nodes = material.node_tree.nodes
    target = nodes.new('ShaderNodeTexImage')
    target.image = image
    nodes.active = target
    source.select_set(True)
    bpy.ops.object.bake(type='NORMAL')
    shader = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    normal = nodes.new('ShaderNodeNormalMap')
    material.node_tree.links.new(target.outputs['Color'], normal.inputs['Color'])
    material.node_tree.links.new(normal.outputs['Normal'], shader.inputs['Normal'])
    image.pack()
    low.hide_render = True
    lods.append(low)
    print(f'{low.name}: {len(low.data.polygons)} triangles, baked normal map', flush=True)
bpy.ops.object.select_all(action='DESELECT')
for low in lods:
    low.hide_render = False
    low.select_set(True)
bpy.context.view_layer.objects.active = lods[0]
bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', use_selection=True,
                          export_animations=False, export_yup=True, export_image_format='AUTO')
