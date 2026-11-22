/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The viewer's theme: a mode (light / dark / follow the device) and a colour palette, applied as
// <html data-theme="light|dark" data-palette="brand|ocean|...">. The product's own colours (product.json theme)
// are the "brand" palette: set on the page only while it is the one chosen, so other palettes are not overridden.
import { Emitter } from "../core/emitter.js";
import { offered } from "./palettes.js";

export const THEMES = ["light", "dark"];
export const MODES = ["light", "dark", "system"];

export class Theme extends Emitter {
  constructor(store, media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null, root = null) {
    super();
    this.store = store;
    this.media = media;
    this.root = root;
    this.vars = {};
    this.list = offered();
    this.fallback = "brand";
    this.media?.addEventListener?.("change", () => this.choice() === "system" && this.apply());
  }

  /** The product's palettes (product.json "palettes") and its own colours (product.json "theme"). */
  configure({ palettes, palette, vars } = {}) {
    this.list = offered(palettes);
    this.fallback = this.offers(palette) ? palette : "brand";
    this.vars = vars || {};
    return this;
  }

  offers(id) { return this.list.some((p) => p.id === id); }

  /** "light", "dark" or "system" (follow the device). */
  choice() { return this.store.get("theme", "system"); }

  current() {
    const c = this.choice();
    return c === "system" ? (this.media?.matches ? "dark" : "light") : c;
  }

  palette() {
    const id = this.store.get("palette", "");
    return this.offers(id) ? id : this.fallback;
  }

  apply() {
    const root = this.root || document.documentElement, brand = this.palette() === "brand";
    root.dataset.theme = this.current();
    root.dataset.palette = this.palette();
    for (const [k, v] of Object.entries(this.vars)) brand ? root.style.setProperty(`--${k}`, v) : root.style.removeProperty(`--${k}`);
    this.emit("change", this.current());
  }

  set(choice) {
    this.store.set("theme", choice);
    this.apply();
  }

  setPalette(id) {
    if (!this.offers(id)) return;
    this.store.set("palette", id);
    this.apply();
  }

  toggle() { this.set(this.current() === "dark" ? "light" : "dark"); }
}
