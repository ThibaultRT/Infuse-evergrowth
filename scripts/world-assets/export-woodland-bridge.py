"""Blender background export; pass the supplied .blend before --python.

Bakes procedural oak/cedar into portable color maps, reduces curve tessellation,
and batches the model into a body, canopy, two independently hinged leaves and
lantern glass. The creative source is read-only; only the GLB is written.
"""
import bpy, json, math, os
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
with open(os.path.join(ROOT, 'src/data/world/woodland-bridge.json')) as file:
    spec = json.load(file)
scale = spec['deckLength'] / (spec['sourceDeckMax'] - spec['sourceDeckMin'])
center = (spec['sourceDeckMin'] + spec['sourceDeckMax']) / 2
normalization = Matrix.Translation((0, -center * scale, spec['deckHeight'] - spec['sourceDeckHeight'] * scale)) @ Matrix.Scale(scale, 4)
scene = bpy.context.scene
scene.frame_set(1)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 1
scene.cycles.bake_type = 'EMIT'
scene.render.bake.margin = 8
scene.render.bake.use_clear = True
scene.render.bake.target = 'IMAGE_TEXTURES'

source_objects = [ob for ob in scene.objects if ob.type in {'MESH', 'CURVE'} and not ob.hide_render]
hinges = [bpy.data.objects.get('GATE ' + side + ' • SIDE HINGE / Z') for side in ['LEFT', 'RIGHT']]
hinge_children = [set(ob.children_recursive) for ob in hinges]
groups = {}
paint = bpy.data.materials.new('WoodlandBridge_DetailColors')
paint.use_nodes = True
paint_shader = paint.node_tree.nodes.get('Principled BSDF')
paint_shader.inputs['Roughness'].default_value = 0.75
paint_color = paint.node_tree.nodes.new('ShaderNodeVertexColor')
paint_color.layer_name = 'Color'
paint.node_tree.links.new(paint_color.outputs['Color'], paint_shader.inputs['Base Color'])
for ob in source_objects:
    if ob.type == 'CURVE':
        # Keep silhouettes and rope twists; avoid exporting studio curve density.
        ob.data.bevel_resolution = 0
        ob.data.resolution_u = 1
        for spline in list(ob.data.splines):
            if spline.type != 'POLY' or len(spline.points) < 20:
                continue
            step = 3 if len(spline.points) > 100 else 2
            coords = [p.co.copy() for p in spline.points]
            sampled = coords[::step]
            if not spline.use_cyclic_u and sampled[-1] != coords[-1]:
                sampled.append(coords[-1])
            cyclic = spline.use_cyclic_u
            replacement = ob.data.splines.new('POLY')
            replacement.points.add(len(sampled) - 1)
            for point, co in zip(replacement.points, sampled):
                point.co = co
            replacement.use_cyclic_u = cyclic
            ob.data.splines.remove(spline)
    for mod in ob.modifiers:
        if mod.type == 'BEVEL':
            mod.segments = 1

bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
for ob in source_objects:
    evaluated = ob.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    if not mesh.polygons:
        bpy.data.meshes.remove(mesh)
        continue
    # Freeze original object coordinates before joining, preserving procedural grain.
    coords = mesh.attributes.new('bridge_source', 'FLOAT_VECTOR', 'POINT')
    for vertex, value in zip(mesh.vertices, coords.data):
        value.vector = vertex.co
    mesh.transform(normalization @ ob.matrix_world)
    copy = bpy.data.objects.new('Export_' + ob.name, mesh)
    scene.collection.objects.link(copy)
    group = 'GateLeft' if ob in hinge_children[0] else 'GateRight' if ob in hinge_children[1] else 'Canopy' if any(c.name.startswith('03 ') for c in ob.users_collection) else 'Glow' if any(m and m.name in {'Amber lantern glass', 'Golden flame'} for m in mesh.materials) else 'Body'
    primary = mesh.materials[0]
    baked = group != 'Glow' and primary.name != 'Flax rope' and primary.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].is_linked
    style = 'Wood' if baked else 'Glow' if group == 'Glow' else 'Details'
    if style == 'Details':
        colors = mesh.color_attributes.new('Color', 'BYTE_COLOR', 'CORNER')
        for face in mesh.polygons:
            material = mesh.materials[face.material_index]
            color = (0.65, 0.51, 0.3, 1) if material.name == 'Flax rope' else material.diffuse_color
            for loop in face.loop_indices:
                colors.data[loop].color = color
            face.material_index = 0
            if ob.type == 'CURVE':
                face.use_smooth = True
        mesh.materials.clear()
        mesh.materials.append(paint)
    groups.setdefault((group, style), []).append(copy)
for ob in list(scene.objects):
    if not ob.name.startswith('Export_'):
        bpy.data.objects.remove(ob, do_unlink=True)

for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    nodes, links = material.node_tree.nodes, material.node_tree.links
    for tex in [node for node in nodes if node.type == 'TEX_COORD']:
        attr = nodes.new('ShaderNodeAttribute')
        attr.attribute_name = 'bridge_source'
        for link in list(tex.outputs['Object'].links):
            links.new(attr.outputs['Vector'], link.to_socket)

exported = []
parents = {}
for (name, style), objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = 'WoodlandBridge_' + name + '_' + style
    if style == 'Details' and name in {'Body', 'Canopy'}:
        reduction = ob.modifiers.new('Mobile geometry budget', 'DECIMATE')
        reduction.ratio = 0.16 if name == 'Body' else 0.4
        bpy.ops.object.modifier_apply(modifier=reduction.name)
    if style == 'Wood':
        size = 1024 if name in {'Body', 'Canopy'} else 512
        image = bpy.data.images.new(ob.name + '_Color', width=size, height=size, alpha=False)
        materials = set(m for m in ob.data.materials if m)
        for material in materials:
            nodes, links = material.node_tree.nodes, material.node_tree.links
            output = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
            shader = nodes.get('Principled BSDF')
            emit = nodes.new('ShaderNodeEmission')
            color = shader.inputs['Base Color']
            if color.is_linked:
                links.new(color.links[0].from_socket, emit.inputs['Color'])
            else:
                emit.inputs['Color'].default_value = color.default_value
            links.new(emit.outputs[0], output.inputs['Surface'])
            target = nodes.new('ShaderNodeTexImage')
            target.image = image
            nodes.active = target
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002)
        bpy.ops.object.mode_set(mode='OBJECT')
        print('BAKING', name, len(ob.data.polygons), flush=True)
        bpy.ops.object.bake(type='EMIT')
        material = bpy.data.materials.new(ob.name + '_Baked')
        material.use_nodes = True
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value = 0.78
        tex = material.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image
        material.node_tree.links.new(tex.outputs['Color'], shader.inputs['Base Color'])
        ob.data.materials.clear()
        ob.data.materials.append(material)
        for face in ob.data.polygons:
            face.material_index = 0
        image.pack()
    if 'bridge_source' in ob.data.attributes:
        ob.data.attributes.remove(ob.data.attributes['bridge_source'])
    if name not in parents:
        parent = bpy.data.objects.new('WoodlandBridge_' + name, None)
        scene.collection.objects.link(parent)
        parents[name] = parent
        if name == 'Canopy':
            parent['cameraOccluder'] = True
        exported.append(parent)
    parent = parents[name]
    ob.parent = parent
    if name in {'GateLeft', 'GateRight'}:
        sign = -1 if name == 'GateLeft' else 1
        pivot = normalization @ Vector((sign * spec['sourceHinge'][0], spec['sourceHinge'][1], spec['sourceHinge'][2]))
        ob.data.transform(Matrix.Translation(-pivot))
        parent.location = pivot
    exported.append(ob)

bpy.ops.object.select_all(action='DESELECT')
for ob in exported:
    ob.select_set(True)
destination = os.path.join(ROOT, 'public/assets/world/shared/models/woodland-bridge.glb')
bpy.ops.export_scene.gltf(filepath=destination, export_format='GLB', use_selection=True, export_animations=False, export_extras=True, export_yup=True, export_materials='EXPORT')
print('EXPORTED', destination, os.path.getsize(destination), flush=True)
