/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared by every GrepX product's React screens (@grepx/web-react); first written for FleetWise (plan/security-react-migration).
// The kit's DataTable as a component: click-to-sort headers, a filter box, pages of 25 / 50 / 100 / all, and rows that open on
// click or Enter - same elements and class names. Columns: {key, label, render?(row) -> node, sort?: false, align?: "end", value?(row)}.
import { useMemo, useState } from "react";
import { Icon } from "./kit.jsx";

const OPEN_IGNORES = "a, button, input, select, label, summary";

export function DataTable({ columns, rows, filter = true, empty = "Nothing yet.", pageSize = 50, onRow }) {
  const [by, setBy] = useState(null);
  const [desc, setDesc] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);
  const value = (col, row) => (col.value ? col.value(row) : row[col.key]);

  const found = useMemo(() => {
    const q = query.toLowerCase();
    let list = rows.filter((r) => !q || columns.some((c) => String(value(c, r) ?? "").toLowerCase().includes(q)));
    const col = columns.find((c) => c.key === by);
    if (col) {
      list = [...list].sort((a, b) => {
        const x = value(col, a), y = value(col, b);
        const n = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true });
        return desc ? -n : n;
      });
    }
    return list;
  }, [rows, columns, query, by, desc]);

  const at = Math.min(page, Math.max(0, Math.ceil(found.length / size) - 1));
  const shown = size ? found.slice(at * size, (at + 1) * size) : found;
  const open = (e, i) => {
    if (onRow && !e.target.closest(OPEN_IGNORES)) onRow(shown[i], e.currentTarget);
  };
  const to = size ? Math.min(found.length, (at + 1) * size) : found.length;

  return (
    <div className="kit-table">
      {filter ? (
        <label className="kit-search"><Icon name="search" size={16} />
          <input type="search" placeholder="Filter" value={query} aria-label="Filter rows" onChange={(e) => { setQuery(e.target.value); setPage(0); }} /></label>
      ) : null}
      <div className="kit-scroll">
        <table>
          <thead><tr>{columns.map((c) => (
            <th key={c.key} className={c.align === "end" ? "end" : ""}>{c.sort === false ? c.label : (
              <button type="button" className={`kit-sort ${by === c.key ? (desc ? "desc" : "asc") : ""}`}
                onClick={() => { setDesc(by === c.key ? !desc : false); setBy(c.key); }}>{c.label}</button>)}</th>))}</tr></thead>
          <tbody>
            {shown.length ? shown.map((r, i) => (
              <tr key={i} className={onRow ? "kit-row-link" : undefined} tabIndex={onRow ? 0 : undefined}
                onClick={onRow ? (e) => open(e, i) : undefined} onKeyDown={onRow ? (e) => { if (e.key === "Enter") open(e, i); } : undefined}>
                {columns.map((c) => <td key={c.key} className={c.align === "end" ? "end" : ""}>{c.render ? c.render(r) : r[c.key] ?? ""}</td>)}
              </tr>
            )) : <tr><td colSpan={columns.length} className="muted">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {found.length > 25 ? (
        <div className="kit-pager"><span>{at * size + 1}-{to} of {found.length}</span>
          <button type="button" className="btn small" disabled={!at} aria-label="Previous page" onClick={() => setPage(at - 1)}>‹</button>
          <button type="button" className="btn small" disabled={!(to < found.length)} aria-label="Next page" onClick={() => setPage(at + 1)}>›</button>
          <select value={size} aria-label="Rows per page" onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
            {[25, 50, 100, 0].map((n) => <option key={n} value={n}>{n ? `${n} rows` : "All rows"}</option>)}</select></div>
      ) : null}
    </div>
  );
}
