/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Keyboard shortcuts for the whole app. "g" then a letter jumps to the page whose route says key: "<letter>".
import { visible } from "../session.js";
import { state } from "../state.js";

export const SHORTCUTS = [[["Ctrl", "K"], "Search pages, actions and records"], [["/"], "Search too"],
  [["G", "then a letter"], "Go to a page (the letter is shown in search)"], [["?"], "This list"], [["Esc"], "Close a dialog or search"]];

const typing = (e) => e.target.closest?.("input, textarea, select, [contenteditable=true]");

export class Shortcuts {
  /** handlers: { find(), help() } */
  constructor(handlers) {
    this.handlers = handlers;
    this.waitingForG = 0;
    window.addEventListener("keydown", (e) => this.key(e));
  }

  key(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); return this.handlers.find(); }
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); return this.handlers.find(); }
    if (e.key === "?") { e.preventDefault(); return this.handlers.help(); }
    if (Date.now() - this.waitingForG < 1200) { this.waitingForG = 0; return this.go(e.key.toLowerCase()); }
    if (e.key.toLowerCase() === "g") this.waitingForG = Date.now();
  }

  go(letter) {
    const r = state.routes.find((x) => x.key === letter && x.nav && visible(x));
    if (r) location.hash = `#${r.path}`;
  }
}
