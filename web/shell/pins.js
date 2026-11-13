/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The pages a person pinned to the top of the menu, and the menu groups they folded away. Kept in this browser per
// login; when the browser keeps nothing (private window), pins last until the page reloads.
import { state } from "./state.js";

class Saved {
  constructor(name) { Object.assign(this, { name, memory: {} }); }
  key() { return `${this.name}.${state.me?.id || state.me?.user_id || state.me?.email || "anon"}`; }
  read() {
    try { const v = JSON.parse(localStorage.getItem(this.key()) || "null"); if (v) return v; } catch (e) { /* storage unavailable */ }
    return this.memory[this.key()] || [];
  }
  write(list) {
    this.memory[this.key()] = list;
    try { localStorage.setItem(this.key(), JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
  }
  has(x) { return this.read().includes(x); }
  toggle(x) { const list = this.read(); this.write(list.includes(x) ? list.filter((y) => y !== x) : [...list, x].slice(-9)); }
}

/** Route paths pinned to the top of the menu (at most nine: Alt+1 .. Alt+9 open them). */
export const pins = new Saved("pins");
/** Menu groups folded away. */
export const folded = new Saved("nav.folded");
