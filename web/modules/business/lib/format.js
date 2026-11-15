/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// How numbers, money, percentages and times read on every screen.

import { locale } from "./money.js";

export const fmt = (n, d = 2) => (n === null || n === undefined || n === "" ? "–" : Number(n).toLocaleString(locale(), { maximumFractionDigits: d }));
export const money = (b, n) => (n === null || n === undefined ? "–" : `${b.business?.currency || ""} ${fmt(n, 2)}`);
export const pct = (v) => (v === null || v === undefined ? "–" : `${fmt(v, 1)}%`);
const local = (iso) => { const d = new Date(iso || ""); return Number.isNaN(d.getTime()) ? null : d; };
/** Times are stored in UTC; people read them in their own time zone. */
export const time = (iso) => local(iso)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "";
export const stamp = (iso) => { const d = local(iso); return d ? `${d.toLocaleDateString()} ${time(iso)}` : ""; };
export const today = () => new Date().toISOString().slice(0, 10);
export const thisMonth = () => new Date().toISOString().slice(0, 7);

/** "Good morning" / "Good afternoon" / "Good evening" */
export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
