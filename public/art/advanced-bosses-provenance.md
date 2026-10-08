# 進階六關原創魔王四姿勢素材

- 日期：2026-10-08（Asia/Taipei）。
- 工具與模式：Codex 內建 `image_gen.imagegen`；六個不同角色各一次獨立生成呼叫。沒有使用 CLI、OpenAI API 或額外 API key。
- 風格參考：本遊戲原創 `public/art/title-cover-v1.webp`，先以 `view_image` 檢視，作為精緻圓潤 3D 材質、表情、自然光與金屬細節的風格來源；沒有複製封面小羽或米米的角色外型。
- 六種新角色分別對應進階六關：窺密蛛后、倒時沙漏精、偏心藤怪、偽聲狐狸、捷徑墨魚、急速雲巨人。與初階寶箱、書靈、機兵、面具、紙龍及齒輪王造型不同。
- 每張都是四姿勢完整透明 atlas：左上 idle、右上 windup、左下 release、右下 hurt；角色朝左以面對玩家。受擊僅有輕微退縮與擔心，沒有受傷或暴力畫面。
- 實際工具原生尺寸全部為 **1254 × 1254 px RGBA**；提示要求 2048，但工具未採用，沒有假升頻。
- 原始 PNG 完整保留在 `test-results/advanced-boss-{1..6}-v1-original.png`；遊戲引用完整 WebP。
- 格式轉換：Pillow `format='WEBP', lossless=True, method=6, exact=True`。已讀回六张 WebP，比較全部 RGBA 像素與原始 PNG，六張均完全相等。沒有裁切、縮放、重排、補畫、抠圖、清除邊緣或修改像素。
- 這些是預先渲染的 3D 姿勢圖，供現有 3D 場景中 2.5D 角色使用；不是可自由轉身的幾何網格模型。
- 已逐張以 `view_image` 檢視：角色種類清楚、身體與四姿勢身份一致、附肢連接、每格全身、无背景／文字／水印／烘焙法術粒子。

## 定稿檔案與雜湊

| 主題 | 角色 | WebP 路徑 | bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| 1 | 窺密蛛后 | `public/art/advanced-boss-1-v1.webp` | 1061232 | `98e8e97d3713527e4500af50eca5326265f80c893dc189ab1852379302601f57` |
| 2 | 倒時沙漏精 | `public/art/advanced-boss-2-v1.webp` | 1059238 | `309ad646cb599f1e29e6f960d0fde44a92b54c05ca6c7a44047607aab5b198b9` |
| 3 | 偏心藤怪 | `public/art/advanced-boss-3-v1.webp` | 1342826 | `6b629e2a6dd90f6ebdae28d14b747e543c318bf3c096c7a2a5c6b9351f5c94bc` |
| 4 | 偽聲狐狸 | `public/art/advanced-boss-4-v1.webp` | 1149652 | `e94a4afae234d5d3398dfaa7febcdc9a70c478c8b610c17980bfd8ec9a0e58c2` |
| 5 | 捷徑墨魚 | `public/art/advanced-boss-5-v1.webp` | 1119588 | `991fe0593cc10743dc638b3223371b83b857406d802d323ab27447eba4047d93` |
| 6 | 急速雲巨人 | `public/art/advanced-boss-6-v1.webp` | 1015484 | `c442e54189eca5c9476580ab3980e4cdcb84d40048c21f378ffdcd23c742e6f6` |

## 原始 PNG 對照

| 主題 | 原始 PNG bytes | PNG SHA-256 | WebP RGBA 相等 |
| --- | ---: | --- | --- |
| 1 | 1519599 | `36db6eb85f01a38f8c45cb2893a4a9ec89b0099c0d97e75579d94296fad576e2` | 是 |
| 2 | 1544886 | `d1b1db2fc73db5866fe3e406eae84f35130bfed02b606c3d14efd762deb07ca0` | 是 |
| 3 | 1887025 | `32c897efeb287235f82e6dc3140b58cad20442739d0950a9d880be9cb128319a` | 是 |
| 4 | 1754645 | `ee68a3ba705535ec072d56c284256b44bfed30f3ab5ce83d64854af545449e7f` | 是 |
| 5 | 1597970 | `5a14c47c37595d134d12840b8950e36c8e711b3d44a55bda0dc9ba0e51baf7f0` | 是 |
| 6 | 1526866 | `2be46e20e40e58558809aab434337a6ac9e24c54ef0d5db96b244c3760a07af9` | 是 |

## 透明邊緣與實測 UV

生成器在真透明區域留下極淡的彩色／白色邊緣。遊戲材質使用 **alphaTest = 0.08**，忽略 alpha ≤ 20 的像素；沒有對原圖作像素清理。用 8-neighbor 連通組件量測 alpha > 20，雲巨人共 771,415 像素，全數屬於四個角色主體，四周白色碎點全部為 alpha ≤ 20，因此在即時角色材質內不顯示。

| 主題 | alpha > 20 全部像素 | 四主體像素總和 | 主體外孤立像素 |
| --- | ---: | ---: | ---: |
| 1 | 545553 | 545553 | 0 |
| 2 | 491869 | 491865 | 4 |
| 3 | 626119 | 626113 | 6 |
| 4 | 688231 | 688231 | 0 |
| 5 | 635858 | 635857 | 1 |
| 6 | 771415 | 771415 | 0 |

不要簡單將圖片等分成 627 × 627 四格：生成器有些姿勢跨過名義中線。使用 `src/content/advancedBossArt.ts` 的實測自訂矩形，每格都避開其他姿勢的 alpha > 20 主體。所有座標為完整 atlas 的絕對像素，左上 (0,0)，x 向右、y 向下。

- rect：UV x,y,width,height。
- foot：角色接地腳／觸足群的水平中心與 alpha > 128 最低主體行；狐狸尾巴、沙漏與雲巨人抬起的腳經視覺檢查排除，以真正接地腳掌作地面錨點。
- topY：該姿勢 alpha > 20 主體最高行。
- emitter：在指定前腿鎖飾、掌心、葉芽、狐狸前掌、羽毛尖端或雲拳上的具體像素；用於發射點，並非圖格中心。
- 四姿勢共用 idle 的 topY-to-foot pixel span 作像素／世界比例，避免切換時因 UV 框不同而放大縮小。

| 主題／姿勢 | rect x,y,w,h | foot x,y | topY | emitter x,y |
| --- | --- | --- | ---: | --- |
| 1 / idle | 48, 64, 582, 540 | 343.5, 573 | 84 | 90, 491 |
| 1 / windup | 650, 80, 584, 525 | 958, 566 | 109 | 695, 349 |
| 1 / release | 20, 650, 665, 570 | 413.5, 1166 | 693 | 76, 925 |
| 1 / hurt | 700, 650, 535, 570 | 978, 1156 | 672 | 806, 907 |
| 2 / idle | 100, 0, 535, 620 | 331, 604 | 19 | 142, 338 |
| 2 / windup | 700, 0, 540, 620 | 950.5, 603 | 20 | 758, 296 |
| 2 / release | 20, 630, 660, 604 | 396.5, 1210 | 635 | 104, 858 |
| 2 / hurt | 720, 630, 534, 604 | 951, 1212 | 649 | 811, 915 |
| 3 / idle | 48, 0, 622, 630 | 378.5, 621 | 16 | 105, 360 |
| 3 / windup | 690, 0, 535, 630 | 943.5, 618 | 18 | 1098, 382 |
| 3 / release | 0, 630, 700, 604 | 495, 1210 | 637 | 62, 866 |
| 3 / hurt | 710, 630, 544, 604 | 992, 1216 | 652 | 796, 911 |
| 4 / idle | 110, 0, 535, 620 | 287.5, 609 | 13 | 213, 453 |
| 4 / windup | 685, 0, 569, 620 | 887, 607 | 21 | 956, 305 |
| 4 / release | 60, 620, 630, 614 | 321, 1196 | 631 | 110, 899 |
| 4 / hurt | 745, 620, 509, 614 | 956.5, 1198 | 660 | 910, 944 |
| 5 / idle | 75, 10, 575, 610 | 329.5, 584 | 37 | 590, 193 |
| 5 / windup | 700, 10, 554, 610 | 947, 597 | 36 | 1180, 90 |
| 5 / release | 0, 630, 675, 604 | 425, 1200 | 658 | 35, 803 |
| 5 / hurt | 725, 630, 529, 604 | 945.5, 1200 | 682 | 1100, 830 |
| 6 / idle | 50, 0, 565, 630 | 329.5, 622 | 14 | 123, 456 |
| 6 / windup | 635, 40, 619, 590 | 961, 616 | 69 | 1090, 187 |
| 6 / release | 0, 635, 705, 619 | 437, 1212 | 656 | 107, 856 |
| 6 / hurt | 715, 630, 539, 624 | 1055.5, 1214 | 642 | 842, 903 |

完整 alpha 元資料保存在不公開的 `test-results/advanced-boss-alpha-metadata.json`，原始座標量測與人工地面錨點修訂在 `test-results/advanced-boss-calibration-measured.json` 與 `src/content/advancedBossArt.ts`。

## 六個角色的完整生成提示詞

每個呼叫都以原創封面作風格參考，`transparent_background: true`。

### 1. 窺密蛛后

```text
Use case: stylized-concept. Asset type: transparent 4-pose character atlas for a children's AI ethics battle game.
Reference image: the supplied cover is STYLE ONLY: match its premium original rounded 3D animation render, expressive but child-safe design, intricate believable materials, warm natural studio daylight, polished gold highlights and soft volume. Do not reuse its boy or robot.
Output one single square 2048x2048 transparent PNG atlas. Precisely 2 rows by 2 columns of the SAME character: top-left IDLE facing LEFT in a welcoming relaxed stance; top-right WINDUP facing LEFT preparing an ability; bottom-left RELEASE facing LEFT extending its casting limb toward the left; bottom-right HURT gently leaning back with concerned child-friendly expression. Each character remains identical, completely visible full body, same pixel scale, same foot baseline within each cell, each pose centered inside its own quadrant with 8% transparent safety gutters. All limbs and props fit inside their own quadrant. Viewpoint consistent three-quarter front with LEFT orientation. Real transparent alpha background. No typography, no grid lines, no particles, no glow, no effects, no floor, no ground shadow, no scenery, no logos, no watermark. Exactly four poses only. Do not make a robot, cyborg, chest, book spirit, mask, paper dragon, or gear king. All poses must remain one physically coherent character with clearly connected appendages.
Character 1: 窺密蛛后, an ORIGINAL privacy spider queen: rounded gentle jade green and violet pear-shaped spider body, expressive friendly little face, two amber eyes, a small gold crown, EIGHT rounded curved legs clearly attached to the same torso with only the foreground legs emphasized, subtle velvet and iridescent shell textures, tiny gold privacy lock ornaments attached with silver silk filaments. No humanoid body and no shield. Idle legs gently resting; windup front left leg curled back; release front left leg extended toward LEFT with gold lock charm at its tip; hurt front legs pulled inward and body slightly recoiling. Cute magical creature, not a scary realistic spider.
```

### 2. 倒時沙漏精

```text
Use case: stylized-concept. Asset type: transparent 4-pose character atlas for a children's AI ethics battle game.
Reference image: the supplied cover is STYLE ONLY: match its premium original rounded 3D animation render, expressive but child-safe design, intricate believable materials, warm natural studio daylight, polished gold highlights and soft volume. Do not reuse its boy or robot.
Output one single square 2048x2048 transparent PNG atlas. Precisely 2 rows by 2 columns of the SAME character: top-left IDLE facing LEFT in a welcoming relaxed stance; top-right WINDUP facing LEFT preparing an ability; bottom-left RELEASE facing LEFT extending its casting limb toward the left; bottom-right HURT gently leaning back with concerned child-friendly expression. Each character remains identical, completely visible full body, same pixel scale, same foot baseline within each cell, each pose centered inside its own quadrant with 8% transparent safety gutters. All limbs and props fit inside their own quadrant. Viewpoint consistent three-quarter front with LEFT orientation. Real transparent alpha background. No typography, no grid lines, no particles, no glow, no effects, no floor, no ground shadow, no scenery, no logos, no watermark. Exactly four poses only. Do not make a robot, cyborg, chest, book spirit, mask, paper dragon, or gear king. All poses must remain one physically coherent character with clearly connected appendages.
Character 2: 倒時沙漏精, an ORIGINAL enchanted hourglass spirit: ivory carved ornamental top and bottom gold-rimmed caps, visibly transparent glass hourglass waist with warm golden sand inside, expressive brown-eyed face in the ivory upper cap, two little glass-and-gold arms and short gold boot-like feet, teal cloth ribbons at the cap. The narrow hourglass center must be clearly seen in all poses and it must read as an hourglass, never as a robot. Idle arm relaxed; windup upper left arm drawn back; release glass/gold arm aiming LEFT with the fingertip emission point; hurt shoulders tilting and concerned expression. Premium glass refraction, small subtle engravings without letters.
```

### 3. 偏心藤怪

```text
Use case: stylized-concept. Asset type: transparent 4-pose character atlas for a children's AI ethics battle game.
Reference image: the supplied cover is STYLE ONLY: match its premium original rounded 3D animation render, expressive but child-safe design, intricate believable materials, warm natural studio daylight, polished gold highlights and soft volume. Do not reuse its boy or robot.
Output one single square 2048x2048 transparent PNG atlas. Precisely 2 rows by 2 columns of the SAME character: top-left IDLE facing LEFT in a welcoming relaxed stance; top-right WINDUP facing LEFT preparing an ability; bottom-left RELEASE facing LEFT extending its casting limb toward the left; bottom-right HURT gently leaning back with concerned child-friendly expression. Each character remains identical, completely visible full body, same pixel scale, same foot baseline within each cell, each pose centered inside its own quadrant with 8% transparent safety gutters. All limbs and props fit inside their own quadrant. Viewpoint consistent three-quarter front with LEFT orientation. Real transparent alpha background. No typography, no grid lines, no particles, no glow, no effects, no floor, no ground shadow, no scenery, no logos, no watermark. Exactly four poses only. Do not make a robot, cyborg, chest, book spirit, mask, paper dragon, or gear king. All poses must remain one physically coherent character with clearly connected appendages.
Character 3: 偏心藤怪, an ORIGINAL enchanted moss-green vine creature: warm wooden face with amber eyes, rounded vine torso, thick connected twisted vine arms and root-like feet, a branch crown with layered glossy emerald leaves, tiny parchment tags tied to branches with absolutely no writing. Not a tree trunk monster with scary teeth, not a humanoid robot. Premium wood grain, velvet moss, translucent leaf detail, golden vine curls. Idle relaxed LEFT-facing; windup left vine arm curled back; release vine arm stretched toward LEFT with leaf-bud casting tip; hurt leaves slightly drooped and worried face. Fullbody appendages compact and within own cell.
```

### 4. 偽聲狐狸

```text
Use case: stylized-concept. Asset type: transparent 4-pose character atlas for a children's AI ethics battle game.
Reference image: the supplied cover is STYLE ONLY: match its premium original rounded 3D animation render, expressive but child-safe design, intricate believable materials, warm natural studio daylight, polished gold highlights and soft volume. Do not reuse its boy or robot.
Output one single square 2048x2048 transparent PNG atlas. Precisely 2 rows by 2 columns of the SAME character: top-left IDLE facing LEFT in a welcoming relaxed stance; top-right WINDUP facing LEFT preparing an ability; bottom-left RELEASE facing LEFT extending its casting limb toward the left; bottom-right HURT gently leaning back with concerned child-friendly expression. Each character remains identical, completely visible full body, same pixel scale, same foot baseline within each cell, each pose centered inside its own quadrant with 8% transparent safety gutters. All limbs and props fit inside their own quadrant. Viewpoint consistent three-quarter front with LEFT orientation. Real transparent alpha background. No typography, no grid lines, no particles, no glow, no effects, no floor, no ground shadow, no scenery, no logos, no watermark. Exactly four poses only. Do not make a robot, cyborg, chest, book spirit, mask, paper dragon, or gear king. All poses must remain one physically coherent character with clearly connected appendages.
Character 4: 偽聲狐狸, an ORIGINAL enchanted fox: rounded lovable blue-violet fluffy body, soft silver pale muzzle and chest fur, large expressive warm amber eyes, tall silver-tipped fox ears with tiny gold sound-wave-shaped ornaments, two visibly attached bushy echo tails fanning behind it, small gold collar. Anthro standing on two hind paws with little forepaws but clearly fox anatomy; not a mask, robot, humanoid magician, or costume. Premium fine plush fur with soft clumps, graceful polished game character. Idle facing LEFT; windup left forepaw drawn back; release forepaw extended toward LEFT with fingertip emission point; hurt forepaws pulled inward with gentle worried expression.
```

### 5. 捷徑墨魚

```text
Use case: stylized-concept. Asset type: transparent 4-pose character atlas for a children's AI ethics battle game.
Reference image: the supplied cover is STYLE ONLY: match its premium original rounded 3D animation render, expressive but child-safe design, intricate believable materials, warm natural studio daylight, polished gold highlights and soft volume. Do not reuse its boy or robot.
Output one single square 2048x2048 transparent PNG atlas. Precisely 2 rows by 2 columns of the SAME character: top-left IDLE facing LEFT in a welcoming relaxed stance; top-right WINDUP facing LEFT preparing an ability; bottom-left RELEASE facing LEFT extending its casting limb toward the left; bottom-right HURT gently leaning back with concerned child-friendly expression. Each character remains identical, completely visible full body, same pixel scale, same foot baseline within each cell, each pose centered inside its own quadrant with 8% transparent safety gutters. All limbs and props fit inside their own quadrant. Viewpoint consistent three-quarter front with LEFT orientation. Real transparent alpha background. No typography, no grid lines, no particles, no glow, no effects, no floor, no ground shadow, no scenery, no logos, no watermark. Exactly four poses only. Do not make a robot, cyborg, chest, book spirit, mask, paper dragon, or gear king. All poses must remain one physically coherent character with clearly connected appendages.
Character 5: 捷徑墨魚, an ORIGINAL magical ink squid: rounded navy and plum mantle/head with friendly amber eyes and small expressive mouth, several thick soft octopus/squid tentacles clearly attached around the underside of its ONE head/body, curling root-like tentacle feet, two front tentacles holding a blank cream scroll and a gold feather quill. No frightening realistic squid, no human legs, no robot, no paper dragon, no scary ink spray. Premium satin smooth skin with subtly iridescent highlights and gold decorative cuff rings. Idle LEFT-facing; windup quill-bearing left tentacle lifted back; release quill-bearing tentacle aiming LEFT with quill nib as emission point; hurt front tentacles tucked inward with worried face. All scrolls absolutely blank.
```

### 6. 急速雲巨人

```text
Use case: stylized-concept. Asset type: transparent 4-pose character atlas for a children's AI ethics battle game.
Reference image: the supplied cover is STYLE ONLY: match its premium original rounded 3D animation render, expressive but child-safe design, intricate believable materials, warm natural studio daylight, polished gold highlights and soft volume. Do not reuse its boy or robot.
Output one single square 2048x2048 transparent PNG atlas. Precisely 2 rows by 2 columns of the SAME character: top-left IDLE facing LEFT in a welcoming relaxed stance; top-right WINDUP facing LEFT preparing an ability; bottom-left RELEASE facing LEFT extending its casting limb toward the left; bottom-right HURT gently leaning back with concerned child-friendly expression. Each character remains identical, completely visible full body, same pixel scale, same foot baseline within each cell, each pose centered inside its own quadrant with 8% transparent safety gutters. All limbs and props fit inside their own quadrant. Viewpoint consistent three-quarter front with LEFT orientation. Real transparent alpha background. No typography, no grid lines, no particles, no glow, no effects, no floor, no ground shadow, no scenery, no logos, no watermark. Exactly four poses only. Do not make a robot, cyborg, chest, book spirit, mask, paper dragon, or gear king. All poses must remain one physically coherent character with clearly connected appendages.
Character 6: 急速雲巨人, an ORIGINAL fluffy cloud giant: very rounded ivory and sky-blue cloud body, layered pillowy cloud volume, friendly amber eyes and an expressive slightly impatient brow, two massive cloud fists clearly connected to shoulders, thick cloud legs and soft cloud feet, a single small golden clock clasp on its chest with simple clock hands but NO numbers/text. Original cloudy elemental creature, no gears, no armor, no robot, no mech, no human magician. Premium fluffy soft cloud material with subtle daylight blue shadows and rounded game sculpture form. Idle LEFT-facing relaxed fists; windup large left fist pulled back; release large left fist extended toward LEFT as emission point; hurt recoiling with one fist protecting chest and gentle worried expression. No vapor trails, glow or particles.
```
