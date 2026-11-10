/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A searchable palette of items, grouped by category. Drag an item out (to a Basket) or tap its + button.
import { Component } from "../core/component.js";
import { html } from "../core/dom.js";
import { Emitter } from "../core/emitter.js";
import { icon } from "../icons/icons.js";
import { canScan, scanBarcode } from "../ui/scanner.js";

export class ItemPalette extends Component {
  /** props: { items: [{id, name, unit, category, hint, barcode}], title, scan } - emits "pick" (item); scan: a camera button
   *  that picks the item whose barcode was scanned (where the browser can scan) */
  constructor(props) {
    super(props);
    this.events = new Emitter();
    this.query = "";
    this.category = "";
  }

  categories() { return [...new Set(this.props.items.map((i) => i.category).filter(Boolean))].sort(); }

  visible() {
    const q = this.query.toLowerCase();
    return this.props.items.filter((i) => (!this.category || i.category === this.category) && (!q || i.name.toLowerCase().includes(q)));
  }

  render() {
    const cats = this.categories();
    return html`<aside class="kit-palette"><header><h3>${icon("box")} ${this.props.title || "Items"}</h3>
        <div class="kit-prow"><label class="kit-search">${icon("search", { size: 16 })}<input type="search" placeholder="Find an item" value="${this.query}" aria-label="Find an item"></label>
        ${this.props.scan && canScan() ? html`<button type="button" class="kit-iconbtn" data-scan aria-label="Scan a barcode" title="Scan a barcode">${icon("scan")}</button>` : ""}</div>
        ${cats.length > 1 ? html`<div class="kit-chips"><button type="button" class="kit-chip ${this.category ? "" : "on"}" data-cat="">All</button>
          ${cats.map((c) => html`<button type="button" class="kit-chip ${c === this.category ? "on" : ""}" data-cat="${c}">${c}</button>`)}</div>` : ""}
      </header><div class="kit-plist">${this.visible().map((i) => html`<div class="kit-pchip" data-drag data-id="${i.id}">
          <span class="kit-grip" aria-hidden="true">${icon("grip", { size: 14 })}</span>
          <span class="kit-pname">${i.name}<small>${i.hint || i.unit || ""}</small></span>
          <button type="button" class="kit-iconbtn small" data-pick aria-label="Add ${i.name}">${icon("plus", { size: 16 })}</button></div>`)}
        ${this.visible().length ? "" : html`<p class="muted">No items match.</p>`}</div></aside>`;
  }

  mounted() {
    const input = this.el.querySelector("input");
    input.oninput = () => { this.query = input.value; const at = input.selectionStart; this.update(); const next = this.el.querySelector("input"); next.focus(); next.setSelectionRange(at, at); };
    this.el.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => { this.category = b.dataset.cat; this.update(); });
    this.el.querySelector("[data-scan]")?.addEventListener("click", async () => {
      const code = await scanBarcode();
      if (!code) return;
      const item = this.props.items.find((i) => i.barcode && i.barcode === code);
      if (item) this.events.emit("pick", item);
      else { this.query = code; this.update(); }
    });
    this.el.querySelectorAll("[data-pick]").forEach((b) => b.onclick = () => this.events.emit("pick", this.item(b.closest("[data-id]").dataset.id)));
  }

  item(id) { return this.props.items.find((i) => i.id === id); }
}
