/**
 * Simple CLI progress reporter.
 */
export class Progress {
  private current = 0;
  private lastPrint = 0;

  constructor(
    private total: number,
    private label: string
  ) {
    process.stdout.write(`${label}: 0/${total} (0%)`);
  }

  increment(amount = 1) {
    this.current += amount;
    const now = Date.now();
    // Print at most every 500ms to avoid console spam
    if (now - this.lastPrint > 500 || this.current === this.total) {
      const pct = Math.round((this.current / this.total) * 100);
      process.stdout.write(
        `\r${this.label}: ${this.current}/${this.total} (${pct}%)`
      );
      this.lastPrint = now;
    }
    if (this.current === this.total) {
      console.log(""); // newline at end
    }
  }

  done() {
    console.log(`${this.label}: Done.`);
  }
}
