"""Lossless format conversion for six imagegen portrait card sources.

This script does not crop, resize, composite, recolor, or edit illustration pixels.
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"
QA = ROOT / "test-results"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main(sources):
    if len(sources) != 6:
        raise ValueError("Expected exactly six source PNG paths.")
    QA.mkdir(exist_ok=True)
    metadata = []
    for index, source_arg in enumerate(sources, 1):
        source = Path(source_arg)
        output = ART / f"ultimate-advanced-{index}-v1.webp"
        original_copy = QA / f"ultimate-advanced-{index}-original.png"
        with Image.open(source) as image:
            original = image.convert("RGBA")
            if original.size != (1024, 1536):
                raise ValueError(f"Unexpected original dimensions for {source}: {original.size}")
            original.save(output, "WEBP", lossless=True, method=6, exact=True)
        with Image.open(output) as converted:
            if converted.convert("RGBA").tobytes() != original.tobytes():
                raise ValueError(f"Pixel mismatch after conversion for {output}")
        shutil.copy2(source, original_copy)
        item = {
            "id": index,
            "source": str(source),
            "output": str(output.relative_to(ROOT)),
            "width": 1024,
            "height": 1536,
            "source_sha256": digest(source),
            "webp_sha256": digest(output),
            "webp_bytes": output.stat().st_size,
            "rgba_identical": True,
        }
        metadata.append(item)
        print(json.dumps(item, ensure_ascii=False))
    (QA / "ultimate-advanced-metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main(sys.argv[1:])
