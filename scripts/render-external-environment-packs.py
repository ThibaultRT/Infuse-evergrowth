"""Extract and render the three KayKit evaluation archives with Blender.

Run from the repository root:
  blender --background --python scripts/render-external-environment-packs.py

The archives remain the source of truth; extraction is temporary and no pack model is
copied into the application's runtime asset tree.
"""

import csv
import json
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path.cwd()
ARCHIVES = ROOT / "WIP/external-environment-source-archives"
OUTPUT = ROOT / "WIP/external-environment-evaluation"
PACKS = {
    "medieval-builder": "KayKit Medieval Builder Pack 1.0.zip",
    "dungeon-1.1-free": "KayKit_Dungeon_Pack_1.1_FREE.zip",
    "forest-nature-1.0-free": "KayKit_Forest_Nature_Pack_1.0_FREE.zip",
}
TILE_WIDTH, TILE_HEIGHT, PAGE_SIZE = 280, 210, 30

CATEGORY_PATTERNS = {
    "houses": r"house|barracks|blacksmith|church|farm|lumbermill|market|mill|tavern|castle",
    "roads": r"road|path|floor",
    "water/coasts": r"water|river|coast|bridge|dock",
    "walls": r"wall|palisade|battlement",
    "gates": r"gate|doorway|doorframe|arch",
    "ruins": r"broken|crack|rubble|ruin|scaffold",
    "stairs": r"stair|step|ramp",
    "cliffs/high ground": r"cliff|hill|mountain|rock_transition|foundation",
    "rocks": r"rock|stone|boulder",
    "trees/vegetation": r"tree|bush|grass|flower|plant|forest|stump|log",
    "fences": r"fence|palisade",
    "props": r"barrel|crate|table|chair|bench|banner|bed|bottle|candle|chest|column|shelf|stool|trunk|well|cart|detail",
}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images,
                       bpy.data.cameras, bpy.data.lights):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def bounds(meshes):
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return minimum, maximum


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def candidates(filename):
    stem = filename.lower()
    return [name for name, pattern in CATEGORY_PATTERNS.items() if re.search(pattern, stem)]


def render_model(source, extraction_root, thumbnail):
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No meshes found in {source}")
    minimum, maximum = bounds(meshes)
    dimensions, center = maximum - minimum, (minimum + maximum) / 2

    camera_data = bpy.data.cameras.new("EvaluationCamera")
    camera = bpy.data.objects.new("EvaluationCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    camera.location = center + Vector((6, -8, 6))
    point_at(camera, center)
    camera.data.ortho_scale = max(dimensions.x + dimensions.y * .65,
                                  dimensions.z * 1.35, .25) * 1.2
    bpy.context.scene.camera = camera

    world = bpy.context.scene.world or bpy.data.worlds.new("EvaluationWorld")
    bpy.context.scene.world, world.use_nodes = world, True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.04, .055, .07, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .8
    for offset, energy, size in [((5, -5, 8), 900, 5), ((-4, 1, 5), 500, 4)]:
        data = bpy.data.lights.new("EvaluationLight", "AREA")
        data.energy, data.shape, data.size = energy, "DISK", size
        light = bpy.data.objects.new("EvaluationLight", data)
        light.location = center + Vector(offset)
        point_at(light, center)
        bpy.context.scene.collection.objects.link(light)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 16
    scene.render.resolution_x, scene.render.resolution_y = TILE_WIDTH, TILE_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.filepath = str(thumbnail)
    bpy.ops.render.render(write_still=True)
    return {
        "relativePath": source.relative_to(extraction_root).as_posix(),
        "filename": source.name,
        "dimensions": [round(value, 3) for value in dimensions],
        "triangles": sum(len(poly.vertices) - 2 for obj in meshes for poly in obj.data.polygons),
        "candidates": candidates(source.name),
    }


def make_pages(pack_output, records, thumbnails):
    for page_index in range(0, len(records), PAGE_SIZE):
        page_records = records[page_index:page_index + PAGE_SIZE]
        labelled = []
        for record, thumbnail in zip(page_records, thumbnails[page_index:page_index + PAGE_SIZE]):
            labelled_path = thumbnail.with_name("labelled-" + thumbnail.name)
            subprocess.run(["convert", str(thumbnail), "-background", "#101820", "-gravity", "south",
                            "-fill", "white", "-font", "DejaVu-Sans", "-pointsize", "15",
                            "-splice", "0x48", "-annotate", "+0+16", record["filename"],
                            str(labelled_path)], check=True)
            labelled.append(labelled_path)
        page_number = page_index // PAGE_SIZE + 1
        subprocess.run(["montage", *map(str, labelled), "-tile", "5x6", "-geometry", "+10+10",
                        "-background", "#101820", str(pack_output / f"contact-sheet-{page_number:02}.png")],
                       check=True)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="infuse-environment-packs-") as temporary:
        temporary = Path(temporary)
        for slug, archive_name in PACKS.items():
            extraction = temporary / slug
            with zipfile.ZipFile(ARCHIVES / archive_name) as archive:
                archive.extractall(extraction)
            models = sorted([*extraction.rglob("*.gltf"), *extraction.rglob("*.glb")],
                            key=lambda path: path.relative_to(extraction).as_posix().lower())
            pack_output = OUTPUT / slug
            shutil.rmtree(pack_output, ignore_errors=True)
            thumbnail_root = pack_output / "thumbnails"
            thumbnail_root.mkdir(parents=True)
            records, thumbnails = [], []
            for index, model in enumerate(models):
                thumbnail = thumbnail_root / f"{index:04}.png"
                records.append(render_model(model, extraction, thumbnail))
                thumbnails.append(thumbnail)
            with (pack_output / "inventory.csv").open("w", newline="") as output:
                writer = csv.writer(output, lineterminator="\n")
                writer.writerow(["relative_path", "filename", "dimensions_x_y_z", "triangles", "candidate_categories"])
                for record in records:
                    writer.writerow([record["relativePath"], record["filename"],
                                     " x ".join(map(str, record["dimensions"])), record["triangles"],
                                     "; ".join(record["candidates"])])
            (pack_output / "inventory.json").write_text(json.dumps(records, indent=2) + "\n")
            make_pages(pack_output, records, thumbnails)
            shutil.rmtree(thumbnail_root)


main()
