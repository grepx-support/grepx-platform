/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The dashboard's arrangement as plain data (no DOM): which widgets, in what order, how big, which are hidden.
// A saved layout is merged with the widgets that exist now: new widgets appear at the end, removed ones drop out.

export const SIZES = ["s", "m", "l"];          // one, two or three grid columns wide

export class DashboardLayout {
  /** widgets: [{id, size}] (the defaults, in default order); saved: {order, sizes, hidden} or null */
  constructor(widgets, saved = null) {
    this.defaults = widgets.map((w) => ({ id: w.id, size: SIZES.includes(w.size) ? w.size : "s" }));
    const known = new Set(this.defaults.map((w) => w.id));
    const order = (saved?.order || []).filter((id) => known.has(id));
    this.order = [...order, ...this.defaults.map((w) => w.id).filter((id) => !order.includes(id))];
    this.sizes = Object.fromEntries(this.defaults.map((w) => [w.id, SIZES.includes(saved?.sizes?.[w.id]) ? saved.sizes[w.id] : w.size]));
    this.hidden = new Set((saved?.hidden || []).filter((id) => known.has(id)));
  }

  visible() { return this.order.filter((id) => !this.hidden.has(id)); }
  hiddenIds() { return this.order.filter((id) => this.hidden.has(id)); }
  size(id) { return this.sizes[id]; }

  /** Visible widgets in this new order (hidden ones keep their place at the end). */
  arrange(ids) {
    const rest = this.order.filter((id) => !ids.includes(id));
    this.order = [...ids.filter((id) => this.order.includes(id)), ...rest];
  }

  grow(id) { this.sizes[id] = SIZES[(SIZES.indexOf(this.sizes[id]) + 1) % SIZES.length]; }
  hide(id) { this.hidden.add(id); }
  show(id) { this.hidden.delete(id); }

  toJSON() { return { order: this.order, sizes: this.sizes, hidden: [...this.hidden] }; }
}
