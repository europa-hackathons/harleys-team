"""Make a low-poly game mesh with the Tripo API (v3) and save it to assets/models/.

Usage (from the repo root):
  python tools/tripo_model.py --image assets/concepts/hero-model.png --name hero
  python tools/tripo_model.py --prompt "a chunky low-poly chimney" --name chimney

Reads the API key from the TRIPO_API_KEY environment variable. Standard library only.
Requests smart_low_poly with no texture and no PBR (the game shades triangles with flat
palette colours, see src/models.js). Prints one JSON line with the result.
"""
import argparse, json, mimetypes, os, sys, time, urllib.error, urllib.request, uuid

API = "https://openapi.tripo3d.ai/v3"
MODEL_VERSION = "v3.1-20260211"   # smart_low_poly needs v3.0-20250812 or newer
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "models")


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


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--image", help="concept picture of ONE object on a plain background (PNG/JPEG)")
    src.add_argument("--prompt", help="text description, if there is no picture")
    ap.add_argument("--name", required=True, help="file name for assets/models/<name>.glb (lowercase, dashes)")
    ap.add_argument("--faces", type=int, default=2000, help="triangle budget, 500-20000 (default 2000)")
    ap.add_argument("--timeout", type=int, default=600, help="seconds to wait for Tripo (default 600)")
    a = ap.parse_args()

    key = os.environ.get("TRIPO_API_KEY")
    if not key:
        sys.exit("TRIPO_API_KEY is not set")
    faces = max(500, min(20000, a.faces))
    options = {"model": MODEL_VERSION, "smart_low_poly": True, "texture": False, "pbr": False,
               "face_limit": faces, "export_uv": True}

    if a.image:
        options["input"] = upload(a.image, key)
        path = "/generation/image-to-model"
    else:
        options["prompt"] = a.prompt
        path = "/generation/text-to-model"
    task_id = call("POST", path, key, json.dumps(options).encode(), {"Content-Type": "application/json"})["task_id"]
    print(f"task {task_id} started", file=sys.stderr)

    deadline = time.time() + a.timeout
    while True:
        task = call("GET", f"/tasks/{task_id}", key)
        status = task.get("status")
        if status == "success":
            break
        if status in ("failed", "cancelled", "banned", "expired"):
            sys.exit(f"task {task_id} {status}: {task.get('error_code')} {task.get('error_message')}")
        if time.time() > deadline:
            sys.exit(f"task {task_id} still {status} after {a.timeout}s")
        print(f"  {status} {task.get('progress', 0)}%", file=sys.stderr)
        time.sleep(5)

    url = task["output"]["model_url"]
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{a.name}.glb")
    with urllib.request.urlopen(url, timeout=120) as r, open(out, "wb") as f:
        f.write(r.read())
    print(json.dumps({"file": f"assets/models/{a.name}.glb", "bytes": os.path.getsize(out), "task_id": task_id,
                      "credits": task.get("credits_consumed"), "faces": faces}))


if __name__ == "__main__":
    main()
