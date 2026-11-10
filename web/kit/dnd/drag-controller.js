/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Pointer-based drag and drop (mouse, pen and touch) used by sortable lists, kanban boards, the item palette and
// the dashboard. HTML5 drag events do not work on phones, so this follows the pointer itself:
//   - press on a `handle` element inside `root` and move a few pixels -> a floating copy follows the pointer;
//   - the `target` element under the pointer gets .kit-over (hooks: over(drag), drop(drag), cancel(drag));
//   - on touch screens a drag starts only from a .kit-grip (so the page still scrolls with a finger).
import { Emitter } from "../core/emitter.js";

const IGNORE = "input, textarea, select, button:not(.kit-grip), a, [contenteditable], .kit-nodrag";
const EDGE = 48;           // px from the window edge where the page scrolls by itself while dragging

export class DragController extends Emitter {
  constructor(root, { handle = "[data-drag]", target = "[data-drop]", threshold = 6, scope = document } = {}) {
    super();
    Object.assign(this, { root, handle, target, threshold, scope });
    this.drag = null;
    this.down = this.down.bind(this);
    this.move = this.move.bind(this);
    this.up = this.up.bind(this);
    this.key = (e) => e.key === "Escape" && this.finish(false);
    root.addEventListener("pointerdown", this.down);
  }

  down(e) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const source = e.target.closest(this.handle);
    if (!source || !this.root.contains(source)) return;
    if (e.target.closest(IGNORE) && !e.target.closest(".kit-grip")) return;
    if (e.pointerType === "touch" && !e.target.closest(".kit-grip")) return;
    this.drag = { source, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, started: false, over: null, id: e.pointerId };
    window.addEventListener("pointermove", this.move);
    window.addEventListener("pointerup", this.up);
    window.addEventListener("pointercancel", this.up);
  }

  move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.started) {
      if (Math.hypot(d.x - d.startX, d.y - d.startY) < this.threshold) return;
      this.begin(d);
    }
    e.preventDefault();
    d.ghost.style.transform = `translate(${d.x - d.offsetX}px, ${d.y - d.offsetY}px) rotate(1.5deg)`;
    this.hover(d);
    this.autoscroll(d);
  }

  begin(d) {
    const box = d.source.getBoundingClientRect();
    d.started = true;
    d.offsetX = d.startX - box.left; d.offsetY = d.startY - box.top;
    d.ghost = d.source.cloneNode(true);
    d.ghost.classList.add("kit-ghost");
    Object.assign(d.ghost.style, { width: `${box.width}px`, height: `${box.height}px` });
    document.body.append(d.ghost);
    d.source.classList.add("kit-dragging");
    document.body.classList.add("kit-drag-active");
    window.addEventListener("keydown", this.key);
    this.emit("start", d);
  }

  hover(d) {
    const under = document.elementFromPoint(d.x, d.y);
    const target = under?.closest(this.target);
    const inside = target && this.scope.contains(target) ? target : null;
    if (inside !== d.over) {
      d.over?.classList.remove("kit-over");
      inside?.classList.add("kit-over");
      d.over = inside;
    }
    d.under = under;
    this.emit("over", d);
  }

  autoscroll(d) {
    if (d.y < EDGE) window.scrollBy(0, -12);
    else if (d.y > innerHeight - EDGE) window.scrollBy(0, 12);
  }

  up(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.finish(e.type === "pointerup");
  }

  finish(dropped) {
    const d = this.drag;
    this.drag = null;
    window.removeEventListener("pointermove", this.move);
    window.removeEventListener("pointerup", this.up);
    window.removeEventListener("pointercancel", this.up);
    window.removeEventListener("keydown", this.key);
    if (!d?.started) return;
    d.ghost.remove();
    d.source.classList.remove("kit-dragging");
    d.over?.classList.remove("kit-over");
    document.body.classList.remove("kit-drag-active");
    this.emit(dropped && d.over ? "drop" : "cancel", d);
    this.emit("end", d);
  }

  destroy() {
    this.finish(false);
    this.root.removeEventListener("pointerdown", this.down);
  }
}

/** Should a dragged element go before `target`? axis "y": upper half (lists); "xy": by row, then by column (grids). */
export function before(target, x, y, axis = "xy") {
  const r = target.getBoundingClientRect();
  if (axis === "y") return y < r.top + r.height / 2;
  if (y < r.top + r.height * 0.25) return true;
  if (y > r.bottom - r.height * 0.25) return false;
  return x < r.left + r.width / 2;
}
