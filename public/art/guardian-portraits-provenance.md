# 原創六主題機器人透明肖像圖集

- 日期：2026-10-07。
- 工具：Codex 內建 `image_gen.imagegen`，以本遊戲原創 `public/art/title-cover-v1.webp` 中的米米為角色身份與精緻 3D 光影參考，衍生六主題頭肩肖像；未覆寫封面。
- 產出：`public/art/guardian-portraits-v1.webp`，1536 × 1024 px，RGBA 透明背景。
- 完整源檔：`test-results/guardian-portraits-v1-original.png`（不公開）。
- 圖集分割：3 欄 × 2 列，每格 512 × 512 px；從左到右、從上到下為金黃放大鏡、青綠書籤、藍色三按鈕、紫色稜鏡、珊瑚書本、靛藍三天線。
- 網頁建議：使用 `background-size: 300% 200%`；每列欄位位置依序 `0% 0%`、`50% 0%`、`100% 0%`、`0% 100%`、`50% 100%`、`100% 100%`。所有格子使用同尺寸正方形容器。
- 格式轉換：Pillow WebP quality 90、method 6、exact=True，保留原始大小與透明 alpha；未用程式移除背景、裁切或重繪。
- 檢視：六個肖像順序、徽記與角色風格一致，沒有文字或 UI。已直接確認原圖與 WebP 含 alpha 通道，角落是透明，而不是畫出的棋盤或白色背景。

## 最終提示詞

```text
Use case: identity-preserve character portrait atlas.
Asset type: Transparent 3D game character portrait sprite sheet for the original AI Campus Guardians game.

Derive a new portrait-sheet asset from ONLY the friendly golden robot in the provided original game cover reference. Preserve this robot's exact charming rounded high-quality 3D style: smooth toy-metal/material shading, rounded domed head with subtle forehead brow, large rounded dark navy-black face panel, two warm pale-yellow oval eyes, small curved smile, dark navy side ear fittings, rounded shoulders and warm metallic trim. Exclude the boy and every environmental element. The cover itself must remain unchanged.

Output a transparent-background, landscape 3:2 sprite atlas, ideally 1536×1024. Arrange EXACTLY SIX separate robot head-and-shoulders portraits in an EXACT 3-column by 2-row evenly divided grid. Each cell is a square of identical size. Every portrait is centered in its own cell with the same scale, the same eye line, equal head size and equal upper-chest crop. Leave clear transparent padding around every portrait so none touches a neighboring cell. Portrait silhouette width about 70% of its cell, height about 80%. Top-row centers at (one-sixth width, one-quarter height), (one-half width, one-quarter height), (five-sixths width, one-quarter height); bottom-row centers at same x positions and three-quarter height. NO grid lines or backgrounds between cells. Friendly front-facing/slight three-quarter view, all matched and beautifully rendered.

Variants IN THIS EXACT READING ORDER left to right, top to bottom:
1. Top left: original warm golden-yellow robot, thin dark antenna with a gold ball, a large simple dark magnifying-glass emblem on its visible upper chest.
2. Top center: teal robot with warm-gold trim, single small antenna, a simple small golden bookmark-shaped crest or upper-chest badge.
3. Top right: bright medium-blue robot with warm-gold trim, single antenna, three small pale-gold round buttons in a row on the visible upper chest.
4. Bottom left: soft rich purple robot with warm-gold trim, single antenna, a small clear pale-teal faceted prism/gem-shaped emblem on the visible upper chest.
5. Bottom center: warm coral-orange robot with warm-gold trim, single antenna, a simple small cream open-book emblem on the visible upper chest; no writing.
6. Bottom right: rich indigo-blue robot with warm-gold trim, three short neat antenna prongs with gold ball tips above its head (only this variant has three), and a simple plain golden upper-chest plate.

The eyes and smile stay warm yellow and friendly on every robot. These are original helpful campus services, not enemies. Match the first cover's premium rounded 3D lighting and smooth polished character quality, not flat SVG, not generic emoji, not a low-poly cuboid, not a drawing. Clear studio lighting from upper-left, dimensional soft highlights, no dramatic shadows. Keep all six identities visually from the same original robot family.

Strict constraints: Genuinely transparent alpha background, not white, not checkerboard painted into image. Exactly six bust portraits, no full bodies, no hands, no magic, no environment, no magician, no humans, no text or letters, no numbers, no title, no UI, no tile cards, no borders, no logos, no watermark. The small thematic emblems described are the only badges. Every head, antenna, side ear and shoulder must fit inside its own equal grid cell with transparent margins.
```
