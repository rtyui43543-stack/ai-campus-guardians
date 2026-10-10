import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getQuestions } from '../content';
import { levels } from '../content/levels';
import { StoryCinematic } from './StoryCinematic';

vi.mock('./Arena', () => ({
  Arena: ({ enemyHp, mode, finalBoss }: { enemyHp: number; mode: string; finalBoss?: boolean }) =>
    <div data-testid="story-arena" data-enemy-hp={enemyHp} data-mode={mode} data-final-boss={!!finalBoss} />,
}));

describe('story mission preparation matches the current campaign', () => {
  it.each(levels)('shows the actual question count and boss health for $mode level $id', level => {
    const noop = () => {};
    const html = renderToStaticMarkup(<StoryCinematic level={level} beats={[]} reducedMotion
      onClose={noop} onStart={noop} onNarrate={noop} onStopNarration={noop} />);
    const questionCount = level.finalBoss ? 15 : level.mode === 'starter' ? 4 : 5;
    const enemyHp = level.finalBoss ? level.mode === 'starter' ? 200 : 300 : 100;

    expect(html).toContain('story-ready');
    expect(html).toContain('任務準備完成！');
    expect(html).toContain('開始對戰');
    expect(getQuestions(level.id)).toHaveLength(questionCount);
    expect(html).toContain(`data-enemy-hp="${enemyHp}"`);
    expect(html).toContain(`data-mode="${level.mode}"`);

    if (level.finalBoss) {
      expect(html).toContain('最多 15 道綜合題');
      expect(html).toContain(`魔王 ${enemyHp} HP`);
      expect(html).not.toContain('道生活題');
    } else {
      expect(html).toContain(`${questionCount} 道生活題`);
      expect(html).not.toContain(`${level.mode === 'starter' ? 5 : 4} 道生活題`);
      expect(html).not.toContain('道綜合題');
    }
  });
});
