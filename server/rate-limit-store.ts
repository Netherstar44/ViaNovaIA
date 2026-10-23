type Entry = {
  totalHits: number;
  resetTime: number;
};

type StoreOptions = {
  windowMs?: number;
};

/**
 * In-memory rate limit store that does not create timers at module scope.
 * Workers forbid timers during global initialization, so entries are cleaned
 * lazily on access instead of through setInterval().
 */
export class WorkerMemoryStore {
  localKeys = true;
  private hits = new Map<string, Entry>();
  private windowMs = 60_000;

  init(options: StoreOptions = {}) {
    if (options.windowMs) this.windowMs = options.windowMs;
  }

  async increment(key: string) {
    const now = Date.now();
    let entry = this.hits.get(key);

    if (!entry || entry.resetTime <= now) {
      entry = { totalHits: 0, resetTime: now + this.windowMs };
      this.hits.set(key, entry);
    }

    entry.totalHits += 1;

    return {
      totalHits: entry.totalHits,
      resetTime: new Date(entry.resetTime),
    };
  }

  async decrement(key: string) {
    const entry = this.hits.get(key);
    if (entry && entry.totalHits > 0) entry.totalHits -= 1;
  }

  async resetKey(key: string) {
    this.hits.delete(key);
  }

  async resetAll() {
    this.hits.clear();
  }
}
