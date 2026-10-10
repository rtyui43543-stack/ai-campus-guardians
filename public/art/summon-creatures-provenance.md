# Advanced ultimate summon creature assets

Date: 2026-10-09

Generated with the built-in `image_gen.imagegen` tool in default built-in mode, using the existing collection cards as identity and rendering-style references. The transparent-background option was set to `true` in both calls. Each creature was generated separately and calls ran sequentially. Source outputs were copied unchanged into the project; no image redrawing, background-removal postprocessing, or channel changes were applied.

## Fire phoenix

- Project asset: `public/art/summon-phoenix-v1.png`
- Reference: `public/art/ultimate-advanced-5-v1.webp`
- Source output: `C:/Users/rtyui/.codex/generated_images/01a11f0b-a965-74a0-b9cf-aab62e81a74d/exec-1539aa42-deb5-404e-9b5f-6c3d0aa9829b.png`
- Format: PNG, 1536 × 1024, RGBA.
- Direction: flying toward the right, head in the upper right, spread wings and full fiery feather tail.
- Alpha verification: 563,708 zero-alpha pixels; 1,009,156 partial-alpha pixels; corner alpha 0. Bounds at alpha > 20: x 11–1526, y 10–1007.
- Visual identity: amber eye, gold hooked beak, flame crest, cream/gold neck feathers, red-orange layered feathers, star chest mark, gold talons, flowing feather tail.

### Exact prompt

Use case: stylized-concept / identity-preserve. Asset type: high-detail transparent game summon sprite for a magic attack. Reference image 1 is the authoritative identity and rendering style for the golden-orange fire phoenix in the upper half of the collection card. Make an isolated full-body render of THAT SAME phoenix, with the same expressive amber eye, hooked golden beak, swept-back flame crest, golden cream neck feathers, orange-red feather layers, gold star chest mark, long elegant fiery feather tail, and huge magnificent spread wings. Face and fly toward the RIGHT in a dynamic three-quarter side flying attack pose, with its face/head clearly visible at the upper-right, feet tucked in, full wings and full tail visible, ample transparent margin on every edge. Preserve fine detailed three-dimensional luminous feathers and the polished fantasy game illustration quality of the reference. Small close-to-body flame wisps and sparks only. Actual transparent alpha background. No wizard/child, no staff, no book/papers, no card frame, no scene, no ground, no full-screen fire cloud, no text, no watermark. The phoenix must look like the referenced collection card creature, not a flat vector, polygon diagram, clip art, or a simplified cartoon. Output only the independent phoenix sprite, complete silhouette, on a genuinely transparent background.

## Crystal ice dragon

- Project asset: `public/art/summon-ice-dragon-v1.png`
- Reference: `public/art/ultimate-advanced-6-ice-v2.webp`
- Source output: `C:/Users/rtyui/.codex/generated_images/01a11f0b-a965-74a0-b9cf-aab62e81a74d/exec-b1d2fa6c-a31e-4490-86e3-c59cbfefeb2d.png`
- Format: PNG, 1536 × 1024, RGBA.
- Direction: flying toward the right, head in the upper right, spread crystal wings, four clawed limbs and full long crystal tail.
- Alpha verification: 599,789 zero-alpha pixels; 973,075 partial-alpha pixels; corner alpha 0. Bounds at alpha > 20: x 15–1507, y 8–1007.
- Visual identity: cyan eye, long angular horned head, white crystal teeth, faceted blue-white scales, icy dorsal spines, broad crystal wings, crystal claws and flowing tail.

### Exact prompt

Use case: stylized-concept / identity-preserve. Asset type: high-detail transparent game summon sprite for an ice magic attack. Reference image 1 is the authoritative identity and rendering style for the blue-white crystal ice dragon in the upper half of the collection card. Make an isolated full-body render of THAT SAME ice dragon: the same long angular horned dragon head, icy blue glowing eye, fierce open jaw with white crystal teeth, prismatic blue-white transparent crystal scales, sharp back spines, faceted ice chest, long crystal neck, two broad outspread crystal wings with translucent membranes and sharp faceted ribs, clawed forelegs and hind legs, and long flowing pointed ice tail. Face and fly toward the RIGHT in a dynamic three-quarter side attack pose, with its head clearly visible at upper-right and full wings, feet and long tail visible. Keep ample transparent margin on every edge, preserve the physical anatomy and polished luminous three-dimensional crystal fantasy illustration quality of the reference. Small close-to-body snow crystals and ice grains only, no large blizzard background. Actual transparent alpha background. No wizard/child, no staff, no card frame, no scene, no ground, no text, no watermark. The creature must be recognizable as the exact crystalline ice dragon in the reference, not a flat blue zigzag, not vector art, not origami, not simplified polygon cartoon. Output only the independent complete crystal dragon sprite on a genuinely transparent background.

## Validation

Both reference cards and generated outputs were visually inspected. Both creatures preserve their card identities and detailed fantasy render style. Alpha counts were computed from decoded RGBA data using the bundled Sharp library read-only; the assets were not modified by that inspection. The non-opaque pixels preserve the tool-generated antialiasing, glow, and translucency.

Additional edge verification: all four corner alpha values are zero for both images. In the outermost 5-pixel border (25,500 pixels), the phoenix has only 1,131 nonzero pixels with maximum alpha 3 and mean alpha 0.0576; the ice dragon has 512 nonzero pixels with maximum alpha 3 and mean alpha 0.0232. Neither asset has an opaque rectangular background. Maximum subject alpha is 254 in both outputs.

## Bundled cold-load fallback

`src/assets/summon-phoenix-fallback.webp` and `src/assets/summon-ice-dragon-fallback.webp` are mechanical 512 × 341 resizes of these same PNG sprites, encoded with Sharp as WebP at quality 90 and alphaQuality 100. No creature was redrawn or replaced. Their alpha channels match the resized source exactly. The original 1536 × 1024 PNGs remain unchanged and are used after successful loading and decoding.

The fallback sprites total 219,868 bytes before base64 encoding. Vite `?inline` imports include them in the application bundle, so the three-second cast does not require another image download when the original PNG is cold, slow or fails. Each cast selects its source once; a completed full-resolution preload is used by later casts without changing the current flight or the 900 ms impact.
