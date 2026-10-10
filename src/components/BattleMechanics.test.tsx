import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { startSession } from '../domain/engine';
import { BattleMechanics, BattleRules } from './BattleMechanics';

describe('battle shield and ultimate status', () => {
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
  it('shows every active side effect and the final boss consecutive-error warning', () => {
    const session = { ...startSession(1, 'starter'), levelId: 13, enemyBurning: true, playerRegeneration: true,
      frostGuard: true, mirrorGuard: true, lightningHintQueued: true, wrongStreak: 1 };
    const html = renderToStaticMarkup(<BattleMechanics session={session} paused={false} onRules={() => {}} />);
    for (const text of ['魔王燃燒 · 每題 −4 HP', '持續回復 · 每題 ＋4 HP', '寒冰減傷 · 下次傷害減半', '鏡像閃避 · 下次 50% 落空',
      '雷光線索 · 下一題提示', '再連錯一次 · 魔王必殺 30 HP']) expect(html).toContain(text);
    const next = renderToStaticMarkup(<BattleMechanics session={{ ...session, lightningHintQueued: false, lightningHintChoices: [0, 2], wrongStreak: 2 }} paused={false} onRules={() => {}} />);
    expect(next).toContain('雷光線索 · 兩個選項有正解');
    expect(next).toContain('連錯追擊 · 魔王必殺 30 HP');
  });
  it('explains final boss damage separately from points and gives both tiers the same status effects', () => {
    for (const timed of [false, true]) {
      const html = renderToStaticMarkup(<BattleRules timed={timed} finalBoss />);
      for (const text of ['第一次答錯扣 20 HP', '合計最多 30 HP', '答對後連錯計數歸零', '雷光提示不扣分',
        '後續每題完成扣 4 HP', '後續每題完成自動再回復 4 HP', '50% 機率落空', 'HP 傷害減半']) expect(html).toContain(text);
      if (timed) expect(html).toContain('超時不累計連錯');
      expect(html).toContain(`最終魔王 ${timed ? 300 : 200} HP`);
    }
    expect(renderToStaticMarkup(<BattleRules timed />)).toContain('魔王攻擊扣 12 HP');
  });
});
