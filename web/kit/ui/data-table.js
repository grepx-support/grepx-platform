/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A table with click-to-sort headers, a quick filter box and pages (25 / 50 / 100 / all rows); columns decide how a cell
// looks. It scrolls inside itself with the header kept, so a long table never makes the whole page long.
import { Component } from "../core/component.js";
import { html, raw } from "../core/dom.js";
import { icon } from "../icons/icons.js";

export class DataTable extends Component {
  /** props: { columns: [{key, label, render?(row) -> markup, sort?: false, align?: "end", value?(row)}],
   *           rows, filter: true, empty, pageSize, onRow?(row) - clicking a row (or Enter on it) opens it } */
  constructor(props) {
    super({ filter: true, pageSize: 50, empty: "Nothing yet.", ...props });
    this.by = null; this.desc = false; this.query = ""; this.page = 0; this.size = this.props.pageSize;
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
    this.total = rows.length;
    this.page = Math.min(this.page, Math.max(0, Math.ceil(rows.length / this.size) - 1));
    return this.size ? rows.slice(this.page * this.size, (this.page + 1) * this.size) : rows;
  }

  pager() {
    if (this.total <= 25) return "";
    const from = this.page * this.size + 1, to = this.size ? Math.min(this.total, (this.page + 1) * this.size) : this.total;
    return html`<div class="kit-pager"><span>${from}-${to} of ${this.total}</span>
      <button type="button" class="btn small" data-page="-1" ${this.page ? "" : "disabled"} aria-label="Previous page">‹</button>
      <button type="button" class="btn small" data-page="1" ${to < this.total ? "" : "disabled"} aria-label="Next page">›</button>
      <select data-size aria-label="Rows per page">${[25, 50, 100, 0].map((n) => html`<option value="${n}" ${n === this.size ? "selected" : ""}>${n ? `${n} rows` : "All rows"}</option>`)}</select></div>`;
  }

  render() {
    const { columns, filter, empty } = this.props;
    const rows = this.rows();
    this.shown = rows;
    const open = this.props.onRow;
    return html`<div class="kit-table">${filter ? html`<label class="kit-search">${icon("search", { size: 16 })}<input type="search" placeholder="Filter"
        value="${this.query}" aria-label="Filter rows"></label>` : ""}
      <div class="kit-scroll"><table><thead><tr>${columns.map((c) => html`<th class="${c.align === "end" ? "end" : ""}">${c.sort === false ? c.label
        : html`<button type="button" data-sort="${c.key}" class="kit-sort ${this.by === c.key ? (this.desc ? "desc" : "asc") : ""}">${c.label}</button>`}</th>`)}</tr></thead>
      <tbody>${rows.length ? rows.map((r, i) => html`<tr ${open ? raw(`class="kit-row-link" tabindex="0" data-row="${i}"`) : ""}>${columns.map((c) => html`<td class="${c.align === "end" ? "end" : ""}">${c.render ? raw(c.render(r)) : r[c.key] ?? ""}</td>`)}</tr>`)
        : html`<tr><td colspan="${columns.length}" class="muted">${empty}</td></tr>`}</tbody></table></div>${this.pager()}</div>`;
  }

  mounted() {
    this.el.querySelectorAll("[data-sort]").forEach((b) => b.onclick = () => {
      this.desc = this.by === b.dataset.sort ? !this.desc : false;
      this.by = b.dataset.sort;
      this.update();
    });
    this.el.querySelectorAll("[data-page]").forEach((b) => b.onclick = () => { this.page += Number(b.dataset.page); this.update(); });
    if (this.props.onRow) {
      const pick = (e) => {
        const tr = e.target.closest("tr[data-row]");
        if (tr && !e.target.closest("a, button, input, select, label, summary")) this.props.onRow(this.shown[Number(tr.dataset.row)], tr);
      };
      const body = this.el.querySelector("tbody");
      body.addEventListener("click", pick);
      body.addEventListener("keydown", (e) => { if (e.key === "Enter") pick(e); });
    }
    const size = this.el.querySelector("[data-size]");
    if (size) size.onchange = () => { this.size = Number(size.value); this.page = 0; this.update(); };
    const input = this.el.querySelector("input[type=search]");
    if (input) input.oninput = () => { this.query = input.value; this.page = 0; this.update(); const i = this.el.querySelector("input[type=search]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
  }
}
