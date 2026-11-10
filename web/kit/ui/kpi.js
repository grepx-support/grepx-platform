/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// KPI tile: icon, label, big value, an optional note, trend line and good/bad tone.
import { html } from "../core/dom.js";
import { icon } from "../icons/icons.js";
import { sparkline } from "../charts/sparkline.js";

/** kpi({ label, value, icon, area, note, tone: "good"|"bad"|"", trend: [numbers], href }) -> Raw */
export function kpi({ label, value, icon: name = "dot", area = "", note = "", tone = "", trend = null, href = "" }) {
  const body = html`<span class="kit-kpi-icon">${icon(name, { size: 20 })}</span>
    <span class="kit-kpi-label">${label}</span><strong class="kit-kpi-value ${tone}">${value}</strong>
    ${note ? html`<small class="kit-kpi-note">${note}</small>` : ""}${trend ? sparkline(trend, { color: "var(--area)" }) : ""}`;
  const style = area ? `--area:${area}` : "";
  return href ? html`<a class="kit-kpi" href="${href}" style="${style}">${body}</a>` : html`<div class="kit-kpi" style="${style}">${body}</div>`;
}

/** A row of KPI tiles. */
export const kpiRow = (items) => html`<div class="kit-kpis">${items.map(kpi)}</div>`;
