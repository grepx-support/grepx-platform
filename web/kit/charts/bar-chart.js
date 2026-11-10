/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Horizontal bar list (SVG-free, CSS bars): best for "items by quantity" on a phone. Optional marker per row
// (a par / target level) and per-row colour.
import { html, raw } from "../core/dom.js";
import { short } from "./scale.js";

/** barList({ rows: [{label, value, max?, marker?, color?, note?}], unit }) -> Raw */
export function barList({ rows, unit = "", empty = "No data yet" }) {
  if (!rows.length) return html`<p class="muted">${empty}</p>`;
  const top = Math.max(1, ...rows.map((r) => Math.max(r.max ?? r.value, r.marker ?? 0, r.value)));
  return html`<ul class="kit-bars">${rows.map((r) => {
    const pct = Math.max(0, Math.min(100, (r.value / top) * 100));
    const mark = r.marker != null ? Math.min(100, (r.marker / top) * 100) : null;
    return html`<li><div class="kit-bar-label"><span>${r.label}</span><b>${short(r.value)}${unit}</b></div>
      <div class="kit-bar" style="--c:${r.color || "var(--area, var(--accent))"}"><i style="width:${pct.toFixed(1)}%"></i>
        ${mark != null ? html`<em style="left:${mark.toFixed(1)}%" title="target ${short(r.marker)}"></em>` : ""}</div>
      ${r.note ? html`<small class="muted">${r.note}</small>` : ""}</li>`;
  })}</ul>`;
}

/** Vertical columns (SVG) over labels - e.g. sales per day. */
export function columnChart({ labels, values, color = "var(--accent)", unit = "", label = "Column chart" }) {
  const W = 640, H = 200, P = 26;
  const top = Math.max(1, ...values.filter(Number.isFinite));
  const w = (W - P) / Math.max(1, values.length);
  const every = Math.ceil(labels.length / 10);
  const bars = values.map((v, i) => {
    const h = ((v || 0) / top) * (H - P - 8);
    const bw = Math.min(w * 0.7, 46);                       // a lone day is a column, not a wall
    return `<rect x="${(P + i * w + (w - bw) / 2).toFixed(1)}" y="${(H - P - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${color}"><title>${String(labels[i]).replace(/[<&]/g, "")}: ${short(v || 0)}${unit}</title></rect>`
      + (i % every ? "" : `<text x="${(P + i * w + w / 2).toFixed(1)}" y="${H - 8}" class="kit-axis" text-anchor="middle">${String(labels[i]).replace(/[<&]/g, "")}</text>`);
  }).join("");
  return html`<figure class="kit-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${raw(bars)}</svg></figure>`;
}
