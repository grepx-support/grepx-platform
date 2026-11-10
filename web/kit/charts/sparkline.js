/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A tiny trend line for KPI cards.
import { raw } from "../core/dom.js";

/** sparkline([3, 5, 4, 8], {color}) -> Raw <svg> (empty when fewer than two numbers) */
export function sparkline(values, { color = "currentColor", width = 110, height = 32 } = {}) {
  const v = values.filter(Number.isFinite);
  if (v.length < 2) return raw("");
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((n, i) => `${((i / (v.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - ((n - lo) / span) * (height - 6)).toFixed(1)}`);
  return raw(`<svg class="kit-spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
    <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${pts[pts.length - 1].split(",")[0]}" cy="${pts[pts.length - 1].split(",")[1]}" r="2.8" fill="${color}"/></svg>`);
}
