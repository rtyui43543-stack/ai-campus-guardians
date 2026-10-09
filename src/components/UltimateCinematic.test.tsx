import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { UltimateCinematic } from './UltimateCinematic';
import { getUltimateSpell } from '../content/ultimateSpells';
import { ULTIMATE_SUMMON_ART, ULTIMATE_SUMMON_TIMING } from './ultimateSummons';

vi.mock('../platform/urls', () => ({ appAssetUrl: (path: string) => `/ai-campus-guardians${path}` }));

describe('upgraded ultimate battlefield presentation', () => {
  it('keeps ordinary counterattack cues out of these ultimate cinematics', () => {
    for (const cue of ['', 'success-1-20', 'retry-2-12', 'blocked-3-0']) {
      for (const mode of ['starter', 'advanced'] as const) {
        for (let chapter = 1; chapter <= 6; chapter++) {
          expect(renderToStaticMarkup(<UltimateCinematic chapter={chapter} mode={mode} cue={cue} reducedMotion={false} />)).toBe('');
        }
      }
    }
  });

  it.each([
    { chapter: 1, object: 'ultimate-castle-crest', phases: ['castle-shield-charge', 'castle-crest-flight', 'castle-seal-impact'], fragments: 'ultimate-castle-brick-burst' },
    { chapter: 2, object: 'ultimate-thunder-book', phases: ['great-book-charge', 'thunder-book-flight', 'branching-lightning-impact'], fragments: 'ultimate-index-hit-pages' },
    { chapter: 4, object: 'ultimate-colossal-mirror-blade', phases: ['mirror-array-charge', 'gemmed-mirror-flight', 'false-mask-shatter'], fragments: 'ultimate-mirror-hit-fragments' },
    { chapter: 5, object: 'ultimate-summon-phoenix', phases: ['fire-feather-array', 'summon-grow-flight', 'enemy-impact', 'fire-feather-burst'], fragments: 'ultimate-starter-fire-fragments' },
  ])('gives starter chapter $chapter a summon, concrete flying object and themed impact without duplicating the skill banner', ({ chapter, object, phases, fragments }) => {
    const markup = renderToStaticMarkup(<UltimateCinematic chapter={chapter} mode="starter" cue="ultimate-4-30" reducedMotion={false} />);
    expect(markup).toContain('data-ultimate-tier="starter"');
    expect(markup).toContain(`初階必殺技：${getUltimateSpell(chapter, 'starter')!.name}`);
    expect(markup).toContain(object);
    expect(markup).toContain(fragments);
    const positions = phases.map(phase => markup.indexOf(`data-phase="${phase}"`));
    expect(positions.every(position => position > -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(markup).not.toContain('ultimate-tier-banner');
    expect(markup).not.toContain('<button');
  });

  it('preserves the approved advanced phoenix and ice dragon markup in both motion settings', () => {
    // Fingerprints were captured before the collection-matching changes. Keep
    // the two explicitly excluded creatures, sequencing and layer markup intact.
    const protectedForms = [
      'fd2afa118aba86f747c54a5f5185523cc428666b626a2ff5e0ea23d52fc2a5c6',
      'b68249c199f7c642453510df4fe0e056c1c94208c6b2e7f5557c43396e84d8d4',
      'bb47e9d3d8b502873ca104cdd6a70aa5b62c861e5c9685edc3b4cd1d2f2d913a',
      'b8f907f85c5344a51749ebb5da25c9422640bdc043e827c32fbf177e79e2f765',
    ];
    const current = [5, 6].flatMap(chapter => [false, true].map(reducedMotion => {
      const markup = renderToStaticMarkup(<UltimateCinematic chapter={chapter} mode="advanced" cue="ultimate-1-30" reducedMotion={reducedMotion} />).replaceAll('/ai-campus-guardians', '');
      return createHash('sha256').update(markup).digest('hex');
    }));
    expect(current).toEqual(protectedForms);
  });

  it('matches every revised cast to concrete collection motifs in normal and reduced motion', () => {
    const starter = [['card-crystal-castle', 'card-keyhole-shield'], ['card-navy-index-book', 'ultimate-index-orbit-pages'], ['card-leaf-puzzle-heart', 'card-botanical-puzzle'], ['card-gemmed-oval-mirror', 'card-mirror-false-mask'], ['ultimate-summon-phoenix', 'fire-feather-burst'], ['card-snowflake-lance', 'card-snowflake']];
    const advanced = [['card-sky-castle', 'card-floating-foundation'], ['card-navy-index-book', 'ultimate-flying-pages'], ['card-botanical-puzzle', 'card-botanical-branches'], ['card-gemmed-oval-mirror', 'card-false-mirror-fragments']];
    for (const mode of ['starter', 'advanced'] as const) for (const reducedMotion of [false,true]) {
      (mode === 'starter' ? starter : advanced).forEach((motifs,i) => {
        const markup = renderToStaticMarkup(<UltimateCinematic chapter={i+1} mode={mode} cue="ultimate-4-30" reducedMotion={reducedMotion} />);
        for (const motif of motifs) expect(markup).toContain(motif);
        const ids=[...markup.matchAll(/ id="([^"]+)"/g)].map(match=>match[1]);
        expect(new Set(ids).size).toBe(ids.length);
        for (const match of markup.matchAll(/url\(#([^)]*)\)/g)) expect(ids).toContain(match[1]);
      });
    }
    const ice=renderToStaticMarkup(<UltimateCinematic chapter={6} mode="starter" cue="ultimate-4-30" reducedMotion={false} />);
    expect(ice.match(/class="card-snowflake-lance"/g)).toHaveLength(4);
  });

  it('keeps starter phoenix fire around the enemy while preserving the advanced full-field burn', () => {
    const starter = renderToStaticMarkup(<UltimateCinematic chapter={5} mode="starter" cue="ultimate-4-30" reducedMotion={false} />);
    const advanced = renderToStaticMarkup(<UltimateCinematic chapter={5} mode="advanced" cue="ultimate-4-30" reducedMotion={false} />);
    expect(starter).toContain('data-phase="fire-feather-burst"');
    expect(starter).not.toContain('data-phase="full-battlefield-burn"');
    expect(starter).not.toContain('ultimate-phoenix-fire-front');
    expect(advanced).toContain('data-phase="full-battlefield-burn"');
    expect(advanced).toContain('ultimate-phoenix-fire-front');
    expect(advanced).not.toContain('ultimate-starter-fire-array');
  });

  it('upgrades castle protection before launching an enlarged castle seal at the opponent, retaining its advanced banner', () => {
    const markup = renderToStaticMarkup(<UltimateCinematic chapter={1} mode="advanced" cue="ultimate-4-30" reducedMotion={false} />);
    expect(markup).toContain('card-matched-castle is-upgraded');
    expect(markup).toContain('card-sky-dome');
    expect(markup).toContain('card-lock');
    const positions = ['castle-shield-charge', 'castle-crest-flight', 'castle-seal-impact'].map(phase => markup.indexOf(`data-phase="${phase}"`));
    expect(positions.every(position => position > -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(markup).toContain('data-scope="half"');
    expect(markup).toContain('ultimate-tier-banner');
    expect(markup).toContain('城堡徽印飛向對手');
    expect(markup).not.toContain('<button');
  });

  it('preserves all four distinct starter projectile forms when reduced motion is enabled', () => {
    for (const [chapter, form] of [[1, 'ultimate-castle-crest'], [2, 'ultimate-thunder-book'], [4, 'ultimate-colossal-mirror-blade'], [5, 'ultimate-summon-phoenix']] as const) {
      const markup = renderToStaticMarkup(<UltimateCinematic chapter={chapter} mode="starter" cue="ultimate-4-30" reducedMotion />);
      expect(markup).toContain('is-reduced');
      expect(markup).toContain(form);
      expect(markup).toContain(getUltimateSpell(chapter, 'starter')!.name);
      expect(markup).not.toContain('ultimate-tier-banner');
    }
  });

  it('offers six recognizable upgraded forms and labels the half/full battlefield presentation', () => {
    const forms = ['ultimate-castle', 'ultimate-book-storm', 'ultimate-sorting-forest', 'ultimate-mirror-hall', 'ultimate-phoenix', 'ultimate-ice-dragon'];
    for (let chapter = 1; chapter <= 6; chapter++) {
      const markup = renderToStaticMarkup(<UltimateCinematic chapter={chapter} mode="advanced" cue="ultimate-1-30" reducedMotion={false} />);
      expect(markup).toContain(`data-scope="${chapter === 1 ? 'half' : 'full'}"`);
      expect(markup).toContain(forms[chapter - 1]);
      expect(markup).toContain(`進階升級必殺技：${getUltimateSpell(chapter, 'advanced')?.name}`);
      expect(markup).toContain('data-ultimate-tier="advanced"');
      expect(markup).not.toContain('<button');
    }
  });

  it('retains the distinctive advanced form and readable name when reduced motion is enabled', () => {
    const markup = renderToStaticMarkup(<UltimateCinematic chapter={5} mode="advanced" cue="ultimate-9-30" reducedMotion />);
    expect(markup).toContain('is-reduced');
    expect(markup).toContain('ultimate-summon-phoenix');
    expect(markup).toContain(`/ai-campus-guardians${ULTIMATE_SUMMON_ART.phoenix.path}`);
    expect(markup).not.toContain('ultimate-phoenix-wing');
    expect(markup).toContain(getUltimateSpell(5, 'advanced')!.name);
  });

  it('sends the enlarged phoenix at the opponent before the full-battlefield fire, without adding input controls', () => {
    const markup = renderToStaticMarkup(<UltimateCinematic chapter={5} mode="advanced" cue="ultimate-4-30" reducedMotion={false} />);
    expect(markup).toContain('烈焰鳳變大展翼，飛向右方對手，命中後火焰燃燒全場');
    const phases = ['data-phase="summon-grow-flight"', 'data-phase="enemy-impact"', 'data-phase="full-battlefield-burn"'];
    const positions = phases.map(phase => markup.indexOf(phase));
    expect(positions.every(position => position > -1)).toBe(true);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
    expect(markup).toContain('ultimate-phoenix-fire-front');
    expect(markup).not.toContain('ultimate-main-shape ultimate-phoenix');
    expect(markup).not.toContain('<button');
  });

  it('does not replace the other five upgraded formations with phoenix impact or flame layers', () => {
    for (const chapter of [1, 2, 3, 4, 6]) {
      const markup = renderToStaticMarkup(<UltimateCinematic chapter={chapter} mode="advanced" cue="ultimate-4-30" reducedMotion={false} />);
      expect(markup).not.toContain('data-phase="enemy-impact"');
      expect(markup).not.toContain('data-phase="full-battlefield-burn"');
    }
  });

  it('sends a horned ice dragon before crystal impact and frost, replacing every world-tree formation', () => {
    const markup = renderToStaticMarkup(<UltimateCinematic chapter={6} mode="advanced" cue="ultimate-4-30" reducedMotion={false} />);
    expect(markup).toContain('有角與冰晶翼的巨大冰龍飛向對手，命中碎冰炸裂，寒霜蔓延全場');
    expect(markup).toContain('ultimate-summon-iceDragon');
    expect(markup).toContain(`/ai-campus-guardians${ULTIMATE_SUMMON_ART.iceDragon.path}`);
    expect(markup).not.toContain('ultimate-ice-dragon-horns');
    expect(markup).not.toContain('ultimate-ice-dragon-wing');
    expect(markup).toContain('ultimate-ice-spike-front');
    expect(markup).toContain('ultimate-ice-ground-cracks');
    const phases = ['data-phase="ice-dragon-flight"', 'data-phase="ice-shatter-impact"', 'data-phase="full-battlefield-frost"'];
    const positions = phases.map(phase => markup.indexOf(phase));
    expect(positions.every(position => position > -1)).toBe(true);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
    expect(markup).not.toContain('ultimate-world-tree');
    expect(markup).not.toContain('ultimate-tree-crown');
    expect(markup).not.toContain('ultimate-partner-shields');
    expect(markup).not.toContain('<button');
  });

  it('retains the ice dragon and crystals in reduced motion', () => {
    const markup = renderToStaticMarkup(<UltimateCinematic chapter={6} mode="advanced" cue="ultimate-9-30" reducedMotion />);
    expect(markup).toContain('is-reduced');
    expect(markup).toContain('ultimate-summon-iceDragon');
    expect(markup).toContain(`/ai-campus-guardians${ULTIMATE_SUMMON_ART.iceDragon.path}`);
    expect(markup).toContain('ultimate-ice-spike-front');
    expect(markup).toContain(getUltimateSpell(6, 'advanced')!.name);
  });

  it('reserves a crystal array, colossal lance with three companion crystals, shattering impact and frost wave for the starter ice ultimate', () => {
    const markup = renderToStaticMarkup(<UltimateCinematic chapter={6} mode="starter" cue="ultimate-4-30" reducedMotion={false} />);
    expect(markup).toContain('data-ultimate-tier="starter"');
    expect(markup).toContain(`初階必殺技：${getUltimateSpell(6, 'starter')!.name}`);
    expect(markup).toContain('ultimate-colossal-ice-lance');
    expect(markup).toContain('ultimate-lance-orbit-crystals');
    expect(markup).toContain('ultimate-frost-lance-fragments');
    const phases = ['data-phase="crystal-array"', 'data-phase="colossal-ice-lance-flight"', 'data-phase="colossal-lance-shatter"', 'data-phase="frost-wave"'];
    const positions = phases.map(phase => markup.indexOf(phase));
    expect(positions.every(position => position > -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(markup.match(/class="ultimate-colossal-ice-lance"/g)).toHaveLength(1);
    expect(markup).not.toContain('ultimate-ice-dragon');
    expect(markup).not.toContain('ultimate-tier-banner');
    expect(markup).not.toContain('<button');
  });

  it('preserves the colossal starter lance and frost wave as recognizable static forms in reduced motion', () => {
    const markup = renderToStaticMarkup(<UltimateCinematic chapter={6} mode="starter" cue="ultimate-9-30" reducedMotion />);
    expect(markup).toContain('is-reduced');
    expect(markup).toContain('ultimate-colossal-ice-lance');
    expect(markup).toContain('ultimate-frost-lance-wave');
    expect(markup).toContain(getUltimateSpell(6, 'starter')!.name);
  });

  it.each([{ chapter: 5, kind: 'phoenix' as const }, { chapter: 6, kind: 'iceDragon' as const }])('uses one full-color card-derived creature only for upgraded chapter $chapter, with the existing hit and end times', ({ chapter, kind }) => {
    const advanced = renderToStaticMarkup(<UltimateCinematic chapter={chapter} mode="advanced" cue="ultimate-4-35" reducedMotion={false} />);
    expect(advanced).toContain('ultimate-illustrated-summon');
    expect(advanced).toContain(`data-summon-art="${kind}"`);
    expect(advanced).toContain(`src="/ai-campus-guardians${ULTIMATE_SUMMON_ART[kind].path}"`);
    expect(advanced).toContain('width="1536" height="1024"');
    expect(advanced.match(/class="ultimate-summon-creature"/g)).toHaveLength(1);
    expect(advanced).toContain(`data-impact-ms="${ULTIMATE_SUMMON_TIMING.impactMs}"`);
    expect(advanced).toContain(`data-duration-ms="${ULTIMATE_SUMMON_TIMING.durationMs}"`);
    expect(advanced).toContain('--ultimate-summon-duration:3000ms');
    expect(advanced).not.toContain('ultimate-phoenix-wing');
    expect(advanced).not.toContain('ultimate-ice-dragon-wing');
    const starter = renderToStaticMarkup(<UltimateCinematic chapter={chapter} mode="starter" cue="ultimate-4-30" reducedMotion={false} />);
    expect(starter).not.toContain('ultimate-illustrated-summon');
    if (chapter === 5) {
      expect(starter.match(/class="ultimate-summon-creature"/g)).toHaveLength(1);
      expect(starter).toContain(ULTIMATE_SUMMON_ART.phoenix.path);
      expect(starter).not.toContain('full-battlefield-burn');
    } else {
      expect(starter).not.toContain('ultimate-summon-creature');
      expect(starter).not.toContain(ULTIMATE_SUMMON_ART[kind].path);
    }
  });
});
