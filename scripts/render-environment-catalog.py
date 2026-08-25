"""Render the curated Quaternius environment catalogue with Blender.

Run from the repository root:
  blender --background --python scripts/render-environment-catalog.py
"""

import json
import shutil
import subprocess
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path.cwd()
ASSET_ROOT = ROOT / "public/assets/quaternius"
OUTPUT = ROOT / "WIP/environment-catalog"
THUMBNAILS = OUTPUT / "thumbnails"
TILE_SIZE = 640

CATEGORIES = {
    "cliffs-rocks": [
        "nature/models/Rock_Medium_1.gltf",
        "nature/models/Rock_Medium_2.gltf",
    ],
    "trees-vegetation": [
        "nature/models/CommonTree_1.gltf",
        "nature/models/CommonTree_3.gltf",
        "nature/models/Bush_Common_Flowers.gltf",
        "nature/models/Flower_3_Group.gltf",
        "nature/models/Grass_Common_Short.gltf",
    ],
    "roads-paths": [
        "nature/models/RockPath_Round_Wide.gltf",
        "village/models/Floor_UnevenBrick.gltf",
    ],
    "fences-palisades": [
        "village/models/Prop_WoodenFence_Single.gltf",
        "village/models/Prop_WoodenFence_Extension1.gltf",
    ],
    "houses-village-structures": [],
    "walls-broken-walls": ["village/models/Prop_Brick1.gltf"],
    "gates-arches": [
        "village/models/DoorFrame_Round_Brick.gltf",
        "village/models/Door_4_Round.gltf",
    ],
    "towers-ruins": [],
    "bridges": [],
    "rubble-props": ["village/models/Prop_Brick1.gltf"],
}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def mesh_bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return minimum, maximum


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_asset(relative_path):
    reset_scene()
    source = ASSET_ROOT / relative_path
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    minimum, maximum = mesh_bounds(meshes)
    dimensions = maximum - minimum
    center = (minimum + maximum) / 2
    triangles = sum(len(poly.vertices) - 2 for obj in meshes for poly in obj.data.polygons)

    camera_data = bpy.data.cameras.new("CatalogueCamera")
    camera = bpy.data.objects.new("CatalogueCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    camera.data.lens = 50
    camera.location = center + Vector((6, -8, 6))
    point_at(camera, center)
    projected_span = max(dimensions.x + dimensions.y * 0.65, dimensions.z * 1.3, 0.25)
    camera.data.ortho_scale = projected_span * 1.22
    bpy.context.scene.camera = camera

    world = bpy.context.scene.world or bpy.data.worlds.new("CatalogueWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.07, 0.085, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8

    for location, energy, size in [((5, -5, 8), 1100, 5), ((-5, 1, 5), 650, 4)]:
        light_data = bpy.data.lights.new("CatalogueLight", "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new("CatalogueLight", light_data)
        light.location = center + Vector(location)
        point_at(light, center)
        bpy.context.scene.collection.objects.link(light)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = TILE_SIZE
    scene.render.resolution_y = 500
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    output = THUMBNAILS / f"{source.stem}.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return {
        "source": relative_path,
        "filename": source.name,
        "dimensionsMetres": [round(value, 3) for value in dimensions],
        "triangles": triangles,
        "thumbnail": str(output.relative_to(ROOT)),
    }


def labelled_tile(asset):
    source = Path(asset["thumbnail"])
    output = THUMBNAILS / f"labelled-{asset['filename']}.png"
    subprocess.run([
        "convert", str(source), "-background", "#101820", "-gravity", "south",
        "-fill", "white", "-font", "DejaVu-Sans", "-pointsize", "25",
        "-splice", "0x70", "-annotate", "+0+22", asset["filename"], str(output),
    ], check=True)
    return output


def create_sheet(category, assets):
    output = OUTPUT / f"{category}.png"
    title = category.replace("-", " / ").title()
    if not assets:
        subprocess.run([
            "convert", "-size", "1280x420", "xc:#101820", "-gravity", "center",
            "-fill", "white", "-font", "DejaVu-Sans", "-pointsize", "42",
            "-annotate", "+0-35", title, "-fill", "#aebbc6", "-pointsize", "28",
            "-annotate", "+0+45", "No models in the curated runtime subset", str(output),
        ], check=True)
        return
    tiles = [labelled_tile(asset) for asset in assets]
    columns = min(3, len(tiles))
    subprocess.run([
        "montage", *map(str, tiles), "-tile", f"{columns}x", "-geometry", "+18+18",
        "-background", "#101820", str(output),
    ], check=True)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    THUMBNAILS.mkdir(parents=True, exist_ok=True)
    paths = list(dict.fromkeys(path for paths in CATEGORIES.values() for path in paths))
    rendered = {asset["source"]: asset for asset in map(render_asset, paths)}
    for category, category_paths in CATEGORIES.items():
        create_sheet(category, [rendered[path] for path in category_paths])
    metadata = {
        "renderer": bpy.app.version_string,
        "assets": [
            {key: value for key, value in asset.items() if key != "thumbnail"}
            for asset in rendered.values()
        ],
        "categories": CATEGORIES,
    }
    (OUTPUT / "catalog-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    shutil.rmtree(THUMBNAILS)


main()
