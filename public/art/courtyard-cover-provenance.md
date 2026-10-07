# 原創無人物校園背景製作紀錄

- 日期：2026-10-07。
- 工具：Codex 內建 `image_gen.imagegen`，以既有原創封面作風格來源、原校園圖作正面開闊構圖來源，另存新背景變體；未覆寫參考圖片。
- 參考：`public/art/title-cover-v1.webp`、`public/art/campus.png`，先用 `view_image` 檢視，再以 `referenced_image_paths` 傳入內建工具。
- 產出：`public/art/courtyard-cover-v2.webp`。
- 完整源檔：`test-results/courtyard-cover-v2-original.png`（依專案設定不公開）。
- 格式轉換：Pillow WebP quality 88、method 6，保留原始尺寸，未用程式重繪或修改內容。
- 內容：對稱正面奶油色校舍、青綠窗框與拱門、晴朗天空、陽光、綠樹花草、空曠石步道。没有人物、機器人、遊戲文字或 UI。
- 定稿修正：內建工具將屋頂的星形裝飾替換為普通圓窗，避免不必要的符號；其餘構圖、光影與景物保持。
- 已檢視內建生成結果；後續站立角色與所有互動 UI 由網站另行呈現。

## 初始衍生背景提示詞

```text
Use case: stylized-concept / identity-preserve environment variant.
Asset type: background-only 3D game battle arena, landscape 16:9.

Edit the first provided reference, the original AI campus game title-cover illustration, into a NEW background-only scene variant. Keep its exact premium rounded 3D art direction, cream school architecture, teal window frames, soft realistic toy-like material detail, warm sunlight, bright lush green planting, sunlit blue sky and cheerful welcoming school mood. Preserve the original file; produce a new derivative background asset.

Remove all people, the magician, the robot, the staff, floating books, checkmark, magical sparkles, and any character-related objects completely. Reframe the environment as a symmetrical, straight-ahead, eye-level view facing the central cream-colored school building and its arched teal entrance. The second reference provides only the open-courtyard, centered camera and generous foreground layout; use the much richer high-detail light and materials of the first reference as the primary style.

Composition: The school building occupies the upper half with a central clear arched doorway, big teal-framed windows, soft warm cream walls and subtle terracotta roof accents. Rounded lush green trees and flower gardens frame the sides with small white and warm-yellow flowers, planting beds and gently textured stone edging. A few softly framed green leaves can appear near the top edges without blocking the school. The bottom 45–50% must be a broad, clear, empty school courtyard of warm beige stone tiles, with gentle perspective lines and softly dappled sunlight. Leave especially empty clear floor patches on the lower-left and lower-right for real-time 3D characters to stand later. No obstructing foreground plants across these patches. The path should have enough detail to feel like a dimensional welcoming school environment, with well-defined soft shadows, and no harsh high-contrast bands.

Scene clarity: central architecture and side greenery are richly detailed but gently softer than the empty foreground, with mild depth of field, not heavy blur. Match the first reference's polished cinematic children's 3D adventure-game style, smooth rounded forms, beautiful leaf textures and sunlight. Bright saturated greens, teal architectural accents, warm gold/cream sunlight. Symmetrical wide camera, grounded space and clear playable foreground; no dramatic tilted camera or close-up.

Strict constraints: Absolutely no people, children, teachers, magician, robots, animals, enemies, tools, staffs, shields, pipes, water jets, floating books, magic effects, signs, text, letters, numbers, symbols, icons, UI, buttons, logos, watermarks, or frames. Do not add any characters as statues or painted decorations. This is only the original school's clear, sunlit outdoor background, opaque and complete.
```

## 局部修正提示詞

```text
Use case: precise-object-edit.
Edit this original, character-free 3D school courtyard background. Change ONLY the circular medallion near the top-center school pediment: remove the star-shaped gold emblem entirely and replace it with a simple round cream-framed window with ordinary plain teal crossbars, matching the other school windows. No symbol, logo, icon, lettering or insignia there.
Preserve everything else exactly: the camera, wide 16:9 landscape, school shape, cream walls, teal windows, sunlight, blue sky, trees, flowers, steps and generous empty stone courtyard. Keep the original highly detailed rounded 3D game materials and lighting. No people, robots, text, UI, magic, signs or new props. Opaque background.
```
