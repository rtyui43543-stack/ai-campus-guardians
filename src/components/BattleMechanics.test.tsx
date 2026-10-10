import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { startSession } from '../domain/engine';
import { BattleMechanics, BattleRules } from './BattleMechanics';

describe('battle shield and ultimate status', () => {
  it.each([[4, 25, 5, 20], [5, 20, 4, 16]])('explains an active %i-question starter session using its own damage and score rules', (questionCount, points, penalty, hintCap) => {
    const html = renderToStaticMarkup(<BattleRules timed={false} questionCount={questionCount} />);
    expect(html).toContain(`本關 ${questionCount} 題，每題 ${points} 分`);
    expect(html).toContain(`每答錯一次扣 ${penalty} 分，自己答對至少得 ${penalty} 分`);
    expect(html).toContain(`用過提示，該題最高 ${hintCap} 分`);
    expect(html).toContain(`本關 ${questionCount} 題，普通攻擊每次扣魔王 ${points} HP`);
  });
  it('labels a narration pause without resetting the current question seconds', () => {
    const session = { ...startSession(11, 'advanced'), remainingMs: 21_250, elapsedMs: 8_750 };
    const html = renderToStaticMarkup(<BattleMechanics session={session} paused narrationPaused onRules={() => {}} />);
    expect(html).toContain('本題剩餘 22 秒，朗讀期間倒數暫停');
    expect(html).toContain('朗讀暫停倒數');
    expect(html).toContain('battle-narration-paused');
    expect(session.remainingMs).toBe(21_250);
    const rules = renderToStaticMarkup(<BattleRules timed />);
    expect(rules).toContain('重播與重試都不重設秒數');
    expect(rules).toContain('朗讀載入、播放期間');
  });
  it('shows remaining advanced castle charges and then removes the depleted badge', () => {
    const session = startSession(7, 'advanced');
    for (const charges of [2, 1, 0]) {
      const html = renderToStaticMarkup(<BattleMechanics session={{ ...session, barrier: charges > 0, barrierCharges: charges }} paused={false} onRules={() => {}} />);
      if (charges) {
        expect(html).toContain(`護盾 ×${charges}`);
        expect(html).toContain(`剩餘 ${charges} 次護盾，不限傷害數值，完整抵擋命中攻擊`);
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
    expect(html).toContain('城堡完整抵擋命中攻擊，不限傷害數值');
  });
  it('shows every active side effect and the final boss consecutive-error warning', () => {
    const session = { ...startSession(1, 'starter'), levelId: 13, enemyBurning: true, playerRegeneration: true,
      frostGuard: true, frostGuardCharges: undefined, mirrorGuard: true, mirrorGuardCharges: undefined,
      lightningHintQueued: true, lightningHintQuestions: undefined, wrongStreak: 1 };
    const html = renderToStaticMarkup(<BattleMechanics session={session} paused={false} onRules={() => {}} />);
    for (const text of ['魔王燃燒 · 每題 −4 HP', '持續回復 · 每題 ＋4 HP', '寒冰減傷 · 剩 1 次命中減半', '鏡像閃避 · 剩 1 次 50% 落空',
      '雷光線索 · 接下來 1 題提示', '再連錯一次 · 魔王必殺 30 HP']) expect(html).toContain(text);
    const next = renderToStaticMarkup(<BattleMechanics session={{ ...session, lightningHintQueued: false, lightningHintQuestions: 0, lightningHintChoices: [0, 2], wrongStreak: 2 }} paused={false} onRules={() => {}} />);
    expect(next).toContain('雷光線索 · 本題兩個選項有正解');
    expect(next).toContain('連錯追擊 · 魔王必殺 30 HP');
  });
  it('explains final boss damage separately from points and distinguishes advanced spell durations', () => {
    for (const timed of [false, true]) {
      const html = renderToStaticMarkup(<BattleRules timed={timed} finalBoss />);
      for (const text of ['第一次答錯扣 20 HP', '合計最多 30 HP', '答對後連錯計數歸零', '雷光提示不扣分',
        `後續每題完成扣 ${timed ? 6 : 4} HP`, '後續每題完成自動再回復 4 HP', '50% 機率落空', 'HP 傷害減半']) expect(html).toContain(text);
      if (timed) expect(html).toContain('超時不累計連錯');
      expect(html).toContain(`最終魔王 ${timed ? 300 : 200} HP`);
    }
    expect(renderToStaticMarkup(<BattleRules timed />)).toContain('魔王攻擊扣 12 HP');
  });
  it('shows exact remaining advanced effects and six-HP burning only for its final boss', () => {
    const session = { ...startSession(7, 'advanced'), frostGuard: true, frostGuardCharges: 2,
      mirrorGuard: true, mirrorGuardCharges: 2, lightningHintQueued: true, lightningHintQuestions: 1,
      lightningHintChoices: [0, 2], enemyBurning: true, wrongStreak: 1 };
    const html = renderToStaticMarkup(<BattleMechanics session={session} paused={false} onRules={() => {}} />);
    for (const text of ['剩 2 次命中減半', '剩 2 次 50% 落空', '本題兩個選項有正解，另剩 1 題',
      '再連錯一次 · 魔王必殺 22 HP', '魔王燃燒 · 每題 −4 HP']) expect(html).toContain(text);
    const finalHtml = renderToStaticMarkup(<BattleMechanics session={{ ...session, levelId: 14 }} paused={false} onRules={() => {}} />);
    expect(finalHtml).toContain('魔王燃燒 · 每題 −6 HP');
    expect(finalHtml).toContain('再連錯一次 · 魔王必殺 30 HP');
    const exhausted = renderToStaticMarkup(<BattleMechanics session={{ ...session, frostGuardCharges: 0, mirrorGuardCharges: 0,
      lightningHintQuestions: 0, lightningHintChoices: [] }} paused={false} onRules={() => {}} />);
    expect(exhausted).not.toContain('寒冰減傷');
    expect(exhausted).not.toContain('鏡像閃避');
    expect(exhausted).not.toContain('雷光線索');
  });
  it.each([false, true])('explains main-boss pursuit and full defense in both tiers (advanced: %s)', timed => {
    const html = renderToStaticMarkup(<BattleRules timed={timed} />);
    expect(html).toContain('連續第二次答錯起施放追擊必殺，額外加 10 HP，合計最多 22 HP');
    expect(html).toContain(`完整抵擋下${timed ? '兩次' : '一次'}魔王命中攻擊`);
    expect(html).toContain('再計算城堡護盾的抵擋');
    expect(html).not.toContain('抵擋 12 HP');
    if (timed) {
      expect(html).toContain('下兩題各有兩個選項');
      expect(html).toContain('下兩次攻擊各有 50%');
      expect(html).toContain('下兩次命中攻擊');
    }
  });
});
