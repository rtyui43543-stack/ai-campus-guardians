import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { startSession } from '../domain/engine';
import { BattleMechanics, BattleRules } from './BattleMechanics';

describe('battle shield and ultimate status', () => {
  it('shows remaining advanced castle charges and then removes the depleted badge', () => {
    const session = startSession(7, 'advanced');
    for (const charges of [2, 1, 0]) {
      const html = renderToStaticMarkup(<BattleMechanics session={{ ...session, barrier: charges > 0, barrierCharges: charges }} paused={false} onRules={() => {}} />);
      if (charges) {
        expect(html).toContain(`護盾 ×${charges}`);
        expect(html).toContain(`剩餘 ${charges} 次護盾，每次魔王攻擊可擋住 12 HP`);
      } else expect(html).not.toContain('battle-barrier');
    }
  });
  it('keeps a legacy boolean shield as one charge and names the upgraded ice attack', () => {
    const html = renderToStaticMarkup(<BattleMechanics session={{ ...startSession(12, 'advanced'), barrier: true, barrierCharges: undefined, energy: 3 }} paused={false} onRules={() => {}} />);
    expect(html).toContain('護盾 ×1');
    expect(html).toContain('下一題答對：極寒冰龍');
    expect(html).not.toContain('伙伴守護樹');
  });
  it('explains the two-hit advanced castle when timed attacks can consume it', () => {
    const html = renderToStaticMarkup(<BattleRules timed />);
    expect(html).toContain('進階城堡可擋兩次攻擊');
    expect(html).toContain('每次護盾抵擋 12 HP');
  });
});
