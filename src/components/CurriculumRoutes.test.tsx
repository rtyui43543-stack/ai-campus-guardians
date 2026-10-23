import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MapScreen, Results } from '../App';
import { getLevel } from '../content/levels';
import { getQuestionsForHistory } from '../content';
import { allUltimateSpells } from '../content/ultimateSpells';
import { createProgress, startSession } from '../domain/engine';
import type { CompletedRun } from '../domain/types';
import { FinalBossChallenge, UltimatePicker } from './FinalBossChallenge';
import { GrowthPanel } from './Panels';

vi.mock('../platform/urls', () => ({ appAssetUrl: (path: string) => path }));

describe('current route entry points and legacy progress', () => {
  it.each([['starter', 5], ['advanced', 6]] as const)('renders the %s route with %i current missions and a mode-specific final gate', (mode, count) => {
    const progress = createProgress();
    progress.settings.mode = mode;
    progress.completed = Array.from({ length: 14 }, (_, i) => i + 1);
    const html = renderToStaticMarkup(<MapScreen progress={progress} nextLevel={getLevel(mode === 'starter' ? 1 : 7)} mastery={new Set()} onLevel={() => {}} onResume={() => {}} onStory={() => {}} />);
    expect(html.match(/class="chapter-card"/g)).toHaveLength(count);
    expect(html).toContain('13<b>／13 關');
    expect(html).toContain(`${count} 個生活主題`);
    if (mode === 'starter') expect(html).not.toContain('生活合作隊');
    else expect(html).toContain('人與 AI 合作');
  });

  it.each([['starter', 5], ['advanced', 6]] as const)('uses %s cards for unlock and the %i-choice picker', (mode, count) => {
    const progress = createProgress();
    progress.settings.mode = mode;
    progress.ultimateCards = allUltimateSpells.filter(spell => spell.mode === mode && (mode === 'advanced' || spell.id <= 5)).map(spell => ({ ultimateId: spell.id, mode, unlockedAt: '2026-10-23T04:00:00Z', sessionId: 'earned-cards', questionId: `${mode === 'starter' ? 'V5L' : 'V4L'}${String(spell.id + (mode === 'advanced' ? 6 : 0)).padStart(2, '0')}Q04` }));
    const html = renderToStaticMarkup(<FinalBossChallenge progress={progress} onLevel={() => {}} />);
    expect(html).toContain(`${count}／${count} 張必殺收藏卡`);
    expect(html).toContain('final-boss-challenge unlocked');
    const session = { ...startSession(mode === 'starter' ? 1 : 7, mode), levelId: mode === 'starter' ? 13 : 14, energy: 3 };
    const picker = renderToStaticMarkup(<UltimatePicker session={session} onSelect={() => {}} onHome={() => {}} />);
    expect(picker.match(/data-spell-choice/g)).toHaveLength(count);
    expect(picker.includes('極寒冰龍')).toBe(mode === 'advanced');
    expect(picker).not.toContain('寒晶冰矛');
  });

  it('never routes starter fifth results into the retired sixth mission, or offers that mission as a retry', () => {
    const run = (levelId: number, passed: boolean): CompletedRun => ({ sessionId: 'historical', levelId, mode: 'starter', review: false, passed, at: '2026-10-23T04:00:00Z', records: [] });
    const fifth = renderToStaticMarkup(<Results session={run(5, true)} onLevel={() => {}} onMap={() => {}} />);
    expect(fifth).toContain('前往進階第 1 關');
    expect(fifth).not.toContain('前往初階第 6 關');
    const retired = renderToStaticMarkup(<Results session={run(6, false)} onLevel={() => {}} onMap={() => {}} />);
    expect(retired).not.toContain('再挑戰這一關');
  });

  it('ignores retired completion and lets the advanced cooperation mission light its ability badge', () => {
    const progress = createProgress();
    progress.completed = [6, 12];
    const html = renderToStaticMarkup(<GrowthPanel progress={progress} onLevel={() => {}} onRun={() => {}} />);
    expect(html).toContain('1<small> / 13');
    expect(html.match(/class="skill-card unlocked"/g)).toHaveLength(1);
    expect(html).not.toContain('初階第 6 關');
  });

  it.each(['practice', 'timeout'] as const)('excludes retired %s records from current growth totals without deleting history', status => {
    const progress = createProgress();
    const record = { mode: 'starter' as const, action: null, reason: null, status, retries: 0, hintUsed: false, at: '2026-10-23T04:00:00Z' };
    progress.attempts = [{ ...record, questionId: getQuestionsForHistory(6)[0].id }];
    const retiredOnly = renderToStaticMarkup(<GrowthPanel progress={progress} onLevel={() => {}} onRun={() => {}} />);
    expect(retiredOnly).toContain('<strong>0</strong><span>已練習情境');
    expect(retiredOnly).toContain('<strong>0</strong><span>待練習情境');
    progress.attempts.push({ ...record, questionId: getQuestionsForHistory(1)[0].id });
    const mixed = renderToStaticMarkup(<GrowthPanel progress={progress} onLevel={() => {}} onRun={() => {}} />);
    expect(mixed).toContain('<strong>1</strong><span>已練習情境');
    expect(mixed).toContain('<strong>1</strong><span>待練習情境');
    expect(progress.attempts).toHaveLength(2);
  });
});
