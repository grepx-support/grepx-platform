/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A board of columns with cards that move between them by drag and drop (or the card's "Move to" menu).
// The page decides what a move means: onMove(card, from, to) does the real work and returns true when it worked;
// the card moves at once and goes back if the move fails. A column's accepts(card, from) can refuse a drop.
import { Component } from "../core/component.js";
import { html, raw } from "../core/dom.js";
import { icon } from "../icons/icons.js";
import { DragController } from "../dnd/drag-controller.js";

export class KanbanBoard extends Component {
  /** props: { columns: [{id, title, icon, color, accepts?(card, from), hint}], cards: [{id, column, ...}],
   *           card(card) -> markup, onMove(card, from, to) -> Promise<boolean>, empty: text } */
  render() {
    const { columns, cards, empty = "Nothing here" } = this.props;
    return html`<div class="kit-board" style="--cols:${columns.length}">${columns.map((col) => {
      const mine = cards.filter((c) => c.column === col.id);
      return html`<section class="kit-kcol" data-drop data-col="${col.id}" style="--area:${col.color || "var(--accent)"}">
        <header class="kit-khead">${icon(col.icon || "dot")}<h3>${col.title}</h3><span class="kit-count">${mine.length}</span></header>
        ${col.hint ? html`<p class="kit-khint">${col.hint}</p>` : ""}
        <div class="kit-klist">${mine.map((c) => this.cardMarkup(c, col))}</div>
        <p class="kit-kempty" ${mine.length ? "hidden" : ""}>${empty}</p></section>`;
    })}</div>`;
  }

  cardMarkup(card, col) {
    const others = this.props.columns.filter((c) => c.id !== col.id && (!c.accepts || c.accepts(card, col.id)));
    return html`<article class="kit-kcard" data-drag data-id="${card.id}">
      <button type="button" class="kit-grip" aria-label="Drag">${icon("grip", { size: 16 })}</button>
      <div class="kit-kbody">${raw(this.props.card(card))}</div>
      ${others.length ? html`<label class="kit-kmove"><span class="sr-only">Move to</span><select data-move>
        <option value="">Move to…</option>${others.map((c) => html`<option value="${c.id}">${c.title}</option>`)}</select></label>` : ""}
    </article>`;
  }

  mounted() {
    const drag = new DragController(this.el, { handle: ".kit-kcard", target: ".kit-kcol", scope: this.el });
    drag.on("over", (d) => this.mark(d));
    drag.on("drop", (d) => this.move(d.source.dataset.id, d.over.dataset.col));
    drag.on("end", () => this.el.querySelectorAll(".kit-refuse").forEach((c) => c.classList.remove("kit-refuse")));
    this.onCleanup(() => drag.destroy());
    this.el.querySelectorAll("[data-move]").forEach((sel) => sel.onchange = () => sel.value && this.move(sel.closest(".kit-kcard").dataset.id, sel.value));
  }

  column(id) { return this.props.columns.find((c) => c.id === id); }

  allowed(card, to) {
    const col = this.column(to);
    return !!col && to !== card.column && (!col.accepts || col.accepts(card, card.column));
  }

  mark(d) {
    const card = this.props.cards.find((c) => c.id === d.source.dataset.id);
    this.el.querySelectorAll(".kit-kcol").forEach((col) => col.classList.toggle("kit-refuse", col === d.over && !this.allowed(card, col.dataset.col)));
  }

  async move(id, to) {
    const card = this.props.cards.find((c) => c.id === id);
    if (!card || !this.allowed(card, to)) return this.update();
    const from = card.column;
    card.column = to;
    this.update();
    let ok = false;
    try { ok = await this.props.onMove(card, from, to); } catch (e) { ok = false; }
    if (!ok) {
      card.column = from;
      this.update();
      this.el.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add("kit-shake");
    }
  }
}
