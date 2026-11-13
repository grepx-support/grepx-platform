/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Fuzzy match for the finder: every letter of the query in order. Higher is better; 0 = no match.
// A whole-word or start-of-word hit beats letters scattered through the text.
export function score(query, text) {
  const q = query.trim().toLowerCase(), t = (text || "").toLowerCase();
  if (!q) return 1;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const word = t.indexOf(q);
  if (word >= 0) return t[word - 1] === " " || word === 0 ? 70 : 50;
  let at = 0, gaps = 0;
  for (const c of q) {
    const next = t.indexOf(c, at);
    if (next < 0) return 0;
    gaps += next - at;
    at = next + 1;
  }
  return Math.max(1, 30 - gaps);
}

/** Best first; ties keep the source order. */
export const rank = (query, items) => items
  .map((it, n) => ({ it, n, s: Math.max(score(query, it.title), score(query, it.keywords || "") * 0.8) }))
  .filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.n - b.n).map((x) => x.it);
