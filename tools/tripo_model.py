"""Make a low-poly game mesh with the Tripo API (v3) and save it to assets/models/.

Usage (from the repo root):
  python tools/tripo_model.py --image assets/concepts/hero-model.png --name hero
  python tools/tripo_model.py --prompt "a chunky low-poly chimney" --name chimney
  python tools/tripo_model.py --rebake --name hero --palette "#1FA39A,#F2635F"   # recolour, no API call

Default ("sections"): Tripo paints the smart-low-poly mesh, then this script samples that paint
per triangle, snaps it to the Style Lock palette and writes one mesh per palette colour, named by
its hex code (e.g. "#1FA39A"). Textures and UVs are dropped: the game shades flat-coloured
triangles (see src/models.js). The painted Tripo original is kept, git-ignored, in
assets/models/_source/ so --rebake can recolour it for free.

--one-color skips the paint entirely (texture off) and gives a single uncoloured mesh.

Palette: --palette "#hex,#hex,..." or, by default, every hex code in the Style section of
docs/game-plan.md. Reads the API key from TRIPO_API_KEY. Needs Pillow and numpy for sections.
Prints one JSON line with the result.
"""
import argparse, io, json, mimetypes, os, re, struct, sys, time, urllib.error, urllib.request, uuid

API = "https://openapi.tripo3d.ai/v3"
MODEL_VERSION = "v3.1-20260211"   # smart_low_poly needs v3.0-20250812 or newer
RIG_VERSION = "v3.0-20260909"     # recommended for humanoids
MAX_FACES = 6000
MAX_TEXTURE = 1024
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT_DIR = os.path.join(ROOT, "assets", "models")
SOURCE_DIR = os.path.join(OUT_DIR, "_source")


# ---------- Tripo API ----------

def call(method, path, key, body=None, headers=None):
    req = urllib.request.Request(API + path, data=body, method=method,
                                 headers={"Authorization": f"Bearer {key}", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Tripo {method} {path} failed: HTTP {e.code} {e.read().decode(errors='replace')[:500]}")
    if data.get("code") != 0:
        sys.exit(f"Tripo {method} {path} error: {json.dumps(data)[:500]}")
    return data["data"]


def upload(path, key):
    boundary = uuid.uuid4().hex
    mime = mimetypes.guess_type(path)[0] or "image/png"
    with open(path, "rb") as f:
        payload = f.read()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{os.path.basename(path)}\"\r\n"
            f"Content-Type: {mime}\r\n\r\n").encode() + payload + f"\r\n--{boundary}--\r\n".encode()
    return call("POST", "/files", key, body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})["file_token"]


def start(key, path, body):
    return call("POST", path, key, json.dumps(body).encode(), {"Content-Type": "application/json"})["task_id"]


def wait(key, task_id, timeout, label):
    print(f"{label}: task {task_id} started", file=sys.stderr)
    deadline = time.time() + timeout
    while True:
        task = call("GET", f"/tasks/{task_id}", key)
        status = task.get("status")
        if status == "success":
            return task
        if status in ("failed", "cancelled", "banned", "expired"):
            sys.exit(f"{label}: task {task_id} {status}: {task.get('error_code')} {task.get('error_message')}")
        if time.time() > deadline:
            sys.exit(f"{label}: task {task_id} still {status} after {timeout}s")
        print(f"  {label} {status} {task.get('progress', 0)}%", file=sys.stderr)
        time.sleep(5)


def download(url):
    with urllib.request.urlopen(url, timeout=180) as r:
        return r.read()


def model_options(a, key, extra):
    options = {"model": MODEL_VERSION, "pbr": False, "export_uv": True,
               "face_limit": max(500, min(MAX_FACES, a.faces)), **extra}
    if a.image:
        options["input"] = upload(a.image, key)
        return "/generation/image-to-model", options
    options["prompt"] = a.prompt
    return "/generation/text-to-model", options


def generate(a, key, painted):
    path, options = model_options(a, key, {"smart_low_poly": True, "texture": painted})
    task_id = start(key, path, options)
    task = wait(key, task_id, a.timeout, "model")
    return download(task["output"]["model_url"]), task_id, task.get("credits_consumed")


def character(a, key):
    """Textured mesh -> rig check -> auto rig -> preset animations. Returns (glb bytes, info)."""
    path, options = model_options(a, key, {"texture": True, "smart_low_poly": False})
    gen_id = start(key, path, options)
    gen = wait(key, gen_id, a.timeout, "model")
    credits = gen.get("credits_consumed") or 0
    check = wait(key, start(key, "/animations/rig-check", {"input": gen_id}), a.timeout, "rig-check")["output"]
    if not check.get("riggable"):
        sys.exit(f"Tripo says this model can't be rigged ({check}); use the model without --character instead")
    rig_id = start(key, "/animations/rig", {"input": gen_id, "model": RIG_VERSION, "rig_type": check["rig_type"],
                                            "spec": "tripo", "out_format": "glb"})
    rig = wait(key, rig_id, a.timeout, "rig")
    credits += rig.get("credits_consumed") or 0
    result = rig
    anims = [n.strip() for n in (a.animations or "").split(",") if n.strip()]
    if anims:
        anims = [n if n.startswith("preset:") else f"preset:{n}" for n in anims][:5]
        body = {"input": rig_id, "out_format": "glb", "animate_in_place": True}
        body.update({"animation": anims[0]} if len(anims) == 1 else {"animations": anims})
        result = wait(key, start(key, "/animations/retarget", body), a.timeout, "animate")
        credits += result.get("credits_consumed") or 0
    return download(result["output"]["model_url"]), {"task_id": gen_id, "rig_task_id": rig_id,
                                                     "rig_type": check["rig_type"], "credits": credits}


# ---------- GLB read/write ----------

COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
DTYPES = {5126: "<f4", 5125: "<u4", 5123: "<u2", 5121: "u1"}


def read_glb(data):
    import numpy as np
    json_len = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + json_len])
    rest = data[20 + json_len:]
    bin_chunk = rest[8:8 + struct.unpack("<I", rest[:4])[0]] if rest else b""

    def view(i):
        bv = gltf["bufferViews"][i]
        off = bv.get("byteOffset", 0)
        return bin_chunk[off:off + bv["byteLength"]]

    def accessor(i):
        acc = gltf["accessors"][i]
        bv = gltf["bufferViews"][acc["bufferView"]]
        n = COMPONENTS[acc["type"]]
        dtype = np.dtype(DTYPES[acc["componentType"]])
        start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
        stride = bv.get("byteStride", n * dtype.itemsize)
        raw = np.frombuffer(bin_chunk, dtype=np.uint8, count=stride * (acc["count"] - 1) + n * dtype.itemsize, offset=start)
        rows = np.lib.stride_tricks.as_strided(raw, shape=(acc["count"], n * dtype.itemsize), strides=(stride, 1))
        out = np.ascontiguousarray(rows).view(dtype).reshape(acc["count"], n).astype(np.float64)
        if acc.get("normalized") and acc["componentType"] != 5126:
            out /= np.iinfo(dtype).max
        return out
    return gltf, view, accessor


def node_matrices(gltf):
    """World matrix for every mesh index (first node that uses it)."""
    import numpy as np

    def local(node):
        if "matrix" in node:
            return np.array(node["matrix"], dtype=np.float64).reshape(4, 4).T
        t = np.eye(4)
        t[:3, 3] = node.get("translation", [0, 0, 0])
        x, y, z, w = node.get("rotation", [0, 0, 0, 1])
        r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0], [0, 0, 0, 1]])
        s = np.diag(list(node.get("scale", [1, 1, 1])) + [1])
        return t @ r @ s

    found = {}

    def walk(i, parent):
        node = gltf["nodes"][i]
        m = parent @ local(node)
        if "mesh" in node and node["mesh"] not in found:
            found[node["mesh"]] = m
        for c in node.get("children", []):
            walk(c, m)
    scene = gltf.get("scenes", [{"nodes": list(range(len(gltf.get("nodes", []))))}])[gltf.get("scene", 0)]
    for i in scene["nodes"]:
        walk(i, np.eye(4))
    return found


def write_glb(sections):
    """sections: list of (name, rgb_linear[3], positions Nx3 float32, normals Nx3 float32). Non-indexed tris."""
    import numpy as np
    bin_parts, views, accessors, meshes, materials, nodes = [], [], [], [], [], []
    offset = 0

    def add(arr, target=34962):
        nonlocal offset
        b = arr.astype(np.float32).tobytes()
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(b), "target": target})
        bin_parts.append(b)
        offset += len(b)
        return len(views) - 1

    for i, (name, rgb, pos, nor) in enumerate(sections):
        pv, nv = add(pos), add(nor)
        accessors.append({"bufferView": pv, "componentType": 5126, "count": len(pos), "type": "VEC3",
                          "min": pos.min(0).tolist(), "max": pos.max(0).tolist()})
        accessors.append({"bufferView": nv, "componentType": 5126, "count": len(nor), "type": "VEC3"})
        materials.append({"name": name, "pbrMetallicRoughness": {"baseColorFactor": [*map(float, rgb), 1.0],
                                                                 "metallicFactor": 0.0, "roughnessFactor": 1.0}})
        meshes.append({"name": name, "primitives": [{"attributes": {"POSITION": 2 * i, "NORMAL": 2 * i + 1}, "material": i}]})
        nodes.append({"name": name, "mesh": i})
    blob = b"".join(bin_parts)
    return pack_glb({"asset": {"version": "2.0", "generator": "harleys-team tripo_model.py"}, "scene": 0,
            "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": meshes,
            "materials": materials, "accessors": accessors, "bufferViews": views,
            "buffers": [{"byteLength": len(blob)}]}, blob)


def shrink_textures(glb, max_px):
    """Rewrite every embedded image to at most max_px on its longest side (JPEG, or PNG if it has alpha)."""
    from PIL import Image
    json_len = struct.unpack("<I", glb[12:16])[0]
    gltf = json.loads(glb[20:20 + json_len])
    rest = glb[20 + json_len:]
    blob = rest[8:8 + struct.unpack("<I", rest[:4])[0]] if rest else b""
    replace, sizes = {}, []
    for img in gltf.get("images", []):
        if "bufferView" not in img:
            continue
        bv = gltf["bufferViews"][img["bufferView"]]
        data = blob[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        pic = Image.open(io.BytesIO(data))
        if max(pic.size) > max_px:
            pic.thumbnail((max_px, max_px), Image.LANCZOS)
            out = io.BytesIO()
            if pic.mode in ("RGBA", "LA") or "transparency" in pic.info:
                pic.save(out, "PNG", optimize=True)
                img["mimeType"] = "image/png"
            else:
                pic.convert("RGB").save(out, "JPEG", quality=88)
                img["mimeType"] = "image/jpeg"
            replace[img["bufferView"]] = out.getvalue()
        sizes.append(list(pic.size))
    if not replace:
        return glb, sizes
    parts, offset = [], 0
    for i, bv in sorted(enumerate(gltf["bufferViews"]), key=lambda x: x[1].get("byteOffset", 0)):
        data = replace.get(i) or blob[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        pad = -offset % 4
        parts.append(b"\0" * pad)
        offset += pad
        bv["byteOffset"], bv["byteLength"] = offset, len(data)
        parts.append(data)
        offset += len(data)
    new_blob = b"".join(parts)
    gltf["buffers"][0]["byteLength"] = len(new_blob)
    return pack_glb(gltf, new_blob), sizes


def pack_glb(gltf, blob):
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    blob += b"\0" * (-len(blob) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    return (struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(js), 0x4E4F534A) + js
            + struct.pack("<II", len(blob), 0x004E4942) + blob)


def describe(glb):
    json_len = struct.unpack("<I", glb[12:16])[0]
    gltf = json.loads(glb[20:20 + json_len])
    tris = sum(gltf["accessors"][p["indices"]]["count"] // 3 if "indices" in p else
               gltf["accessors"][p["attributes"]["POSITION"]]["count"] // 3
               for m in gltf["meshes"] for p in m["primitives"])
    return {"triangles": tris, "joints": sum(len(s["joints"]) for s in gltf.get("skins", [])),
            "animations": [an.get("name") for an in gltf.get("animations", [])]}


# ---------- palette sections ----------

def srgb_to_linear(c):
    import numpy as np
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def style_palette():
    path = os.path.join(ROOT, "docs", "game-plan.md")
    try:
        text = open(path, encoding="utf-8").read()
    except OSError:
        return []
    m = re.search(r"^## Style\b(.*?)(?=^## |\Z)", text, re.S | re.M)
    return list(dict.fromkeys(h.upper() for h in re.findall(r"#[0-9A-Fa-f]{6}\b", m.group(1) if m else "")))


def bake_sections(glb, palette_hex):
    """Painted GLB -> list of sections, one per palette colour, coloured per triangle."""
    import numpy as np
    from PIL import Image
    gltf, view, accessor = read_glb(glb)
    worlds = node_matrices(gltf)
    images = {}
    tris, colours = [], []
    for mi, mesh in enumerate(gltf["meshes"]):
        world = worlds.get(mi, np.eye(4))
        for prim in mesh["primitives"]:
            pos = accessor(prim["attributes"]["POSITION"])
            pos = (np.c_[pos, np.ones(len(pos))] @ world.T)[:, :3]
            idx = accessor(prim["indices"]).astype(np.int64).ravel() if "indices" in prim else np.arange(len(pos))
            faces = idx.reshape(-1, 3)
            mat = gltf.get("materials", [{}])[prim["material"]] if "material" in prim else {}
            pbr = mat.get("pbrMetallicRoughness", {})
            factor = np.array(pbr.get("baseColorFactor", [1, 1, 1, 1])[:3])
            tex = pbr.get("baseColorTexture")
            uv_key = f"TEXCOORD_{tex.get('texCoord', 0)}" if tex else None
            if tex and uv_key in prim["attributes"]:
                img_i = gltf["textures"][tex["index"]]["source"]
                if img_i not in images:
                    images[img_i] = np.asarray(Image.open(io.BytesIO(view(gltf["images"][img_i]["bufferView"]))).convert("RGB"),
                                               dtype=np.float64) / 255.0
                img = images[img_i]
                h, w = img.shape[:2]
                uv = accessor(prim["attributes"][uv_key])
                # 4 samples per triangle (3 inset corners + centre), averaged: robust to seams.
                c = uv[faces]
                centre = c.mean(1, keepdims=True)
                samples = np.concatenate([centre + 0.6 * (c - centre), centre], 1)
                px = np.clip((samples[..., 0] % 1.0) * w, 0, w - 1).astype(int)
                py = np.clip((samples[..., 1] % 1.0) * h, 0, h - 1).astype(int)
                rgb = img[py, px].mean(1) * factor   # sRGB-ish 0..1
            else:
                rgb = np.tile(factor, (len(faces), 1))
            tris.append(pos[faces])
            colours.append(rgb)
    tris = np.concatenate(tris)
    colours = np.concatenate(colours)

    if palette_hex:
        pal = np.array([[int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)] for h in palette_hex])
        names = palette_hex
    else:   # no palette: let Pillow pick 6 representative colours
        sample = Image.fromarray((colours.reshape(-1, 1, 3) * 255).astype(np.uint8)).quantize(6)
        pal = np.array(sample.getpalette()[:18]).reshape(6, 3) / 255
        names = ["#%02X%02X%02X" % tuple((p * 255).round().astype(int)) for p in pal]
    # nearest palette colour, weighted RGB distance (closer to perceived difference than plain RGB)
    weights = np.array([0.3, 0.59, 0.11]) ** 0.5
    choice = (((colours[:, None, :] - pal[None]) * weights) ** 2).sum(-1).argmin(1)

    sections = []
    for k, name in enumerate(names):
        sel = tris[choice == k]
        if not len(sel):
            continue
        n = np.cross(sel[:, 1] - sel[:, 0], sel[:, 2] - sel[:, 0])
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
        sections.append((name, srgb_to_linear(pal[k]), sel.reshape(-1, 3), np.repeat(n, 3, 0)))
    return sections, len(tris)


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--image", help="concept picture of ONE object on a plain background (PNG/JPEG)")
    src.add_argument("--prompt", help="text description, if there is no picture")
    src.add_argument("--rebake", action="store_true", help="recolour the saved painted original, no API call")
    ap.add_argument("--name", required=True, help="file name for assets/models/<name>.glb (lowercase, dashes)")
    ap.add_argument("--palette", help='comma-separated hex colours; default: the Style section of docs/game-plan.md')
    ap.add_argument("--one-color", action="store_true", help="no paint, no sections: one plain mesh")
    ap.add_argument("--character", action="store_true",
                    help="textured, rigged character (T-pose concept works best); add --animations")
    ap.add_argument("--animations", help="with --character: up to 5 presets, e.g. idle,walk,run,jump,climb")
    ap.add_argument("--faces", type=int, help="face budget, 500-6000 (default 2000; 6000 with --character)")
    ap.add_argument("--timeout", type=int, default=600, help="seconds to wait for Tripo (default 600)")
    a = ap.parse_args()
    if a.faces is None:
        a.faces = MAX_FACES if a.character else 2000

    os.makedirs(SOURCE_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{a.name}.glb")
    source = os.path.join(SOURCE_DIR, f"{a.name}.glb")
    task_id = credits = None

    if a.character:
        if a.rebake:
            sys.exit("--rebake only works for colour-section models")
        key = os.environ.get("TRIPO_API_KEY") or sys.exit("TRIPO_API_KEY is not set")
        raw, info = character(a, key)
        with open(source, "wb") as f:
            f.write(raw)
        small, sizes = shrink_textures(raw, MAX_TEXTURE)
        with open(out, "wb") as f:
            f.write(small)
        print(json.dumps({"file": f"assets/models/{a.name}.glb", **info, **describe(small),
                          "textures": sizes, "bytes": len(small)}))
        return

    if a.rebake:
        with open(source, "rb") as f:
            raw = f.read()
    else:
        key = os.environ.get("TRIPO_API_KEY")
        if not key:
            sys.exit("TRIPO_API_KEY is not set")
        raw, task_id, credits = generate(a, key, painted=not a.one_color)
        with open(source, "wb") as f:
            f.write(raw)

    result = {"file": f"assets/models/{a.name}.glb", "task_id": task_id, "credits": credits}
    if a.one_color:
        with open(out, "wb") as f:
            f.write(raw)
    else:
        palette = [h.strip().upper() for h in a.palette.split(",")] if a.palette else style_palette()
        sections, tri_count = bake_sections(raw, palette)
        with open(out, "wb") as f:
            f.write(write_glb(sections))
        result.update({"triangles": tri_count, "palette_source": "--palette" if a.palette else
                       ("game-plan Style" if palette else "auto (6 colours)"),
                       "sections": {name: len(pos) // 3 for name, _, pos, _ in sections}})
    result["bytes"] = os.path.getsize(out)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
