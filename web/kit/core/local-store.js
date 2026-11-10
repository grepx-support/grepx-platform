/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Per-viewer settings in the browser (theme, dashboard layout, last tab). Never business data.
// Browser storage can be missing or throw (private mode, blocked site data), so every call is guarded
// and the page still works with defaults.

export class LocalStore {
  constructor(prefix = "grepx") { this.prefix = prefix; }

  key(name) { return `${this.prefix}.${name}`; }

  get(name, fallback = null) {
    try {
      const text = localStorage.getItem(this.key(name));
      return text === null ? fallback : JSON.parse(text);
    } catch (e) {
      return fallback;
    }
  }

  set(name, value) {
    try { localStorage.setItem(this.key(name), JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  remove(name) {
    try { localStorage.removeItem(this.key(name)); } catch (e) { /* storage unavailable */ }
  }
}

/** The same interface in memory - for tests and when nothing should be remembered. */
export class MemoryStore {
  constructor() { this.data = new Map(); }
  get(name, fallback = null) { return this.data.has(name) ? this.data.get(name) : fallback; }
  set(name, value) { this.data.set(name, value); }
  remove(name) { this.data.delete(name); }
}
