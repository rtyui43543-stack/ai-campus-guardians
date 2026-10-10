import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CombatAttackLabel } from './CombatAttackLabel';

it('shows the opponent’s own attack name and never gives an enemy a hero reward', () => {
  const html = renderToStaticMarkup(<CombatAttackLabel success={false} ultimate={false} critical={false} finalBoss={false} mode="advanced" chapter={3} />);
  expect(html).toContain('偏心藤鞭'); expect(html).toContain('魔王出招');
  expect(html).not.toContain('獎勵'); expect(html).toContain('is-enemy');
});
it('preserves the normal and starter ultimate hero names while advanced cinematics supply their own title', () => {
  const props = { success: true, ultimate: false, critical: false, finalBoss: false, mode: 'starter' as const, chapter: 6 };
  expect(renderToStaticMarkup(<CombatAttackLabel {...props} />)).toContain('霜晶冰矛');
  expect(renderToStaticMarkup(<CombatAttackLabel {...props} chapter={1} ultimate />)).toContain('獎勵＋10分');
  expect(renderToStaticMarkup(<CombatAttackLabel {...props} ultimate mode="advanced" />)).toBe('');
});
it('uses final-boss attack identity even when the learner last chose ice or fire', () => {
  const props = { success: false, ultimate: false, critical: true, finalBoss: true, mode: 'advanced' as const };
  for (const chapter of [1, 5, 6]) {
    const html = renderToStaticMarkup(<CombatAttackLabel {...props} chapter={chapter} />);
    expect(html).toContain('九首幻焰追擊'); expect(html).toContain('is-ultimate');
    expect(html).not.toContain('獎勵');
  }
});
