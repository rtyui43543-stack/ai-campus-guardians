import { createCoverGuardian, type CoverGuardianRig } from './coverGuardian';
import { createBookSpirit, createMagicChest, createMaskPhantom } from './magicBosses';
import { createGearKing, createPaperDragon } from './beastBosses';

/** Mission names, topic colours and animation joints stay the same across species. */
export function createChapterBoss(chapter: number): CoverGuardianRig {
  const theme = Math.max(1, Math.min(6, Math.trunc(chapter) || 1));
  switch (theme) {
    case 1: return createMagicChest();
    case 2: return createBookSpirit();
    case 3: return createCoverGuardian(3);
    case 4: return createMaskPhantom();
    case 5: return createPaperDragon();
    case 6: return createGearKing();
  }
  throw new Error('無法建立主題魔王');
}
