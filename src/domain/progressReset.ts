import { createProgress } from './engine';
import { saveResetProgress } from './storage';
import type { Progress } from './types';

/** Reset both learning routes together; device preferences belong to the learner, not a run. */
export function resetLearningProgress(current: Progress): Progress {
  return { ...createProgress(), settings: { ...current.settings } };
}

/** All existing storage layers must be replaced and verified, or rolled back together. */
export async function persistLearningReset(fresh: Progress): Promise<void> {
  await saveResetProgress(fresh);
}
