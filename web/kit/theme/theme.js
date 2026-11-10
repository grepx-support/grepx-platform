/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Light / dark theme: the viewer's choice (or the system's), applied as <html data-theme="light|dark">.
import { Emitter } from "../core/emitter.js";

export const THEMES = ["light", "dark"];

export class Theme extends Emitter {
  constructor(store, media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null) {
    super();
    this.store = store;
    this.media = media;
    this.media?.addEventListener?.("change", () => this.choice() === "system" && this.apply());
  }

  /** "light", "dark" or "system" (follow the device). */
  choice() { return this.store.get("theme", "system"); }

  current() {
    const c = this.choice();
    return c === "system" ? (this.media?.matches ? "dark" : "light") : c;
  }

  apply() {
    document.documentElement.dataset.theme = this.current();
    this.emit("change", this.current());
  }

  set(choice) {
    this.store.set("theme", choice);
    this.apply();
  }

  toggle() { this.set(this.current() === "dark" ? "light" : "dark"); }
}
