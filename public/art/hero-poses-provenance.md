# 小羽封面身份一致的四姿勢透明圖集

- 日期：2026-10-08。
- 產出工具：Codex 內建 `image_gen.imagegen`，兩次身份保持圖像呼叫；先生成透明姿勢變體，再以原始封面與首版图集為參考做一次定向修正。
- 身份來源：本遊戲原創 `public/art/title-cover-v1.webp` 中的小羽。先用 `view_image` 檢視封面，要求維持封面的臉部比例、飽滿臉頰、細緻棕色虹膜、層次棕髮、彎尖青綠寬帽、金邊布料法袍披風、奶油長褲與金靴。
- 定稿資產：`public/art/hero-poses-v3.webp`。
- 實際原生解析度：1254 × 1254 px，RGBA，alpha 0–255；工具未採用提示中请求的 2048 × 2048／1536 × 1536，沒有假升頻。
- WebP 大小：1,147,576 bytes。
- WebP SHA-256：`370911dbc51cfc57d40780caa77d14e0dceb029fe31e8c280863c3fb4933feb9`。
- 保留的完整來源：`test-results/hero-poses-v3-original.png`，1,586,526 bytes。
- 来源 PNG SHA-256：`302153e1df2f803b47ea2796c4c91c371da73020dd8e5cc394475f3703354908`。
- 首次生成：`test-results/hero-poses-v3-first.png`；定稿選用第二次生成，沒有使用首版替換定稿身份。
- 轉檔方式：工作區內建 Pillow，WebP `lossless=True, method=6, exact=True`。已讀回 WebP，RGBA 像素陣列和定稿 PNG 完全相等。沒有裁切、重新排版、縮放、抠背景、補畫或修改像素。
- 本圖片是預先渲染的 3D 姿勢圖，供遊戲中的 2.5D 角色使用；不是具可轉動幾何網格的即時 3D 角色模型。
- 四姿勢按概念位置排列：左上歡迎待機、右上蓄勢、左下朝右施法、右下輕微受擊。沒有盾牌、機器人、無人機、背景、文字、烘焙粒子或地面陰影。
- 已用 `view_image` 檢視定稿與 WebP；主角的臉、髮型、服裝與封面一致，手腕和魔杖連接，完整金環與寶石保留。

## UV 框及特效錨點

圖像生成沒有完全遵守等分格邊距，所以必須使用下表的**自訂矩形 UV**，不要把圖片簡單切成四個 627 × 627 格。所有座標以圖像左上為 (0,0)，x 向右、y 向下。

- UV 矩形為 `x, y, width, height`。
- 主體 bounds 為 alpha > 20 連通組件的 `xmin, ymin, xmax, ymax`，xmax/ymax 是不包含的右下界。
- 建議 sprite 的 `alphaTest = 0.08`。这样丟棄 alpha ≤ 20 的极淡透明邊緣，四個 UV 框內都沒有其他姿勢的可見像素。完整 alpha > 0 有細薄的跨行邊緣，因此不應使用較低閾值搭配同一組框。
- sole 是可見靴底的地面錨點：用 alpha ≥ 128 的最低行與該姿勢最後 65 px 靴部範圍的水平中心测量，不包含地面陰影。接觸陰影由遊戲獨立繪製。
- hatTop 是 alpha > 20 中帽頂最高行的平均 x。
- gem 是金環內青綠晶體的顏色質心，作為施法原點。於人工檢視的晶體 ROI 內篩選 alpha > 128 且綠、藍各高於紅 8 的像素，不包含金環與杖桿。
- 最右欄 gemNormalized 是相對該姿勢**自訂 UV 框**的 0–1 座標，不是相對名義 627 × 627 圖格。

| 姿勢 | UV x,y,w,h | 主體 alpha>20 bounds | sole 全圖 x,y | hatTop 全圖 x,y | gem 全圖 x,y | gemNormalized x,y |
| --- | --- | --- | --- | --- | --- | --- |
| idle | 48, 0, 542, 650 | 77, 23, 563, 641 | 323.5, 641 | 221, 23 | 506.97, 107.79 | 0.846808, 0.165831 |
| windup | 690, 0, 564, 650 | 714, 26, 1215, 647 | 975, 647 | 931, 26 | 766.31, 138.62 | 0.135301, 0.213262 |
| release | 36, 650, 654, 604 | 64, 658, 662, 1228 | 290, 1228 | 215, 658 | 603.18, 815.95 | 0.867248, 0.274752 |
| hurt | 690, 650, 564, 604 | 726, 654, 1216, 1235 | 1006.5, 1234 | 823, 654 | 1160.53, 766.05 | 0.834273, 0.192136 |

完整可讀量測資料另存於不公開的 `test-results/hero-poses-v3-final-metadata.json`。

## 首次生成完整提示詞

```text
Use case: identity-preserve character pose atlas, transparent extraction and pose variants.
Asset type: Original AI Campus Guardians protagonist animation sprite sheet.

Use the provided ORIGINAL game cover as the strict character identity source. Make a new transparent pose atlas of EXACTLY THAT SAME BOY MAGICIAN, Xiao-Yu. This is identity-preserving extraction/pose variation, not redesign, not a new similar boy. Carefully preserve his specific facial proportions, round full cheeks, very small gently upturned nose, youthful face silhouette, large detailed dark-brown irises with pupils and small warm catchlights, raised soft eyebrows, broad smiling mouth and visible upper teeth, short tousled layered dark-brown hair with the same side-swept fringe and clumps. Preserve the same premium detailed rounded 3D render and warm natural light from upper left. The face must be unmistakably the same as the cover and exactly consistent across all four poses.

Preserve his exact cover outfit: large broad teal wizard hat with bent floppy tapered tip, small gold end ornament, gold hat band, pale cream-white star with gold edging on front; textured teal coat with gold edging and short cape; cream collar and chest star brooch; brown belt with gold round clasp and little pouch; cream pants; gold boots with brown soles. Same boy body proportions and material detail. He carries the same slender dark teal-and-gold staff topped by a thin gold ring surrounding a large faceted pale-teal gemstone. No shield.

Canvas: 2048×2048 square if possible, high resolution. EXACT 2×2 atlas with four equal 1024×1024 square cells. Reading order: idle TOP LEFT, windup TOP RIGHT, casting release BOTTOM LEFT, hurt/recoil BOTTOM RIGHT. All four portraits must show the ENTIRE BODY from hat tip to boot soles, at the exact same body scale and fixed front/slight-three-quarter camera angled gently toward the RIGHT. Body midpoint near each cell x=0.48. Hat top near 6% of cell height; boot sole baseline near 93% of cell height. Every finger, cloak edge, staff ring and gemstone must remain inside its cell with ample transparent margin. No overlaps between cells. No grid lines.

FOUR POSES:
1. TOP LEFT — Idle/welcoming: the cover boy's cheerful welcoming pose, free palm gently open inviting toward viewer/right and staff upright in the other hand. Same cover face and friendly smile. The gemstone sits around normalized cell x=0.76,y=0.18.
2. TOP RIGHT — Windup/gathering: exactly the same boy drawing the staff back toward his left/behind the shoulder, preparing a spell. Both arms anatomically connected to shoulders, staff firmly held in one real hand. Torso only slightly turns, same fixed camera and clearly visible same face, bright determined smile. Feet still on the same ground baseline. Ring/gem toward cell x=0.20,y=0.24. No energy effects.
3. BOTTOM LEFT — Casting/release: the same boy confidently extends the staff aiming diagonally to the RIGHT, where the opponent will be. Staff ring/gem clearly at the forward right end around cell x=0.84,y=0.40; the connected gripping hand and forearm clearly aim it. Small natural step/forward lean but unchanged apparent scale and boot sole baseline. Face remains visibly the SAME cover boy, enthusiastic gentle smile. Free hand balances the casting pose. No projectile, no sparkle, no glow trail.
4. BOTTOM RIGHT — Hurt/recoil: exactly the same boy recoiling slightly with concerned eyebrows and a small worried mouth, one free hand lifted for balance, the other still holding the staff connected to his hand. Child-friendly mild surprise, never injury or distress. Same facial anatomy, same layered hair, same hat. A slight backward lean only, boots aligned to the same baseline, staff and gem fully within cell, gem toward x=0.76,y=0.45.

Do not substitute a generic toy mascot, flat anime face, emoji eyes, procedural low-poly geometry, different hair/hat, older child, toddler, or a different facial model. Do not simplify the cover facial structure or shiny detailed irises. Maintain precisely the cover's quality and identity across all four poses, while changing ONLY limb poses and appropriate expressions. Anatomical hands have natural connected wrists and fingers; no detached hands, floating staff, extra limbs or duplicated staff.

STRICT: Genuinely transparent alpha background around each complete character, no opaque backdrop, no floor, no ground shadows, no colored studio-gradient panels, no checkerboard painted in. Only the four poses of this one exact same magician; no robot, drone, animal, enemy, book, floating pages, UI, text, numbers, logo, watermark, particles, spell rings outside the staff, magic beams, baked sparkles or glows. Gem has faceted material but no baked emitted effects. All visual spell particles will be added by the live game.
```

## 定稿修正完整提示詞

```text
Use case: identity-preserve pose atlas, focused framing correction.
Edit the FIRST provided image (four-pose magician atlas). The SECOND image is the original game title cover and is supplied again to lock this SAME boy's face and specific outfit. Preserve the boy's exact identity from that cover: same rounded cheek fullness, little nose, large detailed brown irises, layered tousled brown hair, smile/upper teeth and broad bent teal star hat. Preserve all existing four pose meanings and high-detail warm 3D materials. NO redesign, NO different face.

Make a final clean 2×2 transparent atlas with equal square cells. Please render at native 2048×2048 square, or at least 1536×1536 square if available; do NOT merely upscale a smaller bitmap. Cells reading order remain idle/welcome top-left, windup gathering top-right, release/casting toward RIGHT bottom-left, mild hurt/recoil bottom-right.

Correct the framing precisely: in EACH square cell the entire hat, cape, boots, hands AND THE COMPLETE STAFF/GOLD RING/GEM must fit fully INSIDE the cell with at least 5% transparent margin on every side. No part may cross the vertical or horizontal centerline. Keep identical body scale across all four cells, hat top at approximately 6% cell height and lowest BOOT SOLES at approximately 93% cell height. Do not draw ground shadows. Both feet must stay fully visible and consistently grounded at that sole baseline. Keep all limbs anatomically connected, fingers natural, staff held by a connected hand.

Especially fix the BOTTOM LEFT CASTING pose: shorten/re-angle the staff and draw the casting hand slightly inward so the whole gold ring and pale-teal faceted gem sit around normalized cell x=0.84,y=0.40, its rightmost rim safely before x=0.94. Continue aiming the staff diagonally to the RIGHT. Do not let the ring cross into the hurt/recoil cell. All poses are viewed from the same front/slight-three-quarter camera angle; do not change identity or make any pose a different child.
Idle upright gem near (0.78,0.20), windup gem near (0.20,0.24), release gem near (0.84,0.40), recoil gem near (0.78,0.45). Maintain sufficient transparent padding everywhere. The free palms/hands remain physically attached at wrists.

Clean true alpha-transparent silhouettes with natural antialiasing; no colored halos/fringe, no background, no floor, no grid lines, no checkerboard. Remove every baked sparkle, particle, ray, trail or emitted glow; gold ring and gemstone are solid objects with material highlights only. NO shield, robot, drone, extra figures, detached hand, floating staff, extra limb, text, number, logo or UI.
```
