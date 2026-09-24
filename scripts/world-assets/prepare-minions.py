"""Background Blender: audit supplied sources and export only runtime derivatives.
Run from the repository root with --background --python-exit-code 1 --python.
"""
import bpy
import json
import hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / 'authoring/local/assets/Bestiary - Dungeon Monsters Kit[Standard]'
LOCAL = ROOT / 'authoring/local/minions'
OUT = ROOT / 'public/assets/world/shared/models'
LOCAL.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
SPEC = json.loads((ROOT / 'src/data/world/minion-presentation.json').read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def bounds(objects):
    points = [o.matrix_world @ Vector(p) for o in objects if o.type == 'MESH' for p in o.bound_box]
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]

reset()
bpy.ops.import_scene.fbx(filepath=str(PACK / 'Exports/FBX (Unity)/Imp.fbx'))
fbx_clips = [a.name for a in bpy.data.actions]
reports = []
for name, source, target_size in [
    ('imp', PACK / 'Exports/GLB (Godot-Unreal)/Imp.glb', SPEC['impHeight']),
    ('summoning-pit', ROOT / 'authoring/local/assets/models/Summonning_pit.glb', SPEC['pit']['diameter']),
]:
    reset()
    bpy.ops.import_scene.gltf(filepath=str(source))
    # Blender's importer adds bone display helpers that are not source geometry.
    helpers = {bone.custom_shape for arm in bpy.context.scene.objects if arm.type == 'ARMATURE' for bone in arm.pose.bones if bone.custom_shape}
    for helper in helpers:
        bpy.data.objects.remove(helper, do_unlink=True)
    objects = list(bpy.context.scene.objects)
    bpy.context.view_layer.update()
    low, high = bounds(objects)
    dimension = high[2] - low[2] if name == 'imp' else max(high[0] - low[0], high[1] - low[1])
    scale = target_size / dimension
    # One root retains the skeleton and local inverse-bind transforms.
    root = bpy.data.objects.new('Imp' if name == 'imp' else 'SummoningPit', None)
    bpy.context.collection.objects.link(root)
    for o in objects:
        if o.parent is None:
            o.parent = root
    root.scale = (scale,) * 3
    root.location = (-(low[0] + high[0]) * scale / 2, -(low[1] + high[1]) * scale / 2, -low[2] * scale)
    if name == 'summoning-pit':
        for o in objects:
            if o.type == 'MESH':
                modifier = o.modifiers.new('Mobile budget', 'DECIMATE')
                modifier.ratio = 0.25
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.modifier_apply(modifier=modifier.name)
    for image in bpy.data.images:
        if image.size[0] > 512 or image.size[1] > 512:
            image.scale(512, 512)
            image.pack()
    clips = [a.name for a in bpy.data.actions]
    bpy.ops.wm.save_as_mainfile(filepath=str(LOCAL / f'{name}.blend'))
    output = OUT / f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_image_format='JPEG', export_jpeg_quality=88,
                              export_animations=True, export_yup=True)
    reports.append(dict(name=name, source=str(source.relative_to(ROOT)), sourceSha256=digest(source),
                        sourceBytes=source.stat().st_size, sourceBlenderBounds=[low, high], scale=scale,
                        runtimeSha256=digest(output), runtimeBytes=output.stat().st_size,
                        triangles=sum(len(o.data.loop_triangles) for o in objects if o.type == 'MESH'),
                        skeletons=[dict(name=o.name, joints=len(o.data.bones)) for o in objects if o.type == 'ARMATURE'],
                        sourceClips=clips, fbxClips=fbx_clips if name == 'imp' else [],
                        animationMap=dict(idle=None, move=None, attack=None, hit=None, death=None),
                        animationFallback='procedural presentation; supplied GLB and FBX contain no clips'))

# Stable save IDs map to the supplied numbered base-color textures. Only these
# three gameplay variants ship; geometry and the other maps remain shared.
for number in range(1, 4):
    source = PACK / f'Textures/T_Imp_BaseColor_{number}.png'
    image = bpy.data.images.load(str(source), check_existing=False)
    image.scale(512, 512)
    image.file_format = 'JPEG'
    image.filepath_raw = str(OUT / f'imp-variant-{number}.jpg')
    image.save()
    reports.append(dict(variant=f'variant-{number}', source=source.name, sourceSha256=digest(source)))
(LOCAL / 'audit.json').write_text(json.dumps(reports, indent=2) + '\n')
print(json.dumps(reports, indent=2))
