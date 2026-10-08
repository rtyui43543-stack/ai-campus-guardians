import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UltimateCinematic } from './UltimateCinematic';
import { getUltimateSpell } from '../content/ultimateSpells';

describe('upgraded ultimate battlefield presentation', () => {
  it('keeps beginner and ordinary counterattack cues out of the advanced cinematic', () => {
    expect(renderToStaticMarkup(<UltimateCinematic chapter={1} mode="starter" cue="ultimate-1-20" reducedMotion={false} />)).toBe('');
    for (const cue of ['', 'success-1-20', 'retry-2-12', 'blocked-3-0']) {
      expect(renderToStaticMarkup(<UltimateCinematic chapter={1} mode="advanced" cue={cue} reducedMotion={false} />)).toBe('');
    }
  });

  it('offers six recognizable upgraded forms and labels the half/full battlefield presentation', () => {
    const forms = ['ultimate-castle', 'ultimate-book-storm', 'ultimate-sorting-forest', 'ultimate-mirror-hall', 'ultimate-phoenix', 'ultimate-world-tree'];
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
    expect(markup).toContain('ultimate-phoenix-wing');
    expect(markup).toContain(getUltimateSpell(5, 'advanced')!.name);
  });
});
