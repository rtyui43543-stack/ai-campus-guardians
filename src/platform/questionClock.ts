/** Monotonic active-play time; background and explanation time are excluded. */
export class QuestionClock {
  private checkpoint: number | null = null;

  resume(now: number): void { this.checkpoint = now; }

  consume(now: number): number {
    if (this.checkpoint === null || now <= this.checkpoint) return 0;
    const elapsed = Math.floor(now - this.checkpoint);
    this.checkpoint += elapsed;
    return elapsed;
  }

  pause(now: number): number {
    const elapsed = this.consume(now);
    this.checkpoint = null;
    return elapsed;
  }
}
