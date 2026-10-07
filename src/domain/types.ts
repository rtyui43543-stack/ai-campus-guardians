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
}
export interface Chapter {
  id: number; title: string; shortTitle: string; subtitle: string;
  description: string; color: string; skill: string; guardian: string;
  icon: 'scan' | 'compass' | 'search' | 'shield' | 'hand' | 'spark';
}
export interface Level {
  id: number; chapterId: number; title: string; objective: string;
  intro: string; boss: boolean; source: Source; mode: Mode;
}
export type LearningStatus = 'first' | 'supported' | 'practice';
export interface AttemptRecord {
  questionId: string; mode: Mode; action: number; reason: number | null;
  status: LearningStatus; retries: number; hintUsed: boolean; at: string;
}
export interface Session {
  id: string; levelId: number; mode: Mode; questionIds: string[]; index: number;
  step: 'action' | 'reason' | 'feedback' | 'defeat'; selected: number | null; reason: number | null;
  retries: number; hintUsed: boolean; feedback: string; success: boolean;
  shield: number; repaired: number; records: AttemptRecord[]; review: boolean;
  demoUsed?: boolean;
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
}
