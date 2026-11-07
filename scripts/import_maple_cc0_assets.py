#!/usr/bin/env python3
"""Download pinned CC0 third-party GLBs for Garage Gauntlet / Maple Junction.

Only exact whitelisted GitHub blobs are accepted. Each download is checked
against its originating Git blob SHA-1, with glTF and triangle/bounds validation.
This script runs in GitHub Actions so the published town includes locally hosted
GLBs and does not need fragile runtime requests to third-party services.

Usage: python scripts/import_maple_cc0_assets.py
Dependencies: trimesh, numpy (installed by the Pages workflow).
"""
from __future__ import annotations

import hashlib
import json
import math
import pathlib
import struct
import time
import urllib.parse
import urllib.request

import trimesh

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "maple" / "imported"
OUT.mkdir(parents=True, exist_ok=True)

KENNEY_REPO = "petroulacl/fps-buildings-env-kit"
KENNEY_REV = "1dd8e932402deb82422920df2e7fd079391e55d3"
KENNEY_ROOT = "buildings/kenney-city-kit-suburban/Models/GLB format"

QUATERNIUS_REPO = "anshaneja5/skyline-run"
QUATERNIUS_REV = "0c41526d8d4130c37c15e219c2c3737fa8cb4ad8"
QUATERNIUS_ROOT = "public/assets/models"

# Source repository, pinned revision and git blob SHA are checked to protect
# against upstream updates, mistakes and HTML pretending to be a GLB file.
SOURCES = [
    ("house_a", "building-type-a.glb", KENNEY_REPO, KENNEY_REV, f"{KENNEY_ROOT}/building-type-a.glb", "870bf63ab3ddedbaa44e238b2025b98d5426d46e", "Kenney City Kit Suburban", "CC0-1.0"),
    ("house_b", "building-type-b.glb", KENNEY_REPO, KENNEY_REV, f"{KENNEY_ROOT}/building-type-b.glb", "d25162a98353fb557c987bf44663261f41c95667", "Kenney City Kit Suburban", "CC0-1.0"),
    ("house_c", "building-type-c.glb", KENNEY_REPO, KENNEY_REV, f"{KENNEY_ROOT}/building-type-c.glb", "91bbbacbccfd63ca56cb40573a96bec93528865f", "Kenney City Kit Suburban", "CC0-1.0"),
    ("house_f", "building-type-f.glb", KENNEY_REPO, KENNEY_REV, f"{KENNEY_ROOT}/building-type-f.glb", "db68497199c8469b3190cfb41b1a61c4f0c79f9c", "Kenney City Kit Suburban", "CC0-1.0"),
    ("house_j", "building-type-j.glb", KENNEY_REPO, KENNEY_REV, f"{KENNEY_ROOT}/building-type-j.glb", "363afd7c2ae39e00d28843fe34996f5aae892b15", "Kenney City Kit Suburban", "CC0-1.0"),
    ("house_t", "building-type-t.glb", KENNEY_REPO, KENNEY_REV, f"{KENNEY_ROOT}/building-type-t.glb", "d655da71e7bd17946d377409e34b3f986ccead", "Kenney City Kit Suburban", "CC0-1.0"),
    ("warehouse", "b_small.glb", QUATERNIUS_REPO, QUATERNIUS_REV, f"{QUATERNIUS_ROOT}/b_small.glb", "8f8edb201fc44f8b9eb7a4d4778cd1272e28c0e4", "Quaternius Downtown City MegaKit", "CC0-1.0"),
    ("leafy_tree", "tree1.glb", QUATERNIUS_REPO, QUATERNIUS_REV, f"{QUATERNIUS_ROOT}/tree1.glb", "80bd662cc51f983986f4e201463dc3a729a6cd4a", "Quaternius Stylized Nature MegaKit", "CC0-1.0"),
    ("shade_tree", "tree3.glb", QUATERNIUS_REPO, QUATERNIUS_REV, f"{QUATERNIUS_ROOT}/tree3.glb", "828786b4bdb5224a8b3672f5e5d6cebe1c65bd93", "Quaternius Stylized Nature MegaKit", "CC0-1.0"),
    ("shrub", "bush.glb", QUATERNIUS_REPO, QUATERNIUS_REV, f"{QUATERNIUS_ROOT}/bush.glb", "84b4153c17e988a658e56d4093b0028d1b034c3f", "Quaternius Stylized Nature MegaKit", "CC0-1.0"),
    ("palette", "Textures/colormap.png", KENNEY_REPO, KENNEY_REV, f"{KENNEY_ROOT}/Textures/colormap.png", "9838fb4ccae35aa66eb2392e7f25c88f7ca28b38", "Kenney City Kit Suburban", "CC0-1.0"),
]


def git_blob_sha(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode()
    return hashlib.sha1(header + data).hexdigest()


def download(repo: str, revision: str, filename: str) -> bytes:
    path = urllib.parse.quote(filename, safe="/")
    url = f"https://raw.githubusercontent.com/{repo}/{revision}/{path}"
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "GarageGauntlet-CC0-asset-import/1.0"}
            )
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read(7_000_001)
        except Exception as error:
            last_error = error
            if attempt < 3:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed fetching pinned third-party asset {url}: {last_error}")


def glb_json(payload: bytes) -> dict:
    if len(payload) < 20 or payload[:4] != b"glTF":
        raise ValueError("Invalid glTF binary header")
    version, length = struct.unpack_from("<II", payload, 4)
    if version != 2 or length != len(payload):
        raise ValueError(f"Malformed GLB length/version {length}/{version}")
    chunk_len, chunk_type = struct.unpack_from("<II", payload, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError("Missing initial JSON chunk")
    return json.loads(payload[20:20 + chunk_len])


def validate_model(path: pathlib.Path, payload: bytes) -> tuple[list[list[float]], int]:
    document = glb_json(payload)
    if not document.get("meshes"):
        raise ValueError(f"No authored meshes in {path.name}")
    images = document.get("images", [])
    for photo in images:
        uri = photo.get("uri")
        if uri and not uri.startswith("data:"):
            safe_uri = pathlib.PurePosixPath(urllib.parse.unquote(uri))
            if safe_uri.is_absolute() or ".." in safe_uri.parts:
                raise ValueError(f"Unsafe linked texture URI {uri}")
            external = OUT.joinpath(*safe_uri.parts)
            if not external.is_file() and safe_uri.name == "colormap.png":
                # Kenney interchange exporters differ on whether they use
                # colormap.png or Textures/colormap.png in image URIs.
                palette = OUT / "Textures" / "colormap.png"
                if palette.is_file():
                    external.parent.mkdir(parents=True, exist_ok=True)
                    external.write_bytes(palette.read_bytes())
            if not external.is_file():
                raise ValueError(f"Missing sidecar texture {uri} for {path.name}")
    loaded = trimesh.load(path, force="scene", process=False)
    if not loaded.geometry or loaded.bounds is None:
        raise ValueError(f"No valid 3D geometry in {path.name}")
    triangles = sum(len(mesh.faces) for mesh in loaded.geometry.values())
    minimum = loaded.bounds[0].tolist()
    maximum = loaded.bounds[1].tolist()
    if not all(math.isfinite(float(x)) for x in minimum + maximum):
        raise ValueError(f"Non-finite model coordinates in {path.name}")
    if not all(.01 < maximum[i] - minimum[i] < 3000 for i in range(3)):
        raise ValueError(f"Unexpected bounds in {path.name}: {minimum} / {maximum}")
    if triangles < 30 or triangles > 2_000_000:
        raise ValueError(f"Unexpected triangle count {triangles} in {path.name}")
    return [minimum, maximum], triangles


def main():
    records = {}
    # Collect all verified binary resources, including the Kenney palette,
    # before examining GLBs with external texture references.
    for key, filename, repo, revision, source, expected, creator, license_id in SOURCES:
        dst = OUT / filename
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.is_file() and git_blob_sha(dst.read_bytes()) == expected:
            data = dst.read_bytes()
        else:
            data = download(repo, revision, source)
        if not 32 < len(data) < 7_000_000:
            raise ValueError(f"Invalid size for {filename}: {len(data)}")
        actual = git_blob_sha(data)
        if actual != expected:
            raise ValueError(f"Source integrity mismatch: {filename}, {actual} != {expected}")
        dst.write_bytes(data)
        records[key] = {
            "file": filename,
            "source": f"https://github.com/{repo}/blob/{revision}/{urllib.parse.quote(source, safe='/')}",
            "creator": creator,
            "license": license_id,
            "git_blob_sha1": expected,
            "bytes": len(data),
        }

    for key, record in records.items():
        if not record["file"].endswith(".glb"):
            continue
        path = OUT / record["file"]
        bounds, triangles = validate_model(path, path.read_bytes())
        record["bounds"] = bounds
        record["triangles"] = triangles
        print(f"{key:14} {triangles:7} tris, {record['bytes'] / 1024:.1f} KiB, {bounds}")

    catalog = {
        "license": "CC0-1.0",
        "notes": "Pinned, validated GLBs hosted locally with the game; geometry sizes are glTF Y-up units.",
        "models": records,
    }
    (OUT / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n")
    print(f"Imported {len(records) - 1} model GLBs, with source and license provenance.")


if __name__ == "__main__":
    main()
