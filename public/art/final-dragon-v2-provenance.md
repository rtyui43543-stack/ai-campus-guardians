# 幻象九頭龍：九個可見龍頭修正

- 日期：2026-10-09（Asia/Taipei）。
- 工具：Codex 內建 `image_gen.imagegen`，一次角色編輯呼叫，`transparent_background: true`；沒有 CLI、API key、手工補畫或背景移除。
- 編輯參考：先以 `view_image` 檢視 `public/art/final-bosses-v1.webp`（舊紫金龍角色及材質）與 `public/art/title-cover-v1.webp`（原創封面 3D 品質）。保留原紫色鱗片、金角、琥珀眼、紫晶金邊盔甲、四肢、小翅膀與尾巴，修正為九個完整可見的頭。
- 定稿：`public/art/final-dragon-v2.webp`，**1254 × 1254 px RGBA**，1565372 bytes，SHA-256 `1871a155852df7de51a5c03de4427e9e4e326da393da21166e8994be26c569ce`。
- 工具原始 PNG：`C:/Users/rtyui/.codex/generated_images/01a11ecb-2b74-7262-a369-5f6fff4d2ced/exec-6875c4e1-8cda-4c5b-b8bc-edbb892b881d.png`，2144736 bytes，SHA-256 `6379195f73f2ca86e83c0ff2e8855473244ff47386f0966c7ab020c8f4a33e6f`。
- 格式轉換僅以 Pillow `WEBP, lossless=True, method=6, exact=True` 壓縮，讀回與 PNG 全部 RGBA 位元組相等；沒有裁切、縮放、拼接、去背、調色或其他像素編輯。保留工具生成的原始 alpha。
- alpha > 20 可见範圍為 `[38, 19, 1209, 1209)`；四角 alpha 為 0、0、1、0，低 alpha 抗鋸齒及極薄雜點由現有渲染 `alphaTest=0.08` 隱去。完整圖框 `[0, 0, 1254, 1254]` 保留所有頭、角、翅膀、腳與尾巴。
- 地圖縮圖、故事及戰鬥全採同一張九頭圖。idle/windup/release/hurt 皆用完整圖框，蓄勢、攻擊及受擊的動作採原有即時位移、縮放及粒子，避免換姿勢時再次少頭。這是可動畫化的預製 3D 角色圖，並非自由旋轉的 3D 網格。
- 初階 `final-bosses-v1.webp` 原圖及三姿勢完全保留；只改進階素材路徑。`build-offline.mjs` 會自動將 `public/art` 的新 WebP 打入離線包。

## 人工逐頭驗證與渲染錨點

已用 `view_image` 檢視生成 PNG 及落地 WebP，兩者均可逐頭數出 **中心 1 + 左側 4 + 右側 4 = 9**，每個頭的面部與脖子均分開可見。以下座標是各面部的人工檢視中心，用於避免 UI 取圖框裁掉任何頭，並非機器辨識頭數的證明。

| 頭部位置 | 面部中心 x,y |
| --- | --- |
| 中心主頭 | 554, 232 |
| 左上 | 352, 217 |
| 左中外 | 192, 351 |
| 左中內 | 370, 421 |
| 左下 | 130, 532 |
| 右上 | 837, 227 |
| 右中外 | 1017, 351 |
| 右中內 | 836, 431 |
| 右下 | 1121, 514 |

`src/content/finalBossArt.ts`：全姿勢 `rect=[0,0,1254,1254]`、`foot=[625,1209]`、`topY=19`、主頭嘴部 `emitter=[535,310]`。透明邊界、臉部與角均保留。進階角色顯示高度仍為 3.7 世界單位；新寬高比可直接套入原地圖 SVG 及戰鬥精靈渲染，不須放大卡片或裁頭。

故事的主角特寫原先直接朝左平移並放大 1.6 倍，會把右側九頭龍切出畫面。`finalBossFraming.ts` 現在僅對進階最終關限制電影鏡頭放大與水平偏移；角色原位置與尺度保持不變，wide、enemy、hero、resolve 及轉場都保留兩個完整角色。投影測試涵蓋 3:1、16:9、1.5:1 與 0.65:1 四種比例，檢查九個臉部中心與兩個完整圖片平面的四角皆在視窗內。一般關卡、初階魔王及實際對戰的鏡頭保持原規則。

## 完整生成提示詞

```text
Use case: precise-object-edit / stylized-concept. Asset type: one full-body transparent final-boss game sprite. Reference 1 is the existing boss atlas: EDIT ONLY the purple-and-gold dragon in its bottom-left pose, preserving its friendly expressive identity, round face, violet scale texture, gold horns, amber eyes, amethyst-and-gold chest armor, sturdy body, four legs, clawed feet, two purple wings and curled tail. Reference 2 is the game cover, only for premium rounded 3D animated film material detail and warm light. Return ONLY ONE complete purple dragon, not a sheet and not the green book king.
Required correction: this character is named the NINE-HEADED DRAGON, but the reference has only seven heads. It must have EXACTLY NINE individually visible complete dragon heads. ONE taller large main head in the center, FOUR clearly separate heads to its left and FOUR clearly separate heads to its right. Arrange each side's four heads at staggered heights and lateral positions as a fan so every head has a completely visible face, eyes, snout and horns, all nine necks visibly attached to one torso. Keep empty space around each face: no heads hidden behind another head, no half-heads, no extra eyes on a single head, no detached heads, no tenth head. Nine means 1 center + 4 left + 4 right, easily countable even at a small game portrait. All the necks are natural elongated dragon necks, avoid a bouquet of tiny heads or heads grown on wings. Three-quarter view with main head facing slightly LEFT, toward the player's character. Four legs, feet, tail, wings and all nine heads entirely visible.
Composition: single complete character centered on a square canvas, generously padded 8% transparent space around every outer head horn, wing, tail and foot. Beautiful polished 3D volume, crisp violet scales and faceted purple crystal armor with metallic gold edging, consistent with original. Child-safe mild determined friendly expressions, no frightening teeth, no gore. Keep silhouette clean, do not add fire or floating particles. Real transparent alpha backdrop, including gaps between necks and wings. No background, floor, shadows outside silhouette, text, numbers, labels, border, grid, watermark or other creatures. Exact nine clear heads is the highest-priority requirement.
```
