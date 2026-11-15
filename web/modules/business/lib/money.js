/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Money on every screen: amounts arrive in cents (paise); India reads them in lakh grouping (1,23,456).
import { state } from "/assets/app.js";

export const locale = (cur) => ((cur || state.me?.business?.currency || document.documentElement.dataset.currency) === "INR" ? "en-IN" : undefined);

/** cents -> "INR 1,23,456.00" (currency left out when not given). */
export function cash(cents, cur = "") {
  if (cents === null || cents === undefined || cents === "") return "–";
  const n = Number(cents) / 100;
  const s = n.toLocaleString(locale(cur), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cur ? `${cur} ${s}` : s;
}

/** Short for tiles and charts: 1.2L, 3.4Cr in India; 12.3K, 4.5M elsewhere. */
export function short(cents, cur = "") {
  const n = Number(cents || 0) / 100, a = Math.abs(n);
  if (locale(cur) === "en-IN") return a >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : a >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : a >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0);
  return a >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0);
}

export const currency = () => state.me?.business?.currency || "";
