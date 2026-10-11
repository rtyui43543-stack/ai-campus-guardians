import { describe, expect, it } from 'vitest';
import { contactImpactMotion, contactReaction, enemyAttackName, enemyCastMotion, enemyPursuitPhase } from './combatChoreography';

describe('visible combat contact', () => {
  it('kicks at the shared 900 ms contact, changes direction for each target and settles within 360 ms', () => {
    expect(contactImpactMotion(.899).active).toBe(false);
    const enemy = contactImpactMotion(.9, { target: 'enemy', damage: 25 });
    const hero = contactImpactMotion(.9, { target: 'hero', damage: 12 });
    expect(enemy.active).toBe(true); expect(enemy.x).toBe(8);
    expect(hero.x).toBe(-enemy.x);
    expect(contactImpactMotion(.97).recoil).toBe(1);
    expect(contactImpactMotion(1.02).recoil).toBe(1);
    const recovery = contactImpactMotion(1.27);
    expect(recovery.active).toBe(false); expect(recovery.x).toBe(0); expect(recovery.scale).toBe(1);
    expect(recovery.recoil).toBeGreaterThan(0);
    for (const time of [1.38, 2.05, 3, Infinity, NaN]) {
      expect(contactImpactMotion(time)).toEqual({ active: false, x: 0, y: 0, scale: 1, recoil: 0, tremor: 0 });
    }
  });
  it('keeps enhanced hits within a short bounded shake and does not move a blocked or missed target', () => {
    for (let time = .9; time < 1.5; time += .005) {
      const motion = contactImpactMotion(time, { enhanced: true });
      expect(Math.abs(motion.x)).toBeLessThanOrEqual(12);
      expect(Math.abs(motion.y)).toBeLessThanOrEqual(5.76);
      expect(motion.scale).toBeGreaterThanOrEqual(1); expect(motion.scale).toBeLessThanOrEqual(1.028);
      expect(motion.recoil).toBeGreaterThanOrEqual(0); expect(motion.recoil).toBeLessThanOrEqual(1);
      for (const options of [{ reducedMotion: true }, { missed: true, damage: 12 }, { blocked: true }, { blocked: true, damage: 0 }, { damage: 0 }]) {
        expect(contactImpactMotion(time, options)).toEqual({ active: false, x: 0, y: 0, scale: 1, recoil: 0, tremor: 0 });
      }
    }
    // A partial shield that still lets real damage through remains a visible hit.
    expect(contactImpactMotion(.97, { blocked: true, damage: 6 }).active).toBe(true);
    expect(contactImpactMotion(.9, { enhanced: true }).x).toBeGreaterThan(contactImpactMotion(.9).x);
  });
  it('holds the reaction after contact and recovers before the cast finishes', () => {
    expect(contactReaction(.899)).toBe(0);
    expect(contactReaction(.97)).toBe(1);
    expect(contactReaction(1.02)).toBe(1);
    expect(contactReaction(1.2)).toBeGreaterThan(0);
    expect(contactReaction(1.4)).toBe(0);
    expect(contactReaction(2.05)).toBe(0);
  });
  it('never adds a false hit to dodges or motion to reduced presentation', () => {
    for (const time of [.2, .48, .9, .98, 1.3, 2.1, NaN, Infinity]) {
      expect(contactReaction(time, false, true)).toBe(0);
      expect(contactReaction(time, true)).toBe(0);
      expect(enemyCastMotion(time, true)).toEqual({ anticipation: 0, release: 0 });
    }
  });
  it('keeps anticipation and commitment bounded and returns to the idle slot', () => {
    expect(enemyCastMotion(.34).anticipation).toBe(1);
    expect(enemyCastMotion(.6).release).toBe(1);
    for (let time = 0; time < 2.1; time += .01) {
      const { anticipation, release } = enemyCastMotion(time);
      expect(anticipation).toBeGreaterThanOrEqual(0); expect(anticipation).toBeLessThanOrEqual(1);
      expect(release).toBeGreaterThanOrEqual(0); expect(release).toBeLessThanOrEqual(1);
    }
    expect(enemyCastMotion(2.05)).toEqual({ anticipation: 0, release: 0 });
  });
  it('names the casting boss independently of the learner’s chosen spell', () => {
    expect(enemyAttackName('starter', 1)).toBe('魔盒鎖鏈');
    expect(enemyAttackName('advanced', 1)).toBe('窺密蛛網');
    expect(enemyAttackName('advanced', 6)).toBe('急速雲拳');
    for (let chapter = 1; chapter <= 6; chapter++) {
      expect(enemyAttackName('starter', chapter, true, true)).toBe('混沌魔典追擊');
      expect(enemyAttackName('advanced', chapter, true, true)).toBe('九首幻焰追擊');
    }
  });
  it('announces chapter pursuit names while retaining each of the twelve original boss identities', () => {
    const names = new Set<string>();
    for (const mode of ['starter', 'advanced'] as const) for (let chapter = 1; chapter <= 6; chapter++) {
      const normal = enemyAttackName(mode, chapter);
      const pursuit = enemyAttackName(mode, chapter, false, true);
      expect(pursuit).toBe(normal + '追擊'); names.add(pursuit);
    }
    expect(names.size).toBe(12);
  });
  it('announces shield or mirror protection through both pursuit contacts instead of reporting a false hit', () => {
    for (const time of [.9, 1.02, 1.22, 1.5, 1.74]) {
      expect(enemyPursuitPhase(time, true)).toBe('守護盾攔截');
      expect(enemyPursuitPhase(time, false, true)).toBe('鏡像閃避 · 魔王落空');
      expect(enemyPursuitPhase(time)).toBe('魔王追擊必殺命中');
    }
    for (const time of [0, .2, .42, .7, .899]) {
      expect(enemyPursuitPhase(time, true)).toBe(enemyPursuitPhase(time));
      expect(enemyPursuitPhase(time, false, true)).toBe(enemyPursuitPhase(time));
    }
    expect(enemyPursuitPhase(1.75, true)).toBe('魔王追擊收勢');
  });
});
