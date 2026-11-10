/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A personal dashboard: the widgets this viewer may see, in their own order and sizes, saved per viewer.
// "Customise" switches to editing: drag to reorder, resize, hide, add back hidden ones, reset.
import { Component } from "../core/component.js";
import { html } from "../core/dom.js";
import { icon } from "../icons/icons.js";
import { SortableList } from "../dnd/sortable-list.js";
import { DashboardLayout } from "./layout.js";
import { WidgetFrame } from "./widget-frame.js";

export class DashboardGrid extends Component {
  /** props: { registry: WidgetRegistry, store: {get,set,remove}, key, ctx } */
  constructor(props) {
    super(props);
    this.editing = false;
    this.defs = props.registry.allowed(props.ctx);
    this.layout = new DashboardLayout(this.defs, props.store.get(props.key));
  }

  render() {
    const hidden = this.layout.hiddenIds().map((id) => this.props.registry.get(id));
    return html`<div class="kit-dash ${this.editing ? "editing" : ""}">
      <div class="kit-dtools">
        ${this.editing && hidden.length ? html`<label class="kit-add">${icon("plus", { size: 16 })}<select data-show aria-label="Add a widget">
          <option value="">Add a widget…</option>${hidden.map((d) => html`<option value="${d.id}">${d.title}</option>`)}</select></label>` : ""}
        ${this.editing ? html`<button type="button" class="btn small" data-reset>${icon("refresh", { size: 15 })} Reset</button>` : ""}
        <button type="button" class="btn small ${this.editing ? "primary" : ""}" data-edit>${icon(this.editing ? "check" : "layout", { size: 15 })}
          ${this.editing ? "Done" : "Customise"}</button></div>
      ${this.editing ? html`<p class="kit-dhint">Drag tiles by their grip to reorder · ${icon("resize", { size: 13 })} changes the size · ${icon("eyeoff", { size: 13 })} hides one</p>` : ""}
      <div class="kit-dgrid"></div></div>`;
  }

  mounted() {
    const grid = this.el.querySelector(".kit-dgrid");
    for (const id of this.layout.visible()) {
      new WidgetFrame({ def: this.props.registry.get(id), size: this.layout.size(id), editing: this.editing, ctx: this.props.ctx,
        onGrow: (wid) => this.change(() => this.layout.grow(wid)), onHide: (wid) => this.change(() => this.layout.hide(wid)) }).appendTo(grid);
    }
    this.el.querySelector("[data-edit]").onclick = () => { this.editing = !this.editing; this.update(); };
    this.el.querySelector("[data-reset]")?.addEventListener("click", () => {
      this.props.store.remove(this.props.key);
      this.layout = new DashboardLayout(this.defs);
      this.update();
    });
    const add = this.el.querySelector("[data-show]");
    if (add) add.onchange = () => add.value && this.change(() => this.layout.show(add.value));
    if (this.editing) {
      const sortable = new SortableList(grid, { item: ".kit-widget", axis: "xy", onChange: (ids) => this.change(() => this.layout.arrange(ids), false) });
      this.onCleanup(() => sortable.destroy());
    }
  }

  change(fn, redraw = true) {
    fn();
    this.props.store.set(this.props.key, this.layout.toJSON());
    if (redraw) this.update();
  }
}
