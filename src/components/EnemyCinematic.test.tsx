import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EnemyCinematic, ENEMY_CINEMATIC_TIMING } from './EnemyCinematic';

describe('final enemy critical cinematics', () => {
  it('leaves student casts and ordinary/blocked enemy attacks out of the critical layer', () => {
    for (const mode of ['starter', 'advanced'] as const) for (const cue of ['', 'success-1-25', 'ultimate-4-30', 'retry-1-12', 'blocked-2-0', 'miss-3-0']) {
      expect(renderToStaticMarkup(<EnemyCinematic mode={mode} cue={cue} reducedMotion={false} />)).toBe('');
    }
  });

  it.each([false, true])('gives the grimoire king a visible book, flying rune pages and local seal rupture (reduced=%s)', reducedMotion => {
    const markup = renderToStaticMarkup(<EnemyCinematic mode="starter" cue="enemy-ultimate-3-24" reducedMotion={reducedMotion} />);
    expect(markup).toContain('data-boss="chaos-grimoire-king"');
    expect(markup).toContain('data-form="chaos-grimoire"');
    expect(markup.match(/data-form="rune-page"/g)).toHaveLength(11);
    const phases = ['grimoire-open-charge', 'rune-pages-fan-flight', 'broken-rune-seal'].map(phase => markup.indexOf(`data-phase="${phase}"`));
    expect(phases.every(position => position >= 0)).toBe(true);
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    expect(markup.includes('is-reduced')).toBe(reducedMotion);
  });

  it.each([false, true])('retains all nine left-facing phantom heads, converging flames and a contained burst (reduced=%s)', reducedMotion => {
    const markup = renderToStaticMarkup(<EnemyCinematic mode="advanced" cue="enemy-ultimate-3-30" reducedMotion={reducedMotion} />);
    expect(markup).toContain('data-boss="illusion-nine-dragon"');
    expect(markup.match(/class="enemy-spectral-head"/g)).toHaveLength(9);
    expect([...markup.matchAll(/data-head="(\d)"/g)].map(match => Number(match[1]))).toEqual([1,2,3,4,5,6,7,8,9]);
    expect(markup).toContain('data-facing="left"');
    const phases = ['nine-head-charge', 'nine-flames-converge-flight', 'phantom-flame-local-burst'].map(phase => markup.indexOf(`data-phase="${phase}"`));
    expect(phases.every(position => position >= 0)).toBe(true);
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    expect(markup).not.toMatch(/ultimate-summon|phoenix|ice-dragon|rotate\(180\)/);
  });

  it('uses the existing 480 ms launch, 900 ms hit and 2050 ms end without interactive controls or a new timer', () => {
    expect(ENEMY_CINEMATIC_TIMING).toEqual({durationMs:2050,launchMs:480,impactMs:900});
    const markup = renderToStaticMarkup(<EnemyCinematic mode="starter" cue="enemy-ultimate-2-24" reducedMotion={false} />);
    for (const [attribute, value] of [['duration',2050],['launch',480],['impact',900]]) expect(markup).toContain(`data-${attribute}-ms="${value}"`);
    expect(markup).toContain('data-scope="combat-window"');
    expect(markup).not.toMatch(/<button|<audio|<video/);
    const source = readFileSync(new URL('./EnemyCinematic.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/setTimeout|setInterval|useEffect|requestAnimationFrame/);
  });

  it.each(['starter','advanced'] as const)('renders an interception or a near miss instead of a false body hit for %s', mode => {
    const blocked = renderToStaticMarkup(<EnemyCinematic mode={mode} cue="enemy-ultimate-3-0" reducedMotion={false} blocked />);
    expect(blocked).toContain('data-outcome="blocked"');
    expect(blocked).toContain('data-phase="guard-intercept"');
    expect(blocked).not.toContain('data-phase="broken-rune-seal"');
    expect(blocked).not.toContain('data-phase="phantom-flame-local-burst"');
    const missed = renderToStaticMarkup(<EnemyCinematic mode={mode} cue="miss-3-0" reducedMotion missed />);
    expect(missed).toContain('data-outcome="missed"');
    expect(missed).toContain('data-phase="missed-cast-dissipates"');
    expect(missed).toContain('主角閃避，法術在身旁消散');
    expect(missed).not.toContain('data-phase="guard-intercept"');
    expect(missed).not.toContain('data-phase="broken-rune-seal"');
    expect(missed).not.toContain('data-phase="phantom-flame-local-burst"');
  });

  it('keeps its cast clipped to the actor window and all motion disabled for both reduced-motion preferences', () => {
    const css = readFileSync(new URL('../styles/enemy-cinematic.css', import.meta.url), 'utf8');
    expect(css).toContain('var(--combat-top,120px)');
    expect(css).toContain('var(--combat-bottom,78%)');
    expect(css).toContain('var(--enemy-lane-x,71%)');
    expect(css).toContain('var(--hero-lane-x,29%)');
    expect(css).toContain('@media(max-width:600px)');
    expect(css).toContain('.enemy-cinematic .enemy-secondary-detail{display:none}');
    expect(css).toContain('.enemy-cinematic.is-reduced,.enemy-cinematic.is-reduced *{animation:none!important}');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).not.toMatch(/position:fixed|mix-blend-mode|animation-iteration-count:infinite/);
    // CSS percentage boundaries are tied to the battle clock, not the longer
    // learner ultimate, which would let an enemy effect overlap the next turn.
    const duration = Number(css.match(/--enemy-cinematic-duration:(\d+)ms/)![1]);
    expect(duration * .234146).toBeCloseTo(ENEMY_CINEMATIC_TIMING.launchMs, 2);
    expect(duration * .439024).toBeCloseTo(ENEMY_CINEMATIC_TIMING.impactMs, 2);
  });

  it('scopes each SVG definition so two mounted casts cannot cross-reference their gradients', () => {
    const markup = renderToStaticMarkup(<><EnemyCinematic mode="starter" cue="enemy-ultimate-1-24" reducedMotion={false} /><EnemyCinematic mode="starter" cue="enemy-ultimate-2-24" reducedMotion={false} /></>);
    const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of markup.matchAll(/url\(#([^)]*)\)/g)) expect(ids).toContain(match[1]);
  });
});
