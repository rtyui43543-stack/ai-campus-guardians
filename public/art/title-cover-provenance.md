# 原創遊戲首頁封面製作紀錄

- 製作日期：2026-10-07。
- 產出工具：Codex 內建 `image_gen.imagegen`，使用新圖生成模式；未使用 CLI、外部圖片 API 或對既有圖片進行拼貼。
- Web 資產：`public/art/title-cover-v1.webp`，1672 × 941 px，233,678 bytes（約 228 KiB）。
- 完整生成源檔：`test-results/title-cover-v1-original.png`，1672 × 941 px，2,303,147 bytes；此資料夾依專案設定不納入公開部署。
- 格式處理：使用隨 Codex 工作區提供的 Pillow，WebP quality 88、method 6；原圖未縮放，未改繪、移除或補上任何內容。
- 畫面內容：青綠金邊魔法師小羽與金黃機器人米米，站在奶油色校舍前；右側主角、左側自然散景供網站標題與控制項排版。圖片本身沒有文字、按鈕、標題或商標。

## 看過的視覺參考與使用範圍

1. `test-results/arms-public-story.png`：沿用本遊戲原創角色身份與青綠魔法師、金環寶石魔杖、無盾牌的定位。
2. `public/art/campus.png`：延續本遊戲原創奶油色校舍、青綠窗框與校園步道。
3. 使用者提供的 `821404958_1579745303894849_7855886103208619862_n.jpg`：只參考明亮、吸睛、立體的兒童遊戲海報氛圍。沒有複製其人物、機器人造型、低多邊形風格、字體、版面、水管、澆水或花園任務內容，也沒有把該附件放入網站資產。

上述參考先以 `view_image` 檢視，再把本遊戲角色與場景需求寫成原創新圖提示。生成呼叫未傳入參考圖片檔案或近期圖片編輯參數。

## 最終生成提示詞

```text
Use case: stylized-concept.
Asset type: Original 3D game landing-cover illustration for a Taiwanese elementary-school AI ethics adventure game, wide landscape around 16:9.

Create a polished, highly appealing, sunlit, rounded 3D game cover with strong teal, bright leafy green, cream, and warm gold. The environment is an original Taiwanese school courtyard: a welcoming cream-colored schoolhouse with arched entrance and teal window frames, a warm stone campus path, rounded trees, cheerful plants, blue sky, a few soft clouds, gently framing leaves at the top corners, and small foreground grass and leaves. Soft cinematic depth of field and beautiful natural sunlight, dimensional toy-like materials with smooth surfaces and subtle fabric detail. Saturated and lively yet warm, friendly, and readable.

Keep the right approximately 55% of the image occupied by two large original friendly characters, shown fully enough to see hats, faces, costume and feet, with lively welcoming poses:
1. Xiao-Yu, a child magician with dark-brown hair, round expressive dark eyes, a soft smiling face, a large tall teal pointed wizard hat with a warm-gold band and a small white star on the front. He wears a teal robe with gold edging, a teal cape, a gold belt clasp, and golden boots. His chest has a small white star. In one hand he holds ONLY a slender dark-teal magic staff, gold fittings, topped by a thin gold ring surrounding a pale-teal faceted gem. He has no shield, no sword, no armour. His free hand reaches forward in a friendly invitation. The staff radiates a beautiful soft teal-gold magical glow with a small curving trail and clear sparkling particles.
2. Mi-Mi, the original friendly small rounded gold-yellow robot companion, about two-thirds the magician's height. A rounded yellow head with a small short antenna and golden ball, a dark navy-black rounded face panel, two warm-yellow oval eyes and a simple smiling mouth; little dark navy side ears, rounded golden body with a magnifying-glass emblem on its chest, dark navy flexible arms and legs and yellow gloves/boots. It is a cheerful campus service companion, never aggressive or evil. Give it a friendly raised hand.

Only a few small floating blank book/page shapes and abstract magnifying-glass or checkmark-like magic motifs near the staff/characters convey curiosity and checking information. No readable writing on these objects. Do not crowd the composition.

Reserve the left 40–45% as a calm, naturally rendered area for HTML title and buttons to be added later. This region must still contain subtle sunlit sky and softly blurred school/foliage, not an empty blank panel. No characters, staff trails, or major contrasty objects crossing the left title area; no bright central flare there. Place the boy around x=65% and the robot around x=84%. Leave generous breathing room near the top and left. Right characters are strongly readable and large, with premium 3D children's adventure-game charm rather than low-poly geometric people.

This is an entirely original scene and original character design. The inspected poster reference informs ONLY brightness, appeal, dimensionality, and green-gold energy. Do not copy its robot, low-poly brown-haired man, garden plumbing, pipes, water jets, flower plot, typography, composition or branding. Keep this game's magician and school identities described above. Do not add any teacher, additional human, crowds, pets, dragons, or enemies.
No text whatsoever, no titles, no Chinese characters, no numbers, no logos, no word marks, no buttons, no UI, no watermarks, no border. Opaque complete background.
```

## 檢視確認

- 已檢視生成原圖與最終 WebP，兩者構圖一致且 WebP 沒有明顯壓縮破壞。
- 小羽持單支魔杖、沒有盾牌，米米保留圓潤金黃機器人與放大鏡胸章。
- 角色位於畫面右側，左側保留學校與植物散景；未加入老師或其他新角色。
- 後續由網站 HTML/CSS 疊加文字與可操作按鈕，圖片不替代互動介面。
