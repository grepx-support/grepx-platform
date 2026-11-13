/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A small time-limited cache: answers and the data behind them are reused for a while, so asking again is instant.
export class TtlCache {
  constructor(max = 200) { Object.assign(this, { max, rows: new Map() }); }

  get(key) {
    const hit = this.rows.get(key);
    if (!hit) return undefined;
    if (hit.until < Date.now()) { this.rows.delete(key); return undefined; }
    return hit.value;
  }

  set(key, value, seconds = 60) {
    if (this.rows.size >= this.max) this.rows.delete(this.rows.keys().next().value);       // oldest first
    this.rows.set(key, { value, until: Date.now() + seconds * 1000 });
    return value;
  }

  /** The cached value, or make it with fn() (a promise is cached too, so two askers share one request). */
  wrap(key, seconds, fn) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const made = fn();
    if (made?.catch) made.catch(() => this.rows.delete(key));
    return this.set(key, made, seconds);
  }

  clear() { this.rows.clear(); }
}
