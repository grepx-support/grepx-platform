/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Widgets a dashboard can show. Adding a widget = registering one more definition; the grid never changes (open/closed).
//
// A definition: { id, title, icon, area (colour), size: "s"|"m"|"l",
//                 allowed(ctx) -> bool          who may see it (permissions, modules),
//                 load(ctx) -> Promise<data>    its own data (one failing widget never breaks the others),
//                 render(data, ctx) -> markup | Element }

export class WidgetRegistry {
  constructor() { this.defs = new Map(); }

  register(def) {
    for (const field of ["id", "title", "load", "render"]) {
      if (!def[field]) throw new Error(`widget ${def.id || "?"} needs ${field}`);
    }
    this.defs.set(def.id, { size: "s", icon: "dot", allowed: () => true, ...def });
    return this;
  }

  get(id) { return this.defs.get(id); }

  /** The definitions this viewer may see, in registration order. */
  allowed(ctx) { return [...this.defs.values()].filter((d) => d.allowed(ctx)); }
}
