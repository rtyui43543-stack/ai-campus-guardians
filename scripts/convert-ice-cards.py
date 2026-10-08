"""Lossless packaging only: preserve every generated ice-card pixel and canvas."""
from pathlib import Path
import argparse
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("starter_source", type=Path)
parser.add_argument("advanced_source", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
for source, name in [(args.starter_source, "ultimate-6-ice-v2.webp"),
                     (args.advanced_source, "ultimate-advanced-6-ice-v2.webp")]:
    target = root / "public" / "art" / name
    with Image.open(source) as original:
        rgba = original.convert("RGBA")
        assert rgba.size == (1024, 1536), f"Unexpected canvas: {rgba.size}"
        rgba.save(target, "WEBP", lossless=True, method=6, exact=True)
        with Image.open(target) as packaged:
            assert packaged.size == rgba.size
            assert packaged.convert("RGBA").tobytes() == rgba.tobytes(), "Pixels changed"
    print(f"Verified unchanged pixels: {target.name} ({target.stat().st_size:,} bytes)")
