export type Mode = 'starter' | 'advanced';
export type QuestionKind = 'knowledge' | 'principle' | 'tradeoff';
export type Phase = 'notice' | 'evidence' | 'action' | 'reason' | 'transfer' | 'remedy';
export type SourceLabel = 'textbook' | 'extension' | 'mixed';
export interface Choice { text: string; feedback: string }
export interface Evidence { title: string; body: string }
export interface Source { units: number[]; pages: string; label: SourceLabel }
export interface QuestionSpec {
  kind: QuestionKind;
  prompt: string;
  advancedPrompt: string;
  choices: Choice[];
  reasons: Choice[];
  valid: Record<number, number[]>;
  advancedValid?: Record<number, number[]>;
  hint: string;
  explanation: string;
  objective: string;
  evidence?: Evidence[];
  advancedEvidence?: Evidence[];
  source?: Source;
  advancedChoices?: Choice[];
  advancedReasons?: Choice[];
  advancedExplanation?: string;
}
export interface Question extends QuestionSpec {
  id: string;
  levelId: number;
  slot: number;
  phase: Phase;
  source: Source;
  animation: string;
  variantOf?: string;
  /** Final missions retain the original learning topic and editorial source. */
  copiedFrom?: string;
  themeId?: number;
}
export interface Chapter {
  id: number; title: string; shortTitle: string; subtitle: string;
  description: string; color: string; skill: string; guardian: string;
  icon: 'scan' | 'compass' | 'search' | 'shield' | 'hand' | 'spark';
}
export interface Level {
  id: number; chapterId: number; title: string; objective: string;
  intro: string; boss: boolean; source: Source; mode: Mode;
  finalBoss?: boolean;
}
export type LearningStatus = 'first' | 'supported' | 'practice' | 'timeout';
export interface AttemptRecord {
  questionId: string; mode: Mode; action: number | null; reason: number | null;
  status: LearningStatus; retries: number; hintUsed: boolean; at: string;
  /** Present on new demo records whose retry count was recorded accurately. */
  demoUsed?: boolean;
  /** Only new timed attempts include these fields; historical scores stay unchanged. */
  timed?: boolean;
  elapsedMs?: number;
  timedOut?: boolean;
  ultimateUsed?: boolean;
  ultimateId?: number;
  preventedDamage?: boolean;
}
export interface Session {
  id: string; levelId: number; mode: Mode; questionIds: string[]; index: number;
  step: 'action' | 'reason' | 'feedback' | 'defeat'; selected: number | null; reason: number | null;
  retries: number; hintUsed: boolean; feedback: string; success: boolean;
  shield: number; repaired: number; records: AttemptRecord[]; review: boolean;
  demoUsed?: boolean;
  /** Older demonstrations raised retries to two; this marks the new exact counter. */
  demoRetriesKnown?: boolean;
  /** Battle resources persist within one session and reset for every new run. */
  energy?: number;
  ultimateUsed?: boolean;
  ultimateId?: number;
  /** Compatibility switch; the remaining count is authoritative on new saves. */
  barrier?: boolean;
  /** Old boolean-only shields migrate to one charge, never an upgraded two. */
  barrierCharges?: number;
  bonusPoints?: number;
  enemyBonusDamage?: number;
  /** Final missions let the learner choose a spell only after all three energy points are earned. */
  preparedUltimateId?: number;
  /** Timers are opt-in on newly started advanced main missions. */
  timed?: boolean;
  remainingMs?: number;
  elapsedMs?: number;
  timedOut?: boolean;
  preventedDamage?: boolean;
}
export interface CompletedRun {
  sessionId: string; levelId: number; mode: Mode; review: boolean;
  records: AttemptRecord[]; at: string;
  /** A finished timed run can have a score without completing the mission. */
  passed?: boolean;
}
export interface UltimateCardUnlock {
  ultimateId: number; unlockedAt: string; sessionId: string; questionId: string;
}
export interface Proposal {
  at: string; mode: Mode; decisions: { questionId: string; action: string; reason: string }[];
  reflection: string;
}
export interface Progress {
  schemaVersion: 2;
  completed: number[];
  attempts: AttemptRecord[];
  active: Session | null;
  proposals: Proposal[];
  settings: { mode: Mode; sound: boolean; music: boolean; narration: boolean; reducedMotion: boolean };
  updatedAt: string;
  finishedSessionIds?: string[];
  runs?: CompletedRun[];
  ultimateCards?: UltimateCardUnlock[];
}
