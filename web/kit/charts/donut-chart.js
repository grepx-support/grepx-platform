/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Donut chart (SVG) with a centre figure and a legend - e.g. where the month's money went.
import { html, raw } from "../core/dom.js";
import { short } from "./scale.js";

/** donut({ parts: [{label, value, color}], centre: "62%", caption: "COGS" }) -> Raw */
export function donut({ parts, centre = "", caption = "", label = "Donut chart" }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value || 0), 0);
  const R = 42, C = 2 * Math.PI * R;
  let at = 0;
  const arcs = total ? parts.filter((p) => p.value > 0).map((p) => {
    const len = (p.value / total) * C;
    const arc = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${p.color}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
      stroke-dashoffset="${(-at).toFixed(2)}" transform="rotate(-90 60 60)"><title>${String(p.label).replace(/[<&]/g, "")}: ${short(p.value)}</title></circle>`;
    at += len;
    return arc;
  }).join("") : `<circle r="${R}" cx="60" cy="60" fill="none" class="kit-track" stroke-width="16"/>`;
  return html`<figure class="kit-donut"><svg viewBox="0 0 120 120" role="img" aria-label="${label}">${raw(arcs)}
      <text x="60" y="58" text-anchor="middle" class="kit-donut-value">${centre}</text>
      <text x="60" y="74" text-anchor="middle" class="kit-axis">${caption}</text></svg>
    <figcaption class="kit-legend column">${parts.map((p) => html`<span><i style="background:${p.color}"></i>${p.label}<b>${short(p.value || 0)}</b></span>`)}</figcaption></figure>`;
}
