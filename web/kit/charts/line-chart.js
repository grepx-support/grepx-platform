/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Line chart (SVG): one or more series over labelled x positions, area fill, optional shaded target band
// (e.g. the COGS range), and a dot with a tooltip per point. Gaps (null) break the line.
import { html, raw } from "../core/dom.js";
import { linear, niceMax, short, ticks } from "./scale.js";

const W = 640, H = 220, PAD = { l: 40, r: 12, t: 12, b: 26 };

/** lineChart({ labels: [...], series: [{name, color, values: [...]}], band: [lo, hi], unit: "%", max }) -> Raw */
export function lineChart({ labels, series, band = null, unit = "", max = null, label = "Line chart" }) {
  const all = series.flatMap((s) => s.values).concat(band || []);
  const top = max ?? niceMax(all, 1);
  const x = linear([0, Math.max(1, labels.length - 1)], [PAD.l, W - PAD.r]);
  const y = linear([0, top], [H - PAD.b, PAD.t]);
  const every = Math.ceil(labels.length / 8);
  const grid = ticks(top).map((t) => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}" class="kit-grid"/>
    <text x="${PAD.l - 6}" y="${y(t) + 4}" class="kit-axis" text-anchor="end">${short(t)}${unit}</text>`).join("");
  const xs = labels.map((l, i) => (i % every ? "" : `<text x="${x(i)}" y="${H - 6}" class="kit-axis" text-anchor="middle">${String(l).replace(/[<&]/g, "")}</text>`)).join("");
  const bandRect = band ? `<rect x="${PAD.l}" width="${W - PAD.l - PAD.r}" y="${y(band[1])}" height="${y(band[0]) - y(band[1])}" class="kit-band"/>` : "";
  const lines = series.map((s, n) => path(s, n, x, y, labels, unit)).join("");
  return html`<figure class="kit-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    ${raw(bandRect + grid + xs + lines)}</svg>${series.length > 1 ? legend(series) : ""}</figure>`;
}

let uid = 0;

function path(s, n, x, y, labels, unit) {
  const id = `${n}${uid++}`;
  const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v), v, i]));
  const runs = [];
  let run = [];
  for (const p of pts) { if (p) run.push(p); else if (run.length) { runs.push(run); run = []; } }
  if (run.length) runs.push(run);
  const d = runs.map((r) => "M" + r.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")).join("");
  const area = runs.map((r) => `M${r[0][0]},${y(0)}L` + r.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") + `L${r[r.length - 1][0]},${y(0)}Z`).join("");
  const dots = pts.filter(Boolean).map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="${s.color}" class="kit-dotp"><title>${String(labels[p[3]]).replace(/[<&]/g, "")}: ${short(p[2])}${unit}</title></circle>`).join("");
  return `<linearGradient id="kgx${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".28"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>
    <path d="${area}" fill="url(#kgx${id})"/><path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
}

export function legend(series) {
  return html`<figcaption class="kit-legend">${series.map((s) => html`<span><i style="background:${s.color}"></i>${s.name}</span>`)}</figcaption>`;
}
