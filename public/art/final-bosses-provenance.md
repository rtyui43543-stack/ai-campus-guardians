# 最終雙魔王原創透明姿勢圖集

- 日期：2026-10-08（Asia/Taipei）。
- 工具：Codex 內建 `image_gen.imagegen`；一次原創角色生成與一次保持原角色的透明背景修正呼叫，`transparent_background: true`。沒有 CLI、OpenAI API key 或手工像素修圖。
- 風格參考：原創封面 `public/art/title-cover-v1.webp` 與原創進階雲巨人 `public/art/advanced-boss-6-v1.webp`；兩者先以 `view_image` 檢視，僅用其高品質圓潤 3D 材質、表情、金屬與自然光風格。
- 上排：初階最終魔王「混沌魔典王」，翡翠硬皮魔法書、立體金邊、書頁翅膀、晶石皇冠。
- 下排：進階最終魔王「幻象九頭龍」，同一龍身連接多個脖頸、至少三個明顯主頭與多個後排頭部，紫色鱗片、金邊紫晶甲、小翅膀與尾巴；親切 Q 版，沒有恐怖畫面。
- 每排三姿勢按 idle、cast、hit 排列；材質、身形、面孔、晶石、翅膀與多頭身份保持一致。所有角色朝左以面對玩家。
- 定稿 `public/art/final-bosses-v1.webp`，工具原生 **1536 × 1024 px RGBA**，沒有升頻、裁切或重排。
- WebP 大小 1930930 bytes；SHA-256 `0aa4b573d6bda112ba106de1fffcc24e371a7210960e239643ab8693cd73307b`。
- 定稿原始 PNG 保留 `test-results/final-bosses-v1-source-2.png`，2675203 bytes；SHA-256 `f5e1ab6926e2e538bfa60c0fc7aaae0b01db1a484d4053e015e6041e55b424c0`。首版在 `test-results/final-bosses-v1-source-1.png`。
- 轉檔方式：Pillow `format='WEBP', lossless=True, method=6, exact=True`；讀回比較全部 RGBA 像素，與定稿來源完全相等。沒有刪背景、去噪、補畫、縮放、移動、裁剪、重新排版或其他像素編輯。
- 圖片預覽可能顯示透明像素中保留的 RGB 漸層；RGBA 檢查空白角落及圖格間背景 alpha=0，實際按 alpha 渲染是透明。四周細薄抗鋸齒邊緣由材質 `alphaTest=0.08` 處理（忽略 alpha≤20），不修改圖片。
- alpha > 20 全圖 812520 pixels；六個完整角色主體連通組件共 812517 pixels，主體外只有 3 個孤立像素。
- 這是預製 3D 姿勢圖供 2.5D 精靈使用，不是可自由旋轉的即時幾何網格。

## 實測圖格及發射錨點

生成器不完全遵守等分 512 × 512 圖格，請使用 `src/content/finalBossArt.ts` 的矩形。每個框都完整包含該姿勢且避開其他主體；地面足錨以真正接地腳／書頁腳的低端量測。初階發射點在翡翠晶冠，進階在主龍頭嘴部。windup 与 release 共用 cast 姿勢，蓄勢/發射的移動與粒子由即時場景加入。

全部座標為完整圖集的絕對像素，左上 (0,0)，x 向右、y 向下。topY 是 alpha > 20 主體最高行，foot 是 alpha > 128 可見腳底群中心及最低行，emitter 是可見實體內的發射錨點。

| 模式／姿勢 | UV rect x,y,w,h | foot x,y | topY | emitter x,y |
| --- | --- | --- | ---: | --- |
| starter / idle | 0, 0, 510, 480 | 313, 465 | 31 | 274, 78 |
| starter / release | 510, 0, 560, 480 | 865.5, 469 | 33 | 794, 82 |
| starter / hurt | 1075, 0, 461, 480 | 1343, 473 | 28 | 1347, 76 |
| starter / windup | 510, 0, 560, 480 | 865.5, 469 | 33 | 794, 82 |
| advanced / idle | 0, 480, 530, 544 | 241.5, 973 | 489 | 219, 588 |
| advanced / release | 530, 480, 543, 544 | 748.5, 976 | 487 | 573, 654 |
| advanced / hurt | 1073, 480, 463, 544 | 1273, 968 | 492 | 1218, 597 |
| advanced / windup | 530, 480, 543, 544 | 748.5, 976 | 487 | 573, 654 |

## 首次生成完整提示詞

```text
Use case: stylized-concept.
Asset type: FINAL BOSS sprite atlas for an original children's AI-ethics school adventure game.
Reference images: first is the original game cover, second is an existing advanced boss atlas; use them ONLY as quality/material/lighting/style references. Match their premium detailed rounded 3D animation-film game render, warm natural daylight, expressive friendly faces, highly polished golden metal, dimensional cloth/paper/crystal materials. Original boss designs, never robots or copies of the reference characters.

Make ONE transparent high-resolution atlas at native 1536x1024 if possible: EXACT TWO ROWS and THREE COLUMNS. Top row is ONE BOOK KING in three poses. Bottom row is ONE MULTI-HEADED DRAGON in three poses. Within each row the same exact creature identity, colors, appendages, proportions and material details are preserved. All SIX images are full body, camera facing slightly toward LEFT (where the hero stands). Each creature fully contained inside its own quadrant-like rectangular cell, ample transparent margins around ALL wings, crown, tails and feet; no overlap across row or column lines. Equal body pixel scale and stable lowest-body/foot baseline within each row. No grid lines or labels.

TOP ROW CHARACTER: 混沌魔典王, an immense original flying magical book king. An ornate thick jade-green and emerald hardcover grimoire with detailed gold corner trim, expressive amber eyes and friendly determined mouth on its front cover, a small glowing-looking BUT NOT EMITTING faceted emerald crystal crown in a golden crown setting at the top; broad white/cream layered PAPER-PAGE WINGS visibly attached to its book spine/sides, tiny gold-rimmed cream book-bottom feet/tassels. The wings read as fanned book pages, not feathers. Body remains clearly a giant book, no human body, no robot, no generic box. Small gold geometric embossed decoration but NO letters, no written text.
TOP LEFT idle: wings slightly open, confident face, crystal crown centered.
TOP MIDDLE cast: leans slightly toward LEFT, its left page-wing/fan points actively to LEFT and the crown aims with body; concentrated friendly expression. No projectile, energy or particle effects.
TOP RIGHT hit: slight backward recoil, wings drawn inward, surprised/worried eyebrows, never injury. SAME face, book body and crown.

BOTTOM ROW CHARACTER: 幻象九頭龍, an original rounded child-safe purple-and-gold crystal-armored many-headed fantasy dragon. ONE shared sturdy dragon torso with thick rounded hind legs and clawed feet, curving tail, small broad purple wings, beautifully detailed smooth violet scales and gold-edged amethyst crystal plates on its chest/back. Multiple elongated necks visibly JOIN THE SAME TORSO; at least THREE clearly visible expressive dragon heads, additional four to six smaller attached neck/head silhouettes behind the main three to communicate nine heads without clutter. All heads have consistent rounded snouts, warm amber eyes, tiny gold horns, closed friendly mouths or mild determined faces. No scary teeth, no gore, no realistic violence, no multiple detached creatures. Count and anatomy must remain the same between the three poses. Premium 3D volume and luminous-looking crystal refraction but no emitted glow.
BOTTOM LEFT idle: relaxed three-quarter LEFT stance, heads curious and confident, all feet and tails fully visible.
BOTTOM MIDDLE cast: principal front head stretches forward toward LEFT with an open rounded mouth, another head raises, wings brace; tail and feet grounded at same baseline, no beam or fire.
BOTTOM RIGHT hit: gently leans back, main heads recoil with mildly surprised expressions, wings tuck, same connected neck structure and visible body.

STRICT transparent alpha background outside the six complete characters. Clean natural antialiasing. No color/fringe/white-noise haze outside silhouettes. No background, floor, ground contact shadow, page floating objects outside attached wings, magical particles, beam, flame, HUD, text, numbers, logo, watermark. Only the SIX posed creature figures in exactly a 2x3 atlas. All wings, tails, crowns, heads, necks and feet must remain fully inside their own cell; use compact wings/tail framing if necessary.
```

## 保持角色的透明修正完整提示詞

```text
Use case: background-extraction, preserving all original characters and six poses.
Edit the supplied final-boss atlas. Its SIX complete figures are finished original character assets. Preserve EVERY figure's identity, exact pose, face, expression, proportions, appendages, page-wing shapes, crown/crystals, many-headed dragon anatomy, scales, gold material detail, colors, camera and relative placement. Preserve the 2 rows × 3 columns composition and native 1536×1024 canvas. DO NOT redesign, redraw as another character, add or remove a head, change the creature anatomy, move or resize cells, or change any pose.
Change ONLY the backdrop: completely REMOVE all gold/green/purple studio background, floor and grounding shadow outside the six figures. Produce true transparent RGBA alpha with clean antialiased silhouettes around every wing tip, foot, tail, horn, neck and crystal crown. No checkerboard painted in, no white/colored haze, no loose pixel artifacts, no particles, no glow and no dropped shadows. Preserve background holes between necks/wings/page layers as transparent. The final file must contain the SAME SIX original figures only, on actual transparent alpha. Ensure figures remain fully inside their separate cells with no overlap.
```

