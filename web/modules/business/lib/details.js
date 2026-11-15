/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Any row opened from a list: every field it carries, in plain words (for lists whose rows have no page of their own -
// the audit trail, messages sent, stock movements, food-safety checks, fund movements).
import { html, openDialog } from "/assets/kit/index.js";

const SKIP = new Set(["tenant_id", "status", "id"]);
const label = (k) => k.replace(/_id$/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const show = (v) => (v == null || v === "" ? "-" : Array.isArray(v) ? (v.every((x) => typeof x !== "object") ? v.join(", ") : `${v.length} entries`)
  : typeof v === "object" ? Object.entries(v).map(([k, x]) => `${label(k)}: ${typeof x === "object" ? JSON.stringify(x) : x}`).join(" · ") : String(v));

export function showDetails(title, row, { long = [] } = {}) {
  const keys = Object.keys(row).filter((k) => !k.startsWith("_") && !SKIP.has(k) && !long.includes(k));
  const body = html`<dl class="kit-facts">${keys.map((k) => html`<dt>${label(k)}</dt><dd>${show(row[k])}</dd>`)}</dl>
    ${long.filter((k) => row[k]).map((k) => html`<h3>${label(k)}</h3><pre class="k-pre">${row[k]}</pre>`)}`;
  return openDialog({ title, body, wide: true, actions: [{ label: "Close", value: "", primary: true }] });
}
