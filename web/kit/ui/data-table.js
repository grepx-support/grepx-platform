/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A table with click-to-sort headers and a quick filter box; columns decide how a cell looks.
import { Component } from "../core/component.js";
import { html, raw } from "../core/dom.js";
import { icon } from "../icons/icons.js";

export class DataTable extends Component {
  /** props: { columns: [{key, label, render?(row) -> markup, sort?: false, align?: "end", value?(row)}],
   *           rows, filter: true, empty, pageSize } */
  constructor(props) {
    super({ filter: true, pageSize: 200, empty: "Nothing yet.", ...props });
    this.by = null; this.desc = false; this.query = "";
  }

  value(col, row) { return col.value ? col.value(row) : row[col.key]; }

  rows() {
    const q = this.query.toLowerCase();
    let rows = this.props.rows.filter((r) => !q || this.props.columns.some((c) => String(this.value(c, r) ?? "").toLowerCase().includes(q)));
    const col = this.props.columns.find((c) => c.key === this.by);
    if (col) {
      rows = [...rows].sort((a, b) => {
        const x = this.value(col, a), y = this.value(col, b);
        const n = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true });
        return this.desc ? -n : n;
      });
    }
    return rows.slice(0, this.props.pageSize);
  }

  render() {
    const { columns, filter, empty } = this.props;
    const rows = this.rows();
    return html`<div class="kit-table">${filter ? html`<label class="kit-search">${icon("search", { size: 16 })}<input type="search" placeholder="Filter"
        value="${this.query}" aria-label="Filter rows"></label>` : ""}
      <div class="kit-scroll"><table><thead><tr>${columns.map((c) => html`<th class="${c.align === "end" ? "end" : ""}">${c.sort === false ? c.label
        : html`<button type="button" data-sort="${c.key}" class="kit-sort ${this.by === c.key ? (this.desc ? "desc" : "asc") : ""}">${c.label}</button>`}</th>`)}</tr></thead>
      <tbody>${rows.length ? rows.map((r) => html`<tr>${columns.map((c) => html`<td class="${c.align === "end" ? "end" : ""}">${c.render ? raw(c.render(r)) : r[c.key] ?? ""}</td>`)}</tr>`)
        : html`<tr><td colspan="${columns.length}" class="muted">${empty}</td></tr>`}</tbody></table></div></div>`;
  }

  mounted() {
    this.el.querySelectorAll("[data-sort]").forEach((b) => b.onclick = () => {
      this.desc = this.by === b.dataset.sort ? !this.desc : false;
      this.by = b.dataset.sort;
      this.update();
    });
    const input = this.el.querySelector("input[type=search]");
    if (input) input.oninput = () => { this.query = input.value; this.update(); const i = this.el.querySelector("input[type=search]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
  }
}
