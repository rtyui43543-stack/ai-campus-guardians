# Card-derived advanced summon presentation — 2.21.0

## Delivered changes

- Student difficulty selectors show only 初階 / 進階; settings use the same labels. Desktop controls use 26px text and at least 92 × 52px targets; narrow layouts use 22px and at least 76 × 48px targets.
- 智慧烈焰鳳 and 極寒冰龍 use independent transparent 1536 × 1024 illustrations referenced from their collection cards. Phoenix feather layers/chest star and dragon crystal scales/horns/wings replace the former simplified SVG and Three.js creature silhouettes.
- The summons grow, fly from the hero toward the enemy, contact at 900ms, then trigger the existing field-wide fire or frost. The presentation still ends at 3 seconds. HP and Home stay above the summon; the locked question and answer controls temporarily fade out so the creature remains visible.
- Battle/story entry preloads and decodes the corresponding illustration; the advanced final battle preloads both selectable summons. Failed preload requests may retry on the next entry.
- Damage, energy, timing, collection cards, starter effects, questions, and scoring are unchanged.

## Evidence

- 435 Vitest tests and 2 Pages preview server tests passed.
- `npm run content:check` passed: 90 unique current questions, 14 levels, no errors.
- `npm run build` passed TypeScript, teacher exports, Pages asset validation and offline-pack validation (860 files, 104.2 MiB reported by the build). Both transparent PNGs are included in offline content.
- Browser checks at desktop and 390px / 320px confirmed only the two difficulty names, expected computed font sizes, and no horizontal overflow.
- Actual local game imports prepared advanced chapters 5 and 6 at energy 3/3. Correct fourth answers triggered the corresponding illustration, energy 0/3, score 80 + bonus 10, and enemy HP 40 → 5. Burning and next-attack frost reduction indicators remained present.
- The actual Arena and UltimateCinematic components were additionally inspected with development-only phase controls at summon, spread-wing, impact and field-burst phases. Desktop, 390px and reduced-motion rendering were checked. These authoring controls and test fixtures remain ignored in `test-results/` and are not shipped.
- Asset inspection confirmed full silhouettes, matching detailed card rendering and transparent corners, with no opaque rectangular background. Exact prompts and alpha measurements: `public/art/summon-creatures-provenance.md`.

Proof captures (local, ignored): `test-results/221-phoenix-display.png`, `test-results/221-ice-dragon-display.png`.
