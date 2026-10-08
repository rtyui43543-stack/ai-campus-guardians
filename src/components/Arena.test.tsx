import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Arena } from './Arena';

describe('battle status feedback', () => {
  it('shows real burn and healing amounts separately from attack damage', () => {
    const html = renderToStaticMarkup(<Arena chapter={6} mode="starter" finalBoss enemyHp={250} playerHp={76}
      guardian="混沌魔典王" reducedMotion={false} cue="success-1-20"
      combatStatus={{ enemyBurning: true, playerRegeneration: true, frostGuard: true, mirrorGuard: true }}
      attackOutcome={{ burnDamage: 4, healing: 4 }} />);
    expect(html).toContain('燃燒 −4 HP'); expect(html).toContain('回復 ＋4 HP');
    for (const visual of ['enemy-burning', 'hero-regenerating', 'hero-frost', 'hero-mirror']) expect(html).toContain(visual);
    expect(html).not.toContain('魔王追擊必殺！');
  });
  it('shows a critical cast without repeating the HP or miss feedback managed by the battle screen', () => {
    const html = renderToStaticMarkup(<Arena chapter={6} mode="advanced" finalBoss enemyHp={250} playerHp={76}
      guardian="幻象九頭龍" reducedMotion cue="miss-1-0" attackOutcome={{ damage: 0, critical: true, missed: true }} />);
    expect(html).toContain('魔王追擊必殺！'); expect(html).not.toContain('鏡像閃避 · 落空！');
    expect(html).not.toContain('燃燒 −'); expect(html).not.toContain('回復 ＋');
    expect(html).toContain('reduced-motion');
  });
  it('keeps cinematics clear of current battle auras and per-turn feedback', () => {
    const html = renderToStaticMarkup(<Arena chapter={6} mode="starter" enemyHp={100} playerHp={100}
      guardian="米米" reducedMotion={false} cue="success-1-20" cinemaShot="hero"
      combatStatus={{ enemyBurning: true }} attackOutcome={{ burnDamage: 4 }} />);
    expect(html).not.toContain('arena-status-auras'); expect(html).not.toContain('arena-turn-feedback');
  });
});
