# 六種原創主題魔王肖像圖集

- 日期：2026-10-07。
- 工具方式：Codex 內建 `image_gen.imagegen`，衍生圖集生成與一次局部排版／嘴部修正；未使用 CLI、外部圖片 API 或程式重繪。
- 風格參考：本遊戲原創 `public/art/title-cover-v1.webp`，沿用精緻、暖光、圓潤 Q 版 3D 材質與角色表情；未改動封面。
- 排版參考：本遊戲原創 `public/art/guardian-portraits-v1.webp`，只沿用 3 欄 × 2 列透明肖像圖集的布局。六種新版角色中只有分類機兵是機器人。
- 完整生成源檔：`test-results/boss-portraits-v2-original.png`，1536 × 1024 px，2,219,455 bytes；依專案設定不公開。
- 最终 Web 資產：`public/art/boss-portraits-v2.webp`，1536 × 1024 px，RGBA，274,762 bytes（約 268 KiB）。
- 每格 512 × 512 px，順序如下。

| 格位 | 主題角色 | 外型與材質 |
| --- | --- | --- |
| 左上 | 搜集魔盒 | 黃金棕木活寶箱，拱蓋大眼、鑰匙孔鎖扣、單一微笑與短木手 |
| 中上 | 迷言書靈 | 青綠金邊厚皮革魔法書，紙頁翅膀、大棕眼與書籤 |
| 右上 | 混淆機兵 | 藍色圓潤金屬機器人，胸前紅黃綠三色分類圓點 |
| 左下 | 幻影面具 | 奶油戲劇面具、棕色發光眼、金飾紫兜帽與布披風 |
| 中下 | 代寫紙龍 | 珊瑚紅／奶油白摺紙小龍，纸頁翅膀、紙角、大棕眼與龍嘴 |
| 右下 | 全能齒輪王 | 具有毛髮鬃毛與毛掌的獅王，棕眼獅鼻嘴、金色齒輪皇冠與靛藍皇家披風 |

## 圖格與透明驗證

- Pillow 僅轉檔為 WebP（quality 90、method 6、exact=True）與讀取圖片驗證，沒有裁切、重繪、補背景或修改角色內容。
- 原圖與 WebP 的 alpha 範圍均為 0–254，WebP 有 972,565 個全透明像素；透明像素的 RGB 色彩不会呈現在正常的網頁 alpha 合成中。
- x=512、x=1024、y=512 邊界附近 alpha 最大為 1，沒有可見角色跨格；以 alpha > 20 取得各格相對主體邊界依序為：
  - 左上：(94,117)–(471,441)。
  - 中上：(59,112)–(477,449)。
  - 右上：(74,65)–(422,449)。
  - 左下：(84,43)–(483,423)。
  - 中下：(49,40)–(483,416)。
  - 右下：(62,34)–(430,425)。
- 網頁可用 `background-size: 300% 200%`，配合 `0% 0%`、`50% 0%`、`100% 0%`、`0% 100%`、`50% 100%`、`100% 100%` 的等尺寸正方形容器。
- 已逐格檢視最終圖：六角色外型清楚不同，只有第三格為機器人，沒有文字、UI、商標或畫出的棋盤背景。

## 初始圖集提示詞

```text
Use case: identity-preserve / precise-object-edit original game character atlas.
Asset type: Six distinctly different original 3D adventure-game boss portraits, transparent sprite atlas for AI Campus Guardians.

Create a NEW VERSION of the second reference portrait atlas by replacing its six repeated robots with SIX DIFFERENT character species/designs described below. The first reference, our original title cover, supplies the premium, warm, sunny, charming rounded 3D character art direction: detailed tactile materials, expressive large brown eyes, beautifully rendered gold accents, friendly child-facing adventure-game appeal, soft directional highlights. The second reference supplies ONLY the exact 3-column by 2-row portrait-grid layout, head/upper-body crop, equal scale and transparent spacing. It must not constrain the five non-robot characters into robotic bodies.

Canvas: EXACTLY 1536×1024 px, aspect 3:2. A transparent-alpha atlas of EXACTLY six equal 512×512 square cells, 3 columns and 2 rows. Arrange six separate front-facing/slightly three-quarter head-and-shoulders/object-bust portraits, same apparent size and same crop line. Each portrait centered inside its own cell, silhouette about 70–78% cell width and 82% cell height, with transparent padding on all sides. Top-row centers (256,256), (768,256), (1280,256); bottom-row centers (256,768), (768,768), (1280,768). Keep crown, horns, ears, wings and hands fully within each cell; no overlap or cross-cell protrusion. Natural lower bust crop with clean boundaries. NO panel backgrounds, no grid lines or tile frames.

EXACT READING ORDER, top left to right then bottom left to right:

1. TOP LEFT — Collecting Magic Box: An anthropomorphic GOLDEN-BROWN treasure chest, NOT a robot. Warm brown softly grained wood with rich golden brass corner pieces and curved arched hinged lid. Two huge expressive round brown eyes on its arched lid/upper front. A charming smiling mouth integrated beside/under the golden keyhole lock on the front face; the keyhole is clearly part of a treasure chest lock. Short little rounded wooden/brass side hands. Character is entirely a cute living treasure chest, no humanoid head, no robot face-screen, no antennas, no robot torso. Dominant gold #f6a642.

2. TOP CENTER — Whispering Book Spirit: An upright thick TEAL LEATHER MAGIC BOOK with gold embossed border and softly textured teal cover. Large naturally expressive brown eyes and a friendly little smile on the cover itself. Thick cream paper pages visible along the sides; gently fanned PAPER-PAGE WINGS at its left and right. A single gold/cream ribbon bookmark hangs near the bottom. Book shape unmistakably reads as a magical leather-bound book, not a bird, not an owl, not a robot. No feathers, beak, face-screen or metallic body. Dominant teal #36b8c5.

3. TOP RIGHT — Sorting Machine Soldier: The ONE AND ONLY ROBOT in this sheet. A friendly rounded medium-BLUE metallic toy robot based on the original robot family in the references: rounded dome, warm black/navy face panel with glowing pale-yellow oval eyes and smile, single small antenna, dark navy side fittings and shoulders. Its chest has THREE distinct round sorting indicators in RED, YELLOW and GREEN. Rounded warm metal highlights and modest gold trim. Dominant soft blue #6d91e5. No other portrait may be a robot.

4. BOTTOM LEFT — Illusion Mask: A mysterious but friendly floating ghost-like magical character in a rich PURPLE fabric hood and cloak. It has a warm CREAM THEATRICAL MASK as its face, large warm glowing brown eyes in soft eye openings, a gentle theatrical smiling mouth and delicate gold trim. Hood and velvet-like cloak drape around the cream mask, with small floating cloak sleeves suggested near shoulders. No mechanical parts, no black screen, no robot head or body, no antenna. Rounded enchanting child-friendly ghost, not scary. Dominant purple #9c70d8.

5. BOTTOM CENTER — Homework Paper Dragon: A cute small FOLDED-PAPER DRAGON made from CORAL RED and CREAM WHITE paper. Clear dragon snout with a playful smiling dragon mouth, large brown eyes, two little folded-paper horns, gently creased paper-page wings, and a little upper chest with folded seams. Tangible paper fibers, layered origami folds and dimensional cream-red contrast. Dragon anatomy must be obvious, not robot or humanoid, not a metal mask. Friendly and playful, no frightening teeth, no fire. Dominant coral #e67970.

6. BOTTOM RIGHT — All-purpose Gear King: A cute REGAL LION KING with warm golden-brown soft fur, fluffy dimensional mane, rounded fur ears, big naturally expressive brown eyes, a clearly organic lion nose and smiling lion muzzle, and furry paws near the bust. It wears an INDIGO royal fabric cape with gold edging, a little royal gold chest badge, and a delicate GOLD GEAR-SHAPED CROWN above the mane. Face is a furry lion, NEVER a robot screen. All lion anatomy organic, no metal arms or antennas. Dominant indigo garment #637dda with warm natural fur.

All six look as if they belong to the same original beautifully rendered 3D school-magic game world as the first reference, with warm rim lighting, consistent eye-level studio view, clearly distinct tactile wood/leather/metal/fabric/paper/fur materials and rich detail. Child-friendly and approachable, gently mischievous challenge characters rather than threatening monsters. The first, second, fourth, fifth, sixth must have absolutely NO robot elements. Do not copy any existing franchise character.

STRICT: True transparent alpha background for the entire atlas, not a painted checkerboard and not an opaque color gradient. No text, no letters, no numbers, no writing inside books, no title, no logos, no watermark, no UI, no cards, no frames, no background scenes, no magician, no extra character, no duplicate species. Exactly six portrait cells in the specified order.
```

## 定稿修正提示詞

```text
Use case: precise-object-edit, sprite-atlas framing correction.
Edit this original six-character transparent atlas. Keep the EXACT SAME six charming character identities, species, colors, materials, faces and order: golden wooden living chest; teal leather page-winged book spirit; blue three-color-button robot; purple cream-mask cloak ghost; coral-cream origami dragon; indigo-caped furry lion king with gear crown. Do not turn non-robots into robots.

Make ONLY TWO precise corrections:
1. Reframe and slightly shrink each of the six complete portraits so its entire visible silhouette including wings, hands, cloak sleeves, horns and crown fits WITHIN its own 512×512 grid cell with at least 45px of completely transparent padding on every side. Each portrait's maximum visible width should be about 400px, maximum height about 420px, centered at (256,256), (768,256), (1280,256), (256,768), (768,768), (1280,768). The sheet must stay EXACTLY 1536×1024 (3×2 equal square cells). No silhouette crosses x=512, x=1024 or y=512. Keep consistent apparent scale. Do not stretch any face. The chest/book/dragon can be shown as compact object-busts; crop all busts naturally near the same baseline. Leave genuine alpha-transparent gaps between all six portraits, not painted lines or colored panels.
2. On the golden treasure chest ONLY, remove the extra smiling mouth located between the two eyes on its arched lid. Replace that area with plain matching golden/wood chest material. Keep its two huge brown eyes, the golden keyhole lock and ONLY ONE friendly smiling mouth beneath that lock on the front lower panel. The chest must have exactly one mouth.

Preserve the beautiful high-detail 3D render quality, warm directional light and tactile materials. Keep all other character details unchanged. True transparent-alpha background; absolutely no opaque gradient, no checkerboard, no lettering, no numbers, no title, no UI, no grid lines, no watermark, no new props or characters.
```
