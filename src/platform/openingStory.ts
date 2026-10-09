const OPENING_SEEN_KEY = 'ai-campus-guardians:opening:v1';

export function hasSeenOpening(): boolean {
  try { return localStorage.getItem(OPENING_SEEN_KEY) === 'seen'; } catch { return false; }
}

export function rememberOpening(): void {
  try { localStorage.setItem(OPENING_SEEN_KEY, 'seen'); } catch { /* Stories remain playable without storage. */ }
}

/** Only the viewing marker is removed; downloaded content and unrelated browser data stay intact. */
export function forgetOpening(): void {
  try { localStorage.removeItem(OPENING_SEEN_KEY); } catch { /* An inaccessible marker is treated as unseen. */ }
}
