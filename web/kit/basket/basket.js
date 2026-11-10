/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The lines being built (an order, a warehouse-out, a transfer): quantity with - / + steppers, remove, a drop zone.
import { Component } from "../core/component.js";
import { html } from "../core/dom.js";
import { Emitter } from "../core/emitter.js";
import { icon } from "../icons/icons.js";

const num = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? "" : Number(v));

export class Basket extends Component {
  /** props: { lines: [{item_id, name, unit, qty, hint}], label: "Send", empty, step } - emits "change" (lines) */
  constructor(props) {
    super({ step: 1, label: "Quantity", ...props, lines: (props.lines || []).map((l) => ({ ...l })) });
    this.events = new Emitter();
  }

  add(item, qty = "") {
    const line = this.props.lines.find((l) => l.item_id === item.id);
    if (line) line.qty = num(line.qty || 0) + (num(qty) || this.props.step);
    else this.props.lines.push({ item_id: item.id, name: item.name, unit: item.unit, qty: num(qty), hint: item.hint || "" });
    this.update();
    this.el.querySelector(`[data-line="${CSS.escape(item.id)}"] input`)?.focus();
    this.changed();
  }

  /** [{item_id, qty}] with a quantity above zero (or zero too when keepZero). */
  lines(keepZero = false) {
    return this.props.lines.filter((l) => l.qty !== "" && (keepZero || l.qty > 0)).map((l) => ({ item_id: l.item_id, qty: Number(l.qty) }));
  }

  render() {
    const { lines, label, empty = "Drag items here, or tap + on an item" } = this.props;
    return html`<div class="kit-basket" data-drop>${lines.length ? html`<div class="kit-blines">${lines.map((l) => html`
      <div class="kit-bline" data-line="${l.item_id}"><div class="kit-bname"><b>${l.name}</b>${l.hint ? html`<small>${l.hint}</small>` : ""}</div>
        <div class="kit-stepper"><button type="button" class="kit-iconbtn small" data-dec aria-label="Less ${l.name}">${icon("minus", { size: 16 })}</button>
          <input type="number" inputmode="decimal" min="0" step="any" value="${l.qty}" aria-label="${label} ${l.name}">
          <button type="button" class="kit-iconbtn small" data-inc aria-label="More ${l.name}">${icon("plus", { size: 16 })}</button></div>
        <span class="kit-unit">${l.unit || ""}</span>
        <button type="button" class="kit-iconbtn small danger" data-remove aria-label="Remove ${l.name}">${icon("x", { size: 16 })}</button></div>`)}</div>`
      : html`<div class="kit-bempty">${icon("inbox", { size: 34 })}<p>${empty}</p></div>`}</div>`;
  }

  mounted() {
    const step = this.props.step;
    this.el.querySelectorAll("[data-line]").forEach((row) => {
      const line = this.props.lines.find((l) => l.item_id === row.dataset.line);
      const input = row.querySelector("input");
      input.oninput = () => { line.qty = num(input.value); this.changed(); };
      row.querySelector("[data-inc]").onclick = () => { line.qty = num(line.qty || 0) + step; input.value = line.qty; this.changed(); };
      row.querySelector("[data-dec]").onclick = () => { line.qty = Math.max(0, num(line.qty || 0) - step); input.value = line.qty; this.changed(); };
      row.querySelector("[data-remove]").onclick = () => { this.props.lines.splice(this.props.lines.indexOf(line), 1); this.update(); this.changed(); };
    });
  }

  changed() { this.events.emit("change", this.props.lines); }
}
