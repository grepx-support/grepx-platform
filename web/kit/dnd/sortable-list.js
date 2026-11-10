/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Reorder children of a list by dragging them (or with the arrow keys on an item's grip).
// new SortableList(listEl, { onChange: (ids) => save(ids) }) - children carry data-id; a .kit-grip inside makes
// them draggable on touch screens too. axis: "y" for a list, "xy" for a grid of tiles.
import { Emitter } from "../core/emitter.js";
import { before, DragController } from "./drag-controller.js";

export class SortableList extends Emitter {
  constructor(list, { item = "[data-id]", onChange = null, axis = "y" } = {}) {
    super();
    this.list = list;
    this.item = item;
    this.axis = axis;
    if (onChange) this.on("change", onChange);
    this.drag = new DragController(list, { handle: item, target: item, scope: list });
    this.drag.on("start", () => { this.startOrder = this.ids().join(","); });
    this.drag.on("over", (d) => this.place(d));
    this.drag.on("end", () => this.changed());
    this.keys = (e) => this.keyboard(e);
    list.addEventListener("keydown", this.keys);
  }

  ids() { return [...this.list.querySelectorAll(this.item)].filter((el) => el.parentElement === this.list).map((el) => el.dataset.id); }

  place(d) {
    const target = d.over;
    if (!target || target === d.source || target.parentElement !== this.list) return;
    target[before(target, d.x, d.y, this.axis) ? "before" : "after"](d.source);
  }

  keyboard(e) {
    const grip = e.target.closest(".kit-grip");
    const el = grip?.closest(this.item);
    if (!el || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    this.startOrder = this.ids().join(",");
    const back = e.key === "ArrowUp" || e.key === "ArrowLeft";
    const sibling = back ? el.previousElementSibling : el.nextElementSibling;
    if (sibling?.matches(this.item)) sibling[back ? "before" : "after"](el);
    grip.focus();
    this.changed();
  }

  changed() {
    const now = this.ids();
    if (now.join(",") !== this.startOrder) this.emit("change", now);
  }

  destroy() {
    this.drag.destroy();
    this.list.removeEventListener("keydown", this.keys);
  }
}
